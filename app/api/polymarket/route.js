import { fetchPolymarketOdds } from '../../../src/polymarket.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const homeTeam = searchParams.get('home') || 'PSG';
  const awayTeam = searchParams.get('away') || 'Arsenal';
  const result = await fetchPolymarketOdds(homeTeam, awayTeam);
  return Response.json(result, { status: result.found ? 200 : result.error ? 500 : 404 });
}
