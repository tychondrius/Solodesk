import React, { useState } from 'react';
import { ArrowRight, Loader2, Send, Sparkles } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { AssistantResponse } from '../types';
import { askBusinessAssistant } from '../services/aiClient';

const SUGGESTED_PROMPTS = [
  'Who owes me money?',
  'What orders are due this week?',
  'How much did I make this month?',
  'What expenses did I have?',
  'What should I work on today?',
  'Which customers are waiting for something?',
  'Show my overdue orders.',
  'Which product made me the most money?',
];

interface Turn {
  id: string;
  question: string;
  answer: AssistantResponse;
  warning?: string;
}

export function AiAssistantView() {
  const {
    business,
    orders,
    customers,
    payments,
    expenses,
    tasks,
    todayIso,
    setActiveSection,
    setSelectedOrderId,
    setSelectedCustomerId,
  } = useApp();

  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [turns, setTurns] = useState<Turn[]>([]);

  const handleAsk = async (questionText: string) => {
    const q = questionText.trim();
    if (!q || loading) return;
    setInput('');
    setLoading(true);
    try {
      const { response, warning } = await askBusinessAssistant({
        question: q,
        businessName: business.name,
        currency: business.currency,
        todayIso,
        orders,
        customers,
        payments,
        expenses,
        tasks,
      });
      setTurns((prev) => [
        ...prev,
        {
          id: `turn_${Date.now()}`,
          question: q,
          answer: response,
          warning,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h2 className="font-display text-2xl font-semibold text-stone-900 dark:text-zinc-50">
          AI Business Assistant
        </h2>
        <p className="mt-0.5 text-sm text-stone-600 dark:text-zinc-400">
          Ask plain-English questions about {business.name}’s orders, payments, customers, and schedule.
        </p>
      </div>

      {/* Suggested Prompts */}
      <div className="rounded-2xl border border-stone-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <p className="text-xs font-medium text-stone-500 dark:text-zinc-400">
          Suggested questions
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {SUGGESTED_PROMPTS.map((prompt) => (
            <button
              key={prompt}
              type="button"
              disabled={loading}
              onClick={() => void handleAsk(prompt)}
              className="rounded-xl border border-stone-200 bg-stone-50 px-3.5 py-2 text-xs font-medium text-stone-800 transition-colors hover:bg-stone-100 disabled:opacity-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              {prompt}
            </button>
          ))}
        </div>
      </div>

      {/* Conversation History */}
      {turns.length > 0 && (
        <div className="space-y-5">
          {turns.map((turn) => (
            <div key={turn.id} className="space-y-3">
              {/* User Question */}
              <div className="flex justify-end">
                <div className="max-w-md rounded-2xl bg-stone-900 px-4 py-2.5 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900">
                  {turn.question}
                </div>
              </div>

              {/* Assistant Visual Card */}
              <div className="rounded-2xl border border-stone-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
                <div className="flex items-start gap-2.5">
                  <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-stone-700 dark:text-zinc-300" />
                  <div className="min-w-0 flex-1">
                    <p className="text-base font-semibold text-stone-900 dark:text-zinc-100">
                      {turn.answer.headline}
                    </p>
                    {turn.answer.summary && (
                      <p className="mt-1 text-sm text-stone-600 dark:text-zinc-400">
                        {turn.answer.summary}
                      </p>
                    )}

                    {/* Structured Visual Items */}
                    {turn.answer.visualType === 'metrics' && turn.answer.items.length > 0 && (
                      <div className="mt-4 grid grid-cols-2 gap-4 border-t border-stone-100 pt-4 sm:grid-cols-4 dark:border-zinc-800">
                        {turn.answer.items.map((item, idx) => (
                          <div key={`${turn.id}_m_${idx}`}>
                            <p className="text-[11px] text-stone-500 dark:text-zinc-400">
                              {item.label}
                            </p>
                            <p className="mt-1 font-mono text-base font-semibold text-stone-900 tabular-nums dark:text-zinc-100">
                              {item.value}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}

                    {turn.answer.visualType !== 'metrics' && turn.answer.items.length > 0 && (
                      <div className="mt-4 divide-y divide-stone-100 border-t border-stone-100 dark:divide-zinc-800 dark:border-zinc-800">
                        {turn.answer.items.map((item, idx) => {

                          const clickable = Boolean(
                            item.relatedOrderId || item.relatedCustomerId
                          );
                          return (
                            <div
                              key={`${turn.id}_i_${idx}`}
                              className="flex items-center justify-between gap-4 py-2.5 text-sm"
                            >
                              <div className="min-w-0">
                                {clickable ? (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (item.relatedOrderId) {
                                        setActiveSection('orders');
                                        setSelectedOrderId(item.relatedOrderId);
                                      } else if (item.relatedCustomerId) {
                                        setActiveSection('customers');
                                        setSelectedCustomerId(item.relatedCustomerId);
                                      }
                                    }}
                                    className="font-medium text-stone-900 underline underline-offset-4 hover:text-stone-700 dark:text-zinc-100"
                                  >
                                    {item.label}
                                  </button>
                                ) : (
                                  <p className="font-medium text-stone-900 dark:text-zinc-100">
                                    {item.label}
                                  </p>
                                )}
                                {item.sublabel && (
                                  <p className="text-xs text-stone-500 dark:text-zinc-400">
                                    {item.sublabel}
                                  </p>
                                )}
                              </div>

                              <span className="shrink-0 font-mono text-sm font-semibold text-stone-900 tabular-nums dark:text-zinc-100">
                                {item.value}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Optional Total Footer */}
                    {turn.answer.footerLabel && turn.answer.footerValue && (
                      <div className="mt-3 flex items-center justify-between border-t border-stone-200 pt-3 text-sm font-semibold text-stone-900 dark:border-zinc-700 dark:text-zinc-100">
                        <span>{turn.answer.footerLabel}</span>
                        <span className="font-mono tabular-nums">{turn.answer.footerValue}</span>
                      </div>
                    )}

                    {/* Follow-up Suggestions */}
                    {turn.answer.followUpSuggestions.length > 0 && (
                      <div className="mt-4 flex flex-wrap gap-2">
                        {turn.answer.followUpSuggestions.map((sug) => (
                          <button
                            key={sug}
                            type="button"
                            onClick={() => void handleAsk(sug)}
                            className="inline-flex items-center gap-1 text-xs font-medium text-stone-600 hover:text-stone-900 dark:text-zinc-400 dark:hover:text-zinc-200"
                          >
                            <span>{sug}</span>
                            <ArrowRight className="h-3 w-3" />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {loading && (
        <div className="flex items-center gap-2.5 rounded-2xl border border-stone-200 bg-white p-5 text-sm text-stone-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Checking your orders and balances…</span>
        </div>
      )}

      {/* Ask Form */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void handleAsk(input);
        }}
        className="flex items-center gap-2 rounded-2xl border border-stone-200 bg-white p-2 shadow-xs dark:border-zinc-800 dark:bg-zinc-900"
      >
        <label htmlFor="assistant-question-input" className="sr-only">
          Ask SoloDesk AI Assistant
        </label>
        <input
          id="assistant-question-input"
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask anything about your orders, payments, or deadlines…"
          className="flex-1 bg-transparent px-3 py-2 text-sm text-stone-900 placeholder:text-stone-400 focus:outline-none dark:text-zinc-100"
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          aria-label="Send question"
          className="inline-flex items-center gap-1.5 rounded-xl bg-stone-900 px-4 py-2.5 text-xs font-semibold text-white hover:bg-stone-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
        >
          <Send className="h-3.5 w-3.5" />
          Ask
        </button>
      </form>
    </div>
  );
}
