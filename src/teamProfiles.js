import arsenalBundle from './data/arsenal.json' with { type: 'json' };
import historicalIndex from './data/historical-index.json' with { type: 'json' };
import psgBundle from './data/psg.json' with { type: 'json' };
import { sanitizeRoster, sanitizeUclSeason } from './dataSanity.js';
import { resolveRoster } from './rosterData.js';

const TEAM_BUNDLES = new Map([
  ['PSG', psgBundle],
  ['Paris Saint-Germain', psgBundle],
  ['Paris', psgBundle],
  ['Arsenal', arsenalBundle],
  ['Gunners', arsenalBundle]
]);

function clamp(x, min, max) {
  return Math.max(min, Math.min(max, x));
}

function round(n, dp = 2) {
  const p = 10 ** dp;
  return Math.round(n * p) / p;
}

function avgFormRates(formLast10 = []) {
  if (!formLast10.length) return { goalsForPerMatch: null, goalsAgainstPerMatch: null, pointsPerGame: null };
  let gf = 0;
  let ga = 0;
  let pts = 0;
  for (const m of formLast10) {
    gf += Number(m.goalsFor) || 0;
    ga += Number(m.goalsAgainst) || 0;
    if (m.result === 'W') pts += 3;
    else if (m.result === 'D') pts += 1;
  }
  const n = formLast10.length;
  return {
    goalsForPerMatch: gf / n,
    goalsAgainstPerMatch: ga / n,
    pointsPerGame: pts / n
  };
}

function seasonUclRates(season) {
  const u = sanitizeUclSeason(season?.ucl ?? {}, season?.league ?? {});
  const played = Number(u.played) || 1;
  return {
    goalsForPerMatch: (Number(u.goalsFor) || 0) / played,
    goalsAgainstPerMatch: (Number(u.goalsAgainst) || 0) / played,
    xgForPerMatch: (Number(u.xgFor) || 0) / played,
    xgAgainstPerMatch: (Number(u.xgAgainst) || 0) / played,
    shotsPerMatch: Number(u.shotsPerMatch) || 14,
    shotsOnTargetPerMatch: Number(u.shotsOnTargetPerMatch) || 5,
    cornersPerMatch: Number(u.cornersPerMatch) || 5.5,
    played,
    dataQuality: Number(season?.ucl?.goalsFor) < 1 ? 'ucl-goals-repaired' : 'ok'
  };
}

function blend3(hist, season, form, weights) {
  const pick = (h, s, f, fallback) => {
    const parts = [];
    if (Number.isFinite(h)) parts.push({ v: h, w: weights.historical });
    if (Number.isFinite(s)) parts.push({ v: s, w: weights.season2025_26 });
    if (Number.isFinite(f)) parts.push({ v: f, w: weights.formLast10 });
    if (!parts.length) return fallback;
    const wSum = parts.reduce((a, p) => a + p.w, 0);
    return parts.reduce((a, p) => a + (p.v * p.w) / wSum, 0);
  };
  return { pick, weights };
}

/**
 * Build predictor-ready team profile from historical (2000-2026) + 2025-26 season + last-10 form.
 */
export function buildTeamProfileFromBundle(bundle) {
  const weights = historicalIndex.blendWeights;
  const hist = bundle.historical;
  const season = bundle.season2025_26;
  const ucl = seasonUclRates(season);
  const form = avgFormRates(season?.formLast10 ?? []);
  const { pick } = blend3(hist, season, form, weights);

  const goalsForPerMatch = pick(
    hist.avgGoalsForUcl,
    ucl.goalsForPerMatch,
    form.goalsForPerMatch,
    1.6
  );
  const goalsAgainstPerMatch = pick(
    hist.avgGoalsAgainstUcl,
    ucl.goalsAgainstPerMatch,
    form.goalsAgainstPerMatch,
    1.1
  );

  const xgForPerMatch = pick(null, ucl.xgForPerMatch, null, goalsForPerMatch * 0.95);
  const xgAgainstPerMatch = pick(null, ucl.xgAgainstPerMatch, null, goalsAgainstPerMatch * 0.95);

  const xgPerGoal = clamp(xgForPerMatch / Math.max(goalsForPerMatch, 0.5), 0.85, 1.25);
  const xgPerShot = clamp(xgForPerMatch / Math.max(ucl.shotsPerMatch, 6), 0.07, 0.14);
  const sotRate = clamp(ucl.shotsOnTargetPerMatch / Math.max(ucl.shotsPerMatch, 6), 0.28, 0.42);
  const cornersPerShot = clamp(ucl.cornersPerMatch / Math.max(ucl.shotsPerMatch, 6), 0.16, 0.32);

  const control = clamp(
    0.45 + (hist.avgPossession - 50) / 100 + (form.pointsPerGame - 1.5) / 10,
    0.38,
    0.62
  );

  const players = sanitizeRoster(resolveRoster(bundle.name, season?.roster ?? [])).map((p) => ({
    name: p.name,
    position: p.position,
    likelyStarter: Boolean(p.likelyStarter),
    benchImpact: Boolean(p.benchImpact),
    minutesFactor: p.minutesFactor ?? 0.8,
    xgShare: p.xgShare ?? 0.05,
    propProfile: p.propProfile ?? null
  }));

  return {
    name: bundle.name,
    goalsForPerMatch: round(goalsForPerMatch, 2),
    goalsAgainstPerMatch: round(goalsAgainstPerMatch, 2),
    xgPerGoal: round(xgPerGoal, 2),
    xgPerShot: round(xgPerShot, 3),
    sotRate: round(sotRate, 2),
    cornersPerShot: round(cornersPerShot, 2),
    control: round(control, 2),
    players,
    dataProvenance: {
      era: hist.era,
      season: season?.label ?? '2025-26',
      blendWeights: weights,
      formMatches: season?.formLast10?.length ?? 0,
      rosterSize: players.length,
      source: season?.importSource ?? 'bundled-curated-2025-26',
      uclDataQuality: ucl.dataQuality,
      lastImportedAt: season?.lastImportedAt ?? null
    }
  };
}

export function resolveTeamBundle(teamName) {
  return TEAM_BUNDLES.get(teamName) ?? null;
}

export function getTeamProfiles(homeTeamName, awayTeamName) {
  const fallback = (name) => ({
    name,
    goalsForPerMatch: 1.6,
    goalsAgainstPerMatch: 1.1,
    xgPerGoal: 1.05,
    xgPerShot: 0.1,
    sotRate: 0.34,
    cornersPerShot: 0.22,
    control: 0.5,
    players: [],
    dataProvenance: { source: 'generic-fallback' }
  });

  const homeBundle = resolveTeamBundle(homeTeamName);
  const awayBundle = resolveTeamBundle(awayTeamName);

  const home = homeBundle ? buildTeamProfileFromBundle(homeBundle) : fallback(homeTeamName);
  const away = awayBundle ? buildTeamProfileFromBundle(awayBundle) : fallback(awayTeamName);

  return { home, away };
}

export function getDataCatalog() {
  return {
    era: historicalIndex.era,
    blendWeights: historicalIndex.blendWeights,
    teams: [psgBundle, arsenalBundle].map((b) => ({
      name: b.name,
      historical: b.historical,
      season: b.season2025_26?.label,
      rosterCount: b.season2025_26?.roster?.length ?? 0,
      formMatches: b.season2025_26?.formLast10?.length ?? 0
    }))
  };
}
