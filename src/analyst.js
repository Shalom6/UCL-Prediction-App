function pct(n) {
  if (typeof n !== 'number' || !Number.isFinite(n)) return '—';
  return `${n.toFixed(1)}%`;
}

function format1x2(label, p, home, away) {
  if (!p) return `${label}: no data.`;
  return `${label}: ${home} ${pct(p.homeWin)}, Draw ${pct(p.draw)}, ${away} ${pct(p.awayWin)}.`;
}

export function buildAnalystAnswer({ question, context, polymarket }) {
  const q = String(question || '').toLowerCase();
  const home = context?.fixture?.homeTeam ?? 'Home';
  const away = context?.fixture?.awayTeam ?? 'Away';
  const model = context?.modelProbabilitiesPct;
  const market = context?.polymarketProbabilitiesPct ?? polymarket?.implied ?? null;
  const blended = context?.blendedProbabilitiesPct;
  const scorelines = context?.topScorelines ?? [];
  const pm = polymarket;

  if (!context && (q.includes('polymarket') || q.includes('odds'))) {
    if (pm?.found && pm.implied) {
      return `Latest Polymarket (${pm.source || 'live'}): ${home} ${pct(pm.implied.homeWin)}, Draw ${pct(pm.implied.draw)}, ${away} ${pct(pm.implied.awayWin)}.${pm.marketQuestion ? ` Market: ${pm.marketQuestion}` : ''}${pm.note ? ` Note: ${pm.note}` : ''}`;
    }
    return 'Run Predict on the Predictions tab first so I can load match context and Polymarket odds.';
  }

  if (!context) {
    return 'Run Predict on the Predictions tab to load fixture context, then ask about model vs market, scorelines, or Polymarket.';
  }

  if (q.includes('plain english') || q.includes('summarize')) {
    const fav = blended
      ? Object.entries({ [home]: blended.homeWin, Draw: blended.draw, [away]: blended.awayWin }).sort(
          (a, b) => b[1] - a[1]
        )[0]
      : null;
    const top = scorelines[0];
    return [
      `${home} vs ${away} (UCL Final context).`,
      fav ? `Blended view favors ${fav[0]} at ${pct(fav[1])}.` : '',
      top ? `Most likely scoreline: ${top.score} (${pct(top.probability)}).` : '',
      market ? `Polymarket leans ${market.homeWin >= market.awayWin ? home : away} on live odds.` : 'Polymarket odds not blended (model-only).'
    ]
      .filter(Boolean)
      .join(' ');
  }

  if (q.includes('disagree') || q.includes('differ') || q.includes('edge')) {
    if (!model || !market) {
      return 'Need both model and Polymarket in the blend to compare disagreement. Run Predict with live market data.';
    }
    const gaps = [
      { label: home, v: Math.abs(model.homeWin - market.homeWin) },
      { label: 'Draw', v: Math.abs(model.draw - market.draw) },
      { label: away, v: Math.abs(model.awayWin - market.awayWin) }
    ].sort((a, b) => b.v - a.v);
    const biggest = gaps[0];
    return [
      format1x2('Model', model, home, away),
      format1x2('Polymarket', market, home, away),
      format1x2('Blended (50/50 default)', blended, home, away),
      `Largest gap is on ${biggest.label} (${biggest.v.toFixed(1)} pts). Markets often price sentiment and liquidity; the model uses season scoring rates (Poisson).`
    ].join('\n\n');
  }

  if (q.includes('polymarket') || q.includes('odds') || q.includes('market')) {
    const lines = [
      pm?.found
        ? `Polymarket source: ${pm.source || 'live'}${pm.marketType ? ` (${pm.marketType})` : ''}.`
        : pm?.message || 'Polymarket market not found for this fixture.',
      market ? format1x2('Implied 1X2 used in blend', market, home, away) : '',
      pm?.marketQuestion ? `Market: ${pm.marketQuestion}` : '',
      pm?.note ? pm.note : '',
      pm?.dataApiNote ? pm.dataApiNote : ''
    ].filter(Boolean);
    return lines.join('\n\n');
  }

  if (q.includes('scoreline') || q.includes('score')) {
    if (!scorelines.length) return 'No scorelines in context yet.';
    const lines = scorelines.slice(0, 5).map((s, i) => `${i + 1}. ${s.score} — ${pct(s.probability)}`);
    return `Top scorelines from the model:\n${lines.join('\n')}`;
  }

  if (q.includes('dembele') || q.includes('scorer') || q.includes('goal')) {
    return 'Player scorer markets are not wired in this build. Check Polymarket directly for “Dembélé” or “first goalscorer” markets.';
  }

  return [
    `${home} vs ${away} — quick snapshot:`,
    format1x2('Blended', blended, home, away),
    model ? format1x2('Model only', model, home, away) : '',
    market ? format1x2('Polymarket', market, home, away) : '',
    scorelines[0] ? `Top scoreline: ${scorelines[0].score} (${pct(scorelines[0].probability)}).` : '',
    'Try: “Summarize in plain English”, “Why might model and Polymarket disagree?”, or “Show latest Polymarket odds.”'
  ]
    .filter(Boolean)
    .join('\n\n');
}
