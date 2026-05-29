'use client';

import { useMemo, useState } from 'react';

const CONTEXT_QUICK = [
  'Will Dembele score?',
  'Summarize this prediction in plain English.',
  'Why might model and Polymarket disagree?',
  'Show latest Polymarket odds.'
];

function MessageBubble({ role, content }) {
  return <div className={`bubble ${role}`}>{content}</div>;
}

function buildContextSummary(predictionContext, polymarketSnapshot) {
  if (!predictionContext) return null;
  const f = predictionContext.fixture;
  const blended = predictionContext.blended;
  const model = predictionContext.model?.outcome;
  const market = predictionContext.market ?? polymarketSnapshot?.implied ?? null;
  const topScore = (predictionContext.topScorelines ?? []).slice(0, 3);
  const topScorers = (predictionContext.topScorers ?? []).slice(0, 10);

  return {
    fixture: f,
    modelProbabilitiesPct: model,
    polymarketProbabilitiesPct: market,
    blendedProbabilitiesPct: blended,
    topScorelines: topScore,
    topScorers,
    expectedStats: predictionContext.expectedStats,
    playerMarkets: polymarketSnapshot?.playerMarkets ?? []
  };
}

export default function AnalystPanel({ predictionContext = null, polymarketSnapshot = null }) {
  const contextSummary = useMemo(
    () => buildContextSummary(predictionContext, polymarketSnapshot),
    [predictionContext, polymarketSnapshot]
  );
  const quickQuestions = contextSummary ? CONTEXT_QUICK : ['Show latest Polymarket odds.'];

  const intro = contextSummary
    ? `Market Analyst is loaded for ${contextSummary.fixture?.homeTeam} vs ${contextSummary.fixture?.awayTeam}. Answers use Polymarket + your model (no Anthropic key needed).`
    : 'Run Predict first to load match context, or ask about Polymarket odds.';

  const [messages, setMessages] = useState([{ role: 'assistant', content: intro }]);
  const [question, setQuestion] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const canSend = useMemo(() => question.trim().length > 0 && !isLoading, [question, isLoading]);

  async function send(customText) {
    const text = (customText ?? question).trim();
    if (!text || isLoading) return;

    setError('');
    setQuestion('');
    setIsLoading(true);

    const conversationHistory = messages.map((m) => ({ role: m.role, content: m.content }));
    setMessages((prev) => [...prev, { role: 'user', content: text }]);

    try {
      const res = await fetch('/api/analyst', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: text,
          history: conversationHistory,
          context: contextSummary,
          polymarket: polymarketSnapshot
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Failed to get answer');
      setMessages((prev) => [...prev, { role: 'assistant', content: data.answer || 'No response returned.' }]);
    } catch (err) {
      setError(err?.message || 'Request failed');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <section className="glass card analystPanel">
      <div className="analystHead">
        <div>
          <div className="analystTitle">Market Analyst</div>
          <div className="analystSub">Powered by live Polymarket data + your prediction model.</div>
        </div>
      </div>

      <div className="quickRow">
        {quickQuestions.map((q) => (
          <button key={q} type="button" disabled={isLoading} className="chip" onClick={() => send(q)}>
            {q}
          </button>
        ))}
      </div>

      <div className="analystChat">
        {messages.map((m, idx) => (
          <MessageBubble key={`${m.role}-${idx}`} role={m.role} content={m.content} />
        ))}
        {isLoading ? <p className="muted small">Loading from Polymarket...</p> : null}
      </div>

      <div className="analystInputRow">
        <textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          placeholder="Ask about Polymarket odds, model edge, value angle..."
          className="analystInput"
        />
        <button type="button" className="btnPrimary" onClick={() => send()} disabled={!canSend}>
          Ask Analyst
        </button>
      </div>

      {error ? <p className="analystError">{error}</p> : null}
    </section>
  );
}
