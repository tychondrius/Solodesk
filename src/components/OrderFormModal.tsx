import React, { useEffect, useState } from 'react';
import { Check, Loader2, Sparkles, X } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { ORDER_STATUSES, OrderStatus, ParsedOrderDraft } from '../types';
import { extractOrderWithAi } from '../services/aiClient';
import {
  addDaysIso,
  calculateOrderBalance,
  formatCurrency,
  isActiveOrderStatus,
} from '../utils/businessLogic';

const DELIVERY_METHODS = [
  'Royal Mail / Post',
  'Tracked Courier',
  'Local Collection',
  'Local Delivery',
  'Digital Download',
];

export function OrderFormModal() {
  const {
    orderModal,
    closeOrderModal,
    customers,
    orders,
    business,
    todayIso,
    saveOrder,
    setActiveSection,
    setSelectedOrderId,
  } = useApp();

  const editing = orderModal.editingOrder;

  const [tab, setTab] = useState<'manual' | 'ai'>('manual');
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiWarning, setAiWarning] = useState<string | null>(null);
  const [parsedDraft, setParsedDraft] = useState<ParsedOrderDraft | null>(null);

  // Form fields
  const [customerId, setCustomerId] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [product, setProduct] = useState('');
  const [description, setDescription] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [totalPrice, setTotalPrice] = useState('');
  const [depositRequired, setDepositRequired] = useState('');
  const [amountPaid, setAmountPaid] = useState('');
  const [orderDate, setOrderDate] = useState(todayIso);
  const [dueDate, setDueDate] = useState(addDaysIso(todayIso, 7));
  const [deliveryMethod, setDeliveryMethod] = useState(DELIVERY_METHODS[0]);
  const [trackingNumber, setTrackingNumber] = useState('');
  const [status, setStatus] = useState<OrderStatus>('New');
  const [customerNotes, setCustomerNotes] = useState('');
  const [internalNotes, setInternalNotes] = useState('');
  const [autoTasks, setAutoTasks] = useState(true);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!orderModal.open) return;
    setFormError(null);
    setAiWarning(null);
    setParsedDraft(null);
    setAiPrompt('');

    if (editing) {
      setTab('manual');
      setCustomerId(editing.customerId);
      setCustomerName(editing.customerName);
      setProduct(editing.product);
      setDescription(editing.description);
      setQuantity(editing.quantity);
      setTotalPrice(String(editing.totalPrice));
      setDepositRequired(String(editing.depositRequired));
      setAmountPaid(String(editing.amountPaid));
      setOrderDate(editing.orderDate || todayIso);
      setDueDate(editing.dueDate || '');
      setDeliveryMethod(editing.deliveryMethod || DELIVERY_METHODS[0]);
      setTrackingNumber(editing.trackingNumber || '');
      setStatus(editing.status);
      setCustomerNotes(editing.customerNotes || '');
      setInternalNotes(editing.internalNotes || '');
    } else {
      setTab(orderModal.initialTab);
      setCustomerId('');
      setCustomerName('');
      setProduct('');
      setDescription('');
      setQuantity(1);
      setTotalPrice('');
      setDepositRequired('');
      setAmountPaid('0');
      setOrderDate(todayIso);
      setDueDate(addDaysIso(todayIso, 7));
      setDeliveryMethod(DELIVERY_METHODS[0]);
      setTrackingNumber('');
      setStatus('New');
      setCustomerNotes('');
      setInternalNotes('');
      setAutoTasks(true);
    }
  }, [orderModal.open, orderModal.initialTab, editing, todayIso]);

  if (!orderModal.open) return null;

  const activeOrderCount = orders.filter(
    (o) => !o.archived && isActiveOrderStatus(o.status)
  ).length;
  const hitFreeLimit = !editing && business.plan === 'free' && activeOrderCount >= 10;

  const computedBal = calculateOrderBalance(
    Number(totalPrice) || 0,
    Number(amountPaid) || 0,
    Number(depositRequired) || 0
  );

  const handleExtractAi = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!aiPrompt.trim()) {
      setFormError('Please type or paste a natural-language description of the order first.');
      return;
    }
    setFormError(null);
    setAiWarning(null);
    setAiLoading(true);
    try {
      const result = await extractOrderWithAi({
        prompt: aiPrompt.trim(),
        currency: business.currency,
        todayIso,
      });
      setParsedDraft(result.draft);
      if (result.warning) {
        setAiWarning(result.warning);
      }
    } finally {
      setAiLoading(false);
    }
  };

  const handleConfirmAiDraft = async () => {
    if (!parsedDraft) return;
    if (!parsedDraft.customerName.trim() || !parsedDraft.product.trim()) {
      setFormError('Customer name and product are required before saving.');
      return;
    }
    setSaving(true);
    try {
      const created = await saveOrder(
        {
          customerId: '',
          customerName: parsedDraft.customerName.trim(),
          product: parsedDraft.product.trim(),
          description: parsedDraft.extras
            ? `${parsedDraft.description || parsedDraft.product} (Extras: ${parsedDraft.extras})`
            : parsedDraft.description || parsedDraft.product,
          quantity: parsedDraft.quantity || 1,
          totalPrice: Number(parsedDraft.totalPrice) || 0,
          depositRequired: Number(parsedDraft.depositPaid) || 0,
          amountPaid: Number(parsedDraft.depositPaid) || 0,
          orderDate: todayIso,
          dueDate: parsedDraft.dueDate || addDaysIso(todayIso, 7),
          deliveryMethod: parsedDraft.deliveryMethod || DELIVERY_METHODS[0],
          trackingNumber: '',
          status: Number(parsedDraft.depositPaid) > 0 ? 'In Progress' : 'New',
          archived: false,
          customerNotes: parsedDraft.customerNotes || aiPrompt.trim(),
          internalNotes: '',
        },
        {
          autoCreateTasks: true,
          customTasks: parsedDraft.suggestedTasks,
        }
      );
      closeOrderModal();
      setActiveSection('orders');
      setSelectedOrderId(created.id);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Unable to save order.');
    } finally {
      setSaving(false);
    }
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName.trim() || !product.trim()) {
      setFormError('Please enter both a customer name and a product/service.');
      return;
    }
    const numericTotal = Number(totalPrice);
    if (!Number.isFinite(numericTotal) || numericTotal < 0) {
      setFormError('Please enter a valid total price.');
      return;
    }

    setFormError(null);
    setSaving(true);
    try {
      const saved = await saveOrder(
        {
          id: editing?.id,
          orderNumber: editing?.orderNumber,
          customerId,
          customerName: customerName.trim(),
          product: product.trim(),
          description: description.trim(),
          quantity: Math.max(1, Number(quantity) || 1),
          totalPrice: numericTotal,
          depositRequired: Math.max(0, Number(depositRequired) || 0),
          amountPaid: Math.max(0, Number(amountPaid) || 0),
          orderDate,
          dueDate,
          deliveryMethod,
          trackingNumber: trackingNumber.trim(),
          status,
          archived: editing?.archived || false,
          customerNotes: customerNotes.trim(),
          internalNotes: internalNotes.trim(),
        },
        { autoCreateTasks: !editing && autoTasks }
      );
      closeOrderModal();
      setSelectedOrderId(saved.id);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Unable to save order.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="order-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) closeOrderModal();
      }}
    >
      <div className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-900">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-stone-200 px-6 py-4 dark:border-zinc-800">
          <div>
            <h2
              id="order-modal-title"
              className="font-display text-lg font-semibold text-stone-900 dark:text-zinc-100"
            >
              {editing ? `Edit Order ${editing.orderNumber}` : 'New Order'}
            </h2>
          </div>

          <div className="flex items-center gap-3">
            {!editing && (
              <div className="flex items-center gap-1 rounded-lg bg-stone-100 p-1 dark:bg-zinc-800">
                <button
                  type="button"
                  onClick={() => setTab('manual')}
                  className={`rounded-md px-3 py-1 text-xs font-medium transition-colors whitespace-nowrap ${
                    tab === 'manual'
                      ? 'bg-white text-stone-900 shadow-xs dark:bg-zinc-900 dark:text-zinc-100'
                      : 'text-stone-600 hover:text-stone-900 dark:text-zinc-400'
                  }`}
                >
                  Order Form
                </button>
                <button
                  type="button"
                  onClick={() => setTab('ai')}
                  className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-medium transition-colors whitespace-nowrap ${
                    tab === 'ai'
                      ? 'bg-white text-stone-900 shadow-xs dark:bg-zinc-900 dark:text-zinc-100'
                      : 'text-stone-600 hover:text-stone-900 dark:text-zinc-400'
                  }`}
                >
                  <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                  Create with AI
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={closeOrderModal}
              aria-label="Close new order modal"
              className="rounded-lg p-1.5 text-stone-400 hover:bg-stone-100 hover:text-stone-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="overflow-y-auto p-6">
          {hitFreeLimit && (
            <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
              <p className="font-semibold">Free plan limit reached (10 active orders)</p>
              <p className="mt-1">
                Complete or archive an older order, or switch to the Solo plan preview in Settings for unlimited orders.
              </p>
              <button
                type="button"
                onClick={() => {
                  closeOrderModal();
                  setActiveSection('settings');
                }}
                className="mt-2 font-semibold underline"
              >
                Open Plan Settings &rarr;
              </button>
            </div>
          )}

          {formError && (
            <div
              role="alert"
              className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300"
            >
              {formError}
            </div>
          )}

          {tab === 'ai' && !editing ? (
            <div className="space-y-5">
              <form onSubmit={handleExtractAi}>
                <label
                  htmlFor="ai-order-prompt"
                  className="block text-sm font-medium text-stone-800 dark:text-zinc-200"
                >
                  Describe the order naturally…
                </label>
                <p className="mt-0.5 text-xs text-stone-500 dark:text-zinc-400">
                  Mention the customer, item, price, deposit paid, and when they need it.
                </p>
                <textarea
                  id="ai-order-prompt"
                  rows={4}
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  placeholder="Sarah ordered an A4 couple portrait for £20 plus a pet for £2. She paid £11 deposit and needs it by 14 November."
                  className="mt-2.5 w-full rounded-xl border border-stone-200 bg-stone-50/70 p-3.5 text-sm text-stone-900 placeholder:text-stone-400 focus:border-stone-500 focus:bg-white focus:outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                />

                <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setAiPrompt(
                        'Sarah ordered an A4 couple portrait for £20 plus a pet for £2. She paid £11 deposit and needs it by 14 November.'
                      )
                    }
                    className="text-xs font-medium text-stone-500 underline hover:text-stone-800 dark:text-zinc-400 dark:hover:text-zinc-200"
                  >
                    Try example text
                  </button>

                  <button
                    type="submit"
                    disabled={aiLoading || hitFreeLimit}
                    className="inline-flex items-center gap-2 rounded-xl bg-stone-900 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-stone-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
                  >
                    {aiLoading ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        Extracting details…
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-3.5 w-3.5" />
                        Extract Order Details
                      </>
                    )}
                  </button>
                </div>
              </form>

              {aiWarning && (
                <div className="rounded-xl border border-stone-200 bg-stone-50 p-3 text-xs text-stone-600 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400">
                  {aiWarning}
                </div>
              )}

              {parsedDraft && (
                <div className="rounded-2xl border border-stone-200 bg-stone-50/80 p-5 dark:border-zinc-800 dark:bg-zinc-950">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-stone-900 dark:text-zinc-100">
                      I understood:
                    </h3>
                    <span className="text-xs text-stone-500 dark:text-zinc-400">
                      Review &amp; edit anything before confirming
                    </span>
                  </div>

                  <div className="mt-4 grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                    <div>
                      <label
                        htmlFor="ai-draft-customer"
                        className="block text-xs font-medium text-stone-600 dark:text-zinc-400"
                      >
                        Customer
                      </label>
                      <input
                        id="ai-draft-customer"
                        type="text"
                        value={parsedDraft.customerName}
                        onChange={(e) =>
                          setParsedDraft({ ...parsedDraft, customerName: e.target.value })
                        }
                        className="mt-1 w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm text-stone-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="ai-draft-product"
                        className="block text-xs font-medium text-stone-600 dark:text-zinc-400"
                      >
                        Product
                      </label>
                      <input
                        id="ai-draft-product"
                        type="text"
                        value={parsedDraft.product}
                        onChange={(e) =>
                          setParsedDraft({ ...parsedDraft, product: e.target.value })
                        }
                        className="mt-1 w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm text-stone-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="ai-draft-extras"
                        className="block text-xs font-medium text-stone-600 dark:text-zinc-400"
                      >
                        Extras
                      </label>
                      <input
                        id="ai-draft-extras"
                        type="text"
                        value={parsedDraft.extras}
                        placeholder="None"
                        onChange={(e) =>
                          setParsedDraft({ ...parsedDraft, extras: e.target.value })
                        }
                        className="mt-1 w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm text-stone-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="ai-draft-due"
                        className="block text-xs font-medium text-stone-600 dark:text-zinc-400"
                      >
                        Due ({parsedDraft.dueDateDisplay})
                      </label>
                      <input
                        id="ai-draft-due"
                        type="date"
                        value={parsedDraft.dueDate}
                        onChange={(e) =>
                          setParsedDraft({ ...parsedDraft, dueDate: e.target.value })
                        }
                        className="mt-1 w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm text-stone-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="ai-draft-total"
                        className="block text-xs font-medium text-stone-600 dark:text-zinc-400"
                      >
                        Total ({business.currency})
                      </label>
                      <input
                        id="ai-draft-total"
                        type="number"
                        step="0.01"
                        min="0"
                        value={parsedDraft.totalPrice}
                        onChange={(e) => {
                          const tot = Math.max(0, Number(e.target.value) || 0);
                          setParsedDraft({
                            ...parsedDraft,
                            totalPrice: tot,
                            remainingBalance: Math.max(0, tot - parsedDraft.depositPaid),
                          });
                        }}
                        className="mt-1 w-full rounded-lg border border-stone-200 bg-white px-3 py-2 font-mono text-sm text-stone-900 tabular-nums dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="ai-draft-paid"
                        className="block text-xs font-medium text-stone-600 dark:text-zinc-400"
                      >
                        Paid ({business.currency})
                      </label>
                      <input
                        id="ai-draft-paid"
                        type="number"
                        step="0.01"
                        min="0"
                        value={parsedDraft.depositPaid}
                        onChange={(e) => {
                          const pd = Math.max(0, Number(e.target.value) || 0);
                          setParsedDraft({
                            ...parsedDraft,
                            depositPaid: pd,
                            remainingBalance: Math.max(0, parsedDraft.totalPrice - pd),
                          });
                        }}
                        className="mt-1 w-full rounded-lg border border-stone-200 bg-white px-3 py-2 font-mono text-sm text-stone-900 tabular-nums dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                      />
                    </div>
                  </div>

                  <div className="mt-4 flex items-center justify-between border-t border-stone-200 pt-3 text-xs dark:border-zinc-800">
                    <span className="text-stone-600 dark:text-zinc-400">
                      Remaining balance:{' '}
                      <strong className="font-mono text-stone-900 tabular-nums dark:text-zinc-100">
                        {formatCurrency(
                          Math.max(0, parsedDraft.totalPrice - parsedDraft.depositPaid),
                          business.currency
                        )}
                      </strong>
                    </span>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setCustomerName(parsedDraft.customerName);
                          setProduct(parsedDraft.product);
                          setDescription(
                            parsedDraft.extras
                              ? `${parsedDraft.product} (+ ${parsedDraft.extras})`
                              : parsedDraft.description
                          );
                          setTotalPrice(String(parsedDraft.totalPrice));
                          setDepositRequired(String(parsedDraft.depositPaid));
                          setAmountPaid(String(parsedDraft.depositPaid));
                          setDueDate(parsedDraft.dueDate);
                          setDeliveryMethod(parsedDraft.deliveryMethod);
                          setCustomerNotes(parsedDraft.customerNotes);
                          setTab('manual');
                        }}
                        className="rounded-lg border border-stone-200 bg-white px-3 py-2 font-medium text-stone-700 hover:bg-stone-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
                      >
                        Open Full Form
                      </button>

                      <button
                        type="button"
                        disabled={saving || hitFreeLimit}
                        onClick={() => void handleConfirmAiDraft()}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-stone-900 px-4 py-2 font-semibold text-white hover:bg-stone-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
                      >
                        <Check className="h-3.5 w-3.5" />
                        {saving ? 'Saving…' : 'Confirm & Save Order'}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <form onSubmit={handleManualSubmit} className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="ord-cust-name"
                    className="block text-xs font-medium text-stone-700 dark:text-zinc-300"
                  >
                    Customer *
                  </label>
                  <input
                    id="ord-cust-name"
                    list="existing-customers-list"
                    required
                    value={customerName}
                    onChange={(e) => {
                      const val = e.target.value;
                      setCustomerName(val);
                      const match = customers.find(
                        (c) => c.name.toLowerCase() === val.trim().toLowerCase()
                      );
                      setCustomerId(match ? match.id : '');
                    }}
                    placeholder="e.g. Emma Thompson"
                    className="mt-1 w-full rounded-xl border border-stone-200 bg-white px-3.5 py-2 text-sm text-stone-900 focus:border-stone-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                  />
                  <datalist id="existing-customers-list">
                    {customers.map((c) => (
                      <option key={c.id} value={c.name} />
                    ))}
                  </datalist>
                </div>

                <div>
                  <label
                    htmlFor="ord-product"
                    className="block text-xs font-medium text-stone-700 dark:text-zinc-300"
                  >
                    Product / Service *
                  </label>
                  <input
                    id="ord-product"
                    type="text"
                    required
                    value={product}
                    onChange={(e) => setProduct(e.target.value)}
                    placeholder="e.g. A4 Couple Portrait"
                    className="mt-1 w-full rounded-xl border border-stone-200 bg-white px-3.5 py-2 text-sm text-stone-900 focus:border-stone-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="ord-desc"
                  className="block text-xs font-medium text-stone-700 dark:text-zinc-300"
                >
                  Description
                </label>
                <input
                  id="ord-desc"
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Sizing, materials, colours, or extras…"
                  className="mt-1 w-full rounded-xl border border-stone-200 bg-white px-3.5 py-2 text-sm text-stone-900 focus:border-stone-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                />
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div>
                  <label
                    htmlFor="ord-qty"
                    className="block text-xs font-medium text-stone-700 dark:text-zinc-300"
                  >
                    Quantity
                  </label>
                  <input
                    id="ord-qty"
                    type="number"
                    min="1"
                    value={quantity}
                    onChange={(e) => setQuantity(Math.max(1, Number(e.target.value) || 1))}
                    className="mt-1 w-full rounded-xl border border-stone-200 bg-white px-3 py-2 font-mono text-sm text-stone-900 tabular-nums dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                  />
                </div>

                <div>
                  <label
                    htmlFor="ord-total"
                    className="block text-xs font-medium text-stone-700 dark:text-zinc-300"
                  >
                    Total price ({business.currency}) *
                  </label>
                  <input
                    id="ord-total"
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={totalPrice}
                    onChange={(e) => setTotalPrice(e.target.value)}
                    placeholder="22.00"
                    className="mt-1 w-full rounded-xl border border-stone-200 bg-white px-3 py-2 font-mono text-sm text-stone-900 tabular-nums dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                  />
                </div>

                <div>
                  <label
                    htmlFor="ord-dep-req"
                    className="block text-xs font-medium text-stone-700 dark:text-zinc-300"
                  >
                    Deposit required
                  </label>
                  <input
                    id="ord-dep-req"
                    type="number"
                    step="0.01"
                    min="0"
                    value={depositRequired}
                    onChange={(e) => setDepositRequired(e.target.value)}
                    placeholder="0.00"
                    className="mt-1 w-full rounded-xl border border-stone-200 bg-white px-3 py-2 font-mono text-sm text-stone-900 tabular-nums dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                  />
                </div>

                <div>
                  <label
                    htmlFor="ord-paid"
                    className="block text-xs font-medium text-stone-700 dark:text-zinc-300"
                  >
                    Amount paid
                  </label>
                  <input
                    id="ord-paid"
                    type="number"
                    step="0.01"
                    min="0"
                    value={amountPaid}
                    onChange={(e) => setAmountPaid(e.target.value)}
                    placeholder="0.00"
                    className="mt-1 w-full rounded-xl border border-stone-200 bg-white px-3 py-2 font-mono text-sm text-stone-900 tabular-nums dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div>
                  <label
                    htmlFor="ord-due"
                    className="block text-xs font-medium text-stone-700 dark:text-zinc-300"
                  >
                    Due date
                  </label>
                  <input
                    id="ord-due"
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm text-stone-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                  />
                </div>

                <div>
                  <label
                    htmlFor="ord-delivery"
                    className="block text-xs font-medium text-stone-700 dark:text-zinc-300"
                  >
                    Delivery method
                  </label>
                  <select
                    id="ord-delivery"
                    value={deliveryMethod}
                    onChange={(e) => setDeliveryMethod(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm text-stone-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                  >
                    {DELIVERY_METHODS.map((dm) => (
                      <option key={dm} value={dm}>
                        {dm}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="ord-status"
                    className="block text-xs font-medium text-stone-700 dark:text-zinc-300"
                  >
                    Status
                  </label>
                  <select
                    id="ord-status"
                    value={status}
                    onChange={(e) => setStatus(e.target.value as OrderStatus)}
                    className="mt-1 w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm text-stone-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                  >
                    {ORDER_STATUSES.map((st) => (
                      <option key={st} value={st}>
                        {st}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="ord-cust-notes"
                    className="block text-xs font-medium text-stone-700 dark:text-zinc-300"
                  >
                    Customer notes (personalisation / message)
                  </label>
                  <textarea
                    id="ord-cust-notes"
                    rows={2}
                    value={customerNotes}
                    onChange={(e) => setCustomerNotes(e.target.value)}
                    placeholder="Personalisation wording, gift wrap note…"
                    className="mt-1 w-full rounded-xl border border-stone-200 bg-white p-2.5 text-sm text-stone-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                  />
                </div>

                <div>
                  <label
                    htmlFor="ord-int-notes"
                    className="block text-xs font-medium text-stone-700 dark:text-zinc-300"
                  >
                    Internal studio notes
                  </label>
                  <textarea
                    id="ord-int-notes"
                    rows={2}
                    value={internalNotes}
                    onChange={(e) => setInternalNotes(e.target.value)}
                    placeholder="Private notes on materials, progress, or tracking…"
                    className="mt-1 w-full rounded-xl border border-stone-200 bg-white p-2.5 text-sm text-stone-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                  />
                </div>
              </div>

              {!editing && (
                <label className="flex items-center gap-2.5 text-xs text-stone-600 dark:text-zinc-400">
                  <input
                    type="checkbox"
                    checked={autoTasks}
                    onChange={(e) => setAutoTasks(e.target.checked)}
                    className="h-4 w-4 rounded border-stone-300"
                  />
                  <span>Automatically generate checklist tasks for this order</span>
                </label>
              )}

              <div className="flex items-center justify-between border-t border-stone-200 pt-4 dark:border-zinc-800">
                <div className="text-xs text-stone-600 dark:text-zinc-400">
                  Remaining balance:{' '}
                  <strong className="font-mono text-stone-900 tabular-nums dark:text-zinc-100">
                    {formatCurrency(computedBal.remainingBalance, business.currency)}
                  </strong>
                </div>

                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={closeOrderModal}
                    className="rounded-xl border border-stone-200 px-4 py-2 text-xs font-medium text-stone-700 hover:bg-stone-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving || hitFreeLimit}
                    className="rounded-xl bg-stone-900 px-5 py-2 text-xs font-semibold text-white hover:bg-stone-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
                  >
                    {saving ? 'Saving…' : editing ? 'Save Changes' : 'Create Order'}
                  </button>
                </div>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
