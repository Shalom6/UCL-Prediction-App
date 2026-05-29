import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const appRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../..');
dotenv.config({ path: path.join(appRoot, '.env.local') });
dotenv.config({ path: path.join(appRoot, '..', '.env.local') });

const API_BASE = 'https://api.polymarketdata.co/v1';

function getApiKey() {
  return (
    process.env.POLYMARKET_DATA_API_KEY ||
    process.env.UCL_prediction_api ||
    process.env.UCL_PREDICTION_API ||
    process.env.CL_PREDICTION_API ||
    process.env.POLYMARKET_API_KEY ||
    ''
  );
}

function extractMarketsList(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.markets)) return payload.markets;
  if (Array.isArray(payload?.results)) return payload.results;
  return [];
}

function marketText(m) {
  return [
    m?.question,
    m?.title,
    m?.name,
    m?.description,
    m?.slug,
    m?.eventTitle,
    m?.event?.title,
    m?.groupItemTitle
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function matchTeam(text, team) {
  const t = String(team || '').toLowerCase();
  const n = String(text || '').toLowerCase();
  if (!t || !n) return false;
  if (n.includes(t)) return true;
  const aliases = {
    psg: ['psg', 'paris', 'saint-germain', 'saint germain'],
    arsenal: ['arsenal', 'gunners']
  };
  return (aliases[t] || [t]).some((a) => n.includes(a));
}

function toPct(price) {
  const n = Number(price);
  if (!Number.isFinite(n)) return null;
  return Math.round((n <= 1 ? n * 100 : n) * 10) / 10;
}

function parseJsonArray(value) {
  if (Array.isArray(value)) return value;
  if (typeof value !== 'string') return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function marketOutcomes(market) {
  if (Array.isArray(market?.outcomes) && market.outcomes.every((o) => typeof o === 'object')) {
    return market.outcomes.map((o) => ({
      name: o.name || o.title || o.outcome || 'Outcome',
      probabilityPct: toPct(o.price ?? o.probability ?? o.prob ?? o.lastPrice)
    }));
  }

  const names = parseJsonArray(market?.outcomes);
  const prices = parseJsonArray(market?.outcomePrices ?? market?.prices);
  if (names.length) {
    return names.map((name, i) => ({
      name: String(name),
      probabilityPct: toPct(prices[i])
    }));
  }

  if (Array.isArray(market?.tokens)) {
    return market.tokens.map((t) => ({
      name: t.outcome || t.name || t.side || 'Outcome',
      probabilityPct: toPct(t.price ?? t.lastPrice ?? t.probability)
    }));
  }

  const yes = toPct(market?.yesPrice ?? market?.yes_price ?? market?.bestAsk);
  const no = toPct(market?.noPrice ?? market?.no_price ?? market?.bestBid);
  if (yes != null) {
    return [
      { name: 'Yes', probabilityPct: yes },
      { name: 'No', probabilityPct: no ?? Math.max(0, 100 - yes) }
    ];
  }

  return [];
}

function normalizeImplied(outcomes) {
  const cleaned = outcomes.filter((o) => Number.isFinite(o.probabilityPct) && o.probabilityPct > 0);
  const sum = cleaned.reduce((s, o) => s + o.probabilityPct, 0);
  if (sum <= 0) return cleaned;
  return cleaned.map((o) => ({
    name: o.name,
    probabilityPct: Math.round((o.probabilityPct / sum) * 1000) / 10
  }));
}

function map1x2(outcomes, homeTeam, awayTeam) {
  let homeWin = null;
  let draw = null;
  let awayWin = null;

  for (const o of outcomes) {
    const name = String(o.name || '').toLowerCase();
    if (name.includes('draw') || name === 'tie') {
      draw = o.probabilityPct;
      continue;
    }
    if (matchTeam(name, homeTeam)) homeWin = o.probabilityPct;
    if (matchTeam(name, awayTeam)) awayWin = o.probabilityPct;
  }

  if (homeWin == null || awayWin == null) return null;
  return {
    homeWin,
    draw: draw ?? Math.max(0, Math.round((100 - homeWin - awayWin) * 10) / 10),
    awayWin
  };
}

function isMatchMarket(text, homeTeam, awayTeam) {
  const hasTeams = matchTeam(text, homeTeam) && matchTeam(text, awayTeam);
  const isWinner =
    text.includes('win') ||
    text.includes('winner') ||
    text.includes('advance') ||
    text.includes('champion') ||
    text.includes('final');
  const isUcl =
    text.includes('champions league') || text.includes('ucl') || text.includes('uefa');
  return hasTeams && (isWinner || isUcl);
}

function isPlayerScoreMarket(text) {
  return (
    text.includes('score') ||
    text.includes('goal') ||
    text.includes('scorer') ||
    text.includes('anytime') ||
    text.includes('to score')
  );
}

async function fetchMarkets(apiKey, limit = 250) {
  const url = `${API_BASE}/markets?limit=${limit}`;
  const res = await fetch(url, {
    headers: { 'x-api-key': apiKey, Accept: 'application/json' },
    cache: 'no-store'
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Polymarket Data API error (${res.status}): ${text.slice(0, 400)}`);
  }

  return res.json();
}

export async function GET(req) {
  try {
    const apiKey = getApiKey();
    if (!apiKey) {
      return Response.json(
        {
          found: false,
          error: 'Missing Polymarket API key',
          message:
            'Add UCL_prediction_api=pk_live_... to UCL_predictions/.env.local (or POLYMARKET_DATA_API_KEY in UCL-Prediction-App/.env.local), then restart npm run dev.'
        },
        { status: 500 }
      );
    }

    const { searchParams } = new URL(req.url);
    const homeTeam = searchParams.get('home') || 'PSG';
    const awayTeam = searchParams.get('away') || 'Arsenal';
    const playerQuery = (searchParams.get('player') || '').trim().toLowerCase();

    const payload = await fetchMarkets(apiKey);
    const markets = extractMarketsList(payload);

    const matchCandidates = markets.filter((m) => isMatchMarket(marketText(m), homeTeam, awayTeam));
    matchCandidates.sort(
      (a, b) => Number(b?.volume ?? b?.volumeNum ?? 0) - Number(a?.volume ?? a?.volumeNum ?? 0)
    );

    const matchMarket = matchCandidates[0] || null;
    const matchOutcomes = matchMarket ? normalizeImplied(marketOutcomes(matchMarket)) : [];
    const implied = matchOutcomes.length ? map1x2(matchOutcomes, homeTeam, awayTeam) : null;

    const playerCandidates = markets.filter((m) => {
      const text = marketText(m);
      if (!isPlayerScoreMarket(text)) return false;
      if (!matchTeam(text, homeTeam) && !matchTeam(text, awayTeam) && !text.includes('champions')) {
        return false;
      }
      if (playerQuery) return text.includes(playerQuery);
      return true;
    });

    const playerMarkets = playerCandidates.slice(0, 25).map((m) => {
      const outcomes = marketOutcomes(m);
      const yes = outcomes.find((o) => String(o.name).toLowerCase() === 'yes') || outcomes[0];
      return {
        question: m?.question || m?.title || m?.name,
        outcomes,
        yesProbabilityPct: yes?.probabilityPct ?? null,
        volume: m?.volume ?? m?.volumeNum ?? null
      };
    });

    if (!matchMarket && !playerMarkets.length) {
      return Response.json({
        found: false,
        homeTeam,
        awayTeam,
        source: 'polymarketdata.co',
        message: `No markets found for ${homeTeam} vs ${awayTeam}. API returned ${markets.length} markets.`
      });
    }

    return Response.json({
      found: true,
      source: 'polymarketdata.co',
      fetchedAt: new Date().toISOString(),
      homeTeam,
      awayTeam,
      eventTitle: matchMarket?.eventTitle || matchMarket?.event?.title || `${homeTeam} vs ${awayTeam}`,
      marketQuestion: matchMarket?.question || matchMarket?.title || matchMarket?.name || null,
      outcomes: matchOutcomes,
      implied,
      volume: matchMarket?.volume ?? matchMarket?.volumeNum ?? null,
      playerMarkets
    });
  } catch (err) {
    return Response.json(
      {
        found: false,
        error: 'Failed to fetch Polymarket data',
        detail: String(err?.message || err)
      },
      { status: 500 }
    );
  }
}
