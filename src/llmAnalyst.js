import { compactAnalystBundle } from './analystContext.js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.join(__dirname, '..');
dotenv.config({ path: path.join(appRoot, '.env.local') });
dotenv.config({ path: path.join(appRoot, '.env') });

export const GROQ_MODEL = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

export function getGroqApiKey() {
  return process.env.GROQ_API_KEY || process.env.GROQ_KEY || '';
}

function buildSystemPrompt(bundle) {
  const hasPrediction = Boolean(bundle?.probabilities || bundle?.modelProbabilities);

  return `You are an expert UEFA Champions League Final analyst embedded in a prediction app (PSG vs Arsenal, 2026 final in Budapest).

Your job: answer ANY user question clearly — tactics, form, betting angles, player props, scorelines, model vs market disagreement, historical context, hypotheticals, and plain-English summaries.

Guidelines:
1. Ground all NUMBERS (probabilities, xG, shots, scorer %, odds) in APP_CONTEXT JSON below. Do not invent stats not in context.
2. You MAY use general football knowledge for tactics, styles, and narrative (pressing, transitions, key players) when not contradicting the data.
3. If APP_CONTEXT is empty or missing predictions, tell the user to open the Predictions tab and press Predict — but still answer general UCL/final questions helpfully.
4. For completely unrelated topics (homework, code, other sports), briefly redirect to the final or prediction markets.
5. Structure longer answers with short paragraphs or bullets. Be direct and confident but not reckless.
6. When discussing betting/Polymarket, note uncertainty; this is not financial advice.
7. If asked about a player, check playerProps categories, goalscorer list, and roster propProfile data in context first.

${hasPrediction ? 'Prediction data is loaded — use it.' : 'No prediction run yet — user should press Predict for full numbers.'}

APP_CONTEXT:
${JSON.stringify(compactAnalystBundle(bundle) ?? {}, null, 2)}`;
}

function trimHistory(history, maxTurns = 10) {
  return (history ?? [])
    .filter((m) => m?.role === 'user' || m?.role === 'assistant')
    .filter((m) => String(m.content ?? '').length < 4000)
    .slice(-maxTurns * 2)
    .map((m) => ({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: String(m.content ?? '').slice(0, 3500)
    }));
}

export async function askGroq({ question, bundle, history }) {
  const apiKey = getGroqApiKey();
  if (!apiKey) return null;

  const prior = trimHistory(history);
  const messages = [
    { role: 'system', content: buildSystemPrompt(bundle) },
    ...prior,
    { role: 'user', content: question }
  ];

  const res = await fetch(GROQ_API_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      max_tokens: 2048,
      temperature: 0.65,
      messages
    })
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Groq API error (${res.status}): ${errText.slice(0, 400)}`);
  }

  const data = await res.json();
  const text = data.choices?.[0]?.message?.content;
  if (!text?.trim()) throw new Error('Empty response from Groq');
  return text.trim();
}
