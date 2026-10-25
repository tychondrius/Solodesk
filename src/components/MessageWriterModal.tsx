import React, { useEffect, useState } from 'react';
import { Check, Copy, Loader2, Sparkles, X } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { MessagePresetType } from '../types';
import { generateCustomerMessage } from '../services/aiClient';
import { draftMessageLocally, formatCurrency, formatShortDate } from '../utils/businessLogic';

const PRESETS: { id: MessagePresetType; label: string }[] = [
  { id: 'payment_reminder', label: 'Payment reminder' },
  { id: 'order_ready', label: 'Order ready' },
  { id: 'preview_ready', label: 'Preview ready' },
  { id: 'need_info', label: 'Need more information' },
  { id: 'thank_you', label: 'Thank you' },
  { id: 'custom', label: 'Custom' },
];

export function MessageWriterModal() {
  const { messageModal, closeMessageModal, business, showToast } = useApp();
  const [preset, setPreset] = useState<MessagePresetType>('payment_reminder');
  const [customPrompt, setCustomPrompt] = useState('');
  const [messageText, setMessageText] = useState('');
  const [subjectLine, setSubjectLine] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const runGeneration = async (targetPreset: MessagePresetType, customNote: string = '') => {
    const instant = draftMessageLocally({
      preset: targetPreset,
      customerName: messageModal.customerName || 'there',
      businessName: business.name,
      product: messageModal.order?.product,
      remainingFormatted: messageModal.order
        ? formatCurrency(messageModal.order.remainingBalance, business.currency)
        : undefined,
      dueDateFormatted: messageModal.order ? formatShortDate(messageModal.order.dueDate) : undefined,
      customPrompt: customNote,
    });
    setMessageText(instant.message);
    setSubjectLine(instant.subjectLine);
    setLoading(true);
    setCopied(false);
    try {
      const res = await generateCustomerMessage({
        preset: targetPreset,
        customPrompt: customNote,
        customerName: messageModal.customerName || 'there',
        businessName: business.name,
        currency: business.currency,
        order: messageModal.order,
      });
      if (res.source === 'gemini') {
        setMessageText(res.message);
        setSubjectLine(res.subjectLine);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!messageModal.open) return;
    const initial = messageModal.defaultPreset || 'payment_reminder';
    setPreset(initial);
    setCustomPrompt('');
    if (initial !== 'custom') {
      void runGeneration(initial);
    } else {
      setMessageText('');
      setSubjectLine('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messageModal.open, messageModal.customerName, messageModal.order?.id]);

  if (!messageModal.open) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(messageText);
      setCopied(true);
      showToast('Message copied to clipboard — ready to paste.', 'success');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      showToast('Select the message text and copy manually.', 'info');
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="msg-writer-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) closeMessageModal();
      }}
    >
      <div className="w-full max-w-lg rounded-2xl border border-stone-200 bg-white p-6 shadow-2xl dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2
              id="msg-writer-title"
              className="inline-flex items-center gap-2 font-display text-lg font-semibold text-stone-900 dark:text-zinc-100"
            >
              <Sparkles className="h-4 w-4" aria-hidden="true" />
              Write Message for {messageModal.customerName}
            </h2>
            <p className="mt-0.5 text-xs text-stone-500 dark:text-zinc-400">
              Creates an editable draft to copy into WhatsApp, Instagram, Etsy, or email. Never sent automatically.
            </p>
          </div>
          <button
            type="button"
            onClick={closeMessageModal}
            aria-label="Close message writer"
            className="rounded-lg p-1.5 text-stone-400 hover:bg-stone-100 hover:text-stone-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Preset Selector */}
        <div className="mt-4 flex flex-wrap gap-1.5">
          {PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => {
                setPreset(p.id);
                if (p.id !== 'custom') {
                  void runGeneration(p.id);
                }
              }}
              className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                preset === p.id
                  ? 'border-stone-900 bg-stone-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900'
                  : 'border-stone-200 bg-stone-50 text-stone-700 hover:bg-stone-100 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {preset === 'custom' && (
          <div className="mt-4 flex gap-2">
            <input
              type="text"
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              placeholder="e.g. Let her know Royal Mail is delayed by 1 day…"
              className="flex-1 rounded-xl border border-stone-200 bg-white px-3 py-2 text-xs text-stone-900 focus:border-stone-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
            />
            <button
              type="button"
              disabled={loading || !customPrompt.trim()}
              onClick={() => void runGeneration('custom', customPrompt)}
              className="rounded-xl bg-stone-900 px-3.5 py-2 text-xs font-semibold text-white hover:bg-stone-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
            >
              Draft
            </button>
          </div>
        )}

        <div className="mt-4">
          {subjectLine && (
            <p className="mb-2 text-xs text-stone-500 dark:text-zinc-400">
              Email subject: <strong className="text-stone-800 dark:text-zinc-200">{subjectLine}</strong>
            </p>
          )}
          <label htmlFor="ai-msg-textarea" className="sr-only">
            Generated customer message
          </label>
          <div className="relative">
            <textarea
              id="ai-msg-textarea"
              rows={5}
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              placeholder={loading ? 'Writing friendly message…' : 'Your message will appear here…'}
              className="w-full rounded-xl border border-stone-200 bg-stone-50/70 p-3.5 text-sm leading-relaxed text-stone-900 focus:border-stone-500 focus:bg-white focus:outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
            />
            {loading && (
              <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-white/70 dark:bg-zinc-900/70">
                <Loader2 className="h-5 w-5 animate-spin text-stone-700 dark:text-zinc-200" />
              </div>
            )}
          </div>
        </div>

        <div className="mt-5 flex items-center justify-between gap-3">
          <button
            type="button"
            disabled={loading}
            onClick={() => void runGeneration(preset, customPrompt)}
            className="text-xs font-medium text-stone-600 hover:text-stone-900 dark:text-zinc-400 dark:hover:text-zinc-200"
          >
            Regenerate
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={closeMessageModal}
              className="rounded-xl border border-stone-200 px-4 py-2 text-xs font-medium text-stone-700 hover:bg-stone-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              Close
            </button>
            <button
              type="button"
              disabled={!messageText.trim()}
              onClick={() => void handleCopy()}
              className="inline-flex items-center gap-1.5 rounded-xl bg-stone-900 px-4 py-2 text-xs font-semibold text-white hover:bg-stone-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
            >
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? 'Copied!' : 'Copy Message'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
