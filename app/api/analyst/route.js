import { buildAnalystAnswer } from '../../../src/analyst.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req) {
  try {
    const body = await req.json();
    const question = body?.question;
    if (!question || !String(question).trim()) {
      return Response.json({ error: 'question is required' }, { status: 400 });
    }

    const answer = buildAnalystAnswer({
      question: String(question).trim(),
      context: body?.context ?? null,
      polymarket: body?.polymarket ?? null
    });

    return Response.json({ answer });
  } catch (err) {
    console.error(err);
    return Response.json(
      { error: 'Analyst failed', detail: String(err?.message ?? err) },
      { status: 500 }
    );
  }
}
