import React, { useMemo, useState } from 'react';
import { Plus, Trash2, Wallet, X } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { EXPENSE_CATEGORIES, ExpenseCategory, ExpenseRecord } from '../types';
import {
  computeMoneySummary,
  computeMonthlyFinanceSeries,
  FinanceRange,
  formatCurrency,
  formatShortDate,
  isDateInFinanceRange,
} from '../utils/businessLogic';
import { ConfirmDialog } from './ConfirmDialog';

export function MoneyView() {
  const {
    orders,
    payments,
    expenses,
    business,
    todayIso,
    addExpense,
    deleteExpense,
  } = useApp();

  const [range, setRange] = useState<FinanceRange>('last_30');
  const [modalOpen, setModalOpen] = useState(false);
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<ExpenseCategory>('Materials');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(todayIso);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<ExpenseRecord | null>(null);

  const summary = useMemo(
    () => computeMoneySummary(orders, payments, expenses, range, todayIso),
    [orders, payments, expenses, range, todayIso]
  );

  const monthlySeries = useMemo(
    () => computeMonthlyFinanceSeries(payments, orders, expenses, todayIso, 6),
    [payments, orders, expenses, todayIso]
  );

  const maxMonthlyVal = useMemo(
    () => Math.max(20, ...monthlySeries.flatMap((m) => [m.revenue, m.expenses])),
    [monthlySeries]
  );

  const filteredExpenses = useMemo(
    () => expenses.filter((e) => isDateInFinanceRange(e.date, range, todayIso)),
    [expenses, range, todayIso]
  );

  const handleCreateExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    const num = Number(amount);
    if (!description.trim() || !Number.isFinite(num) || num <= 0) return;
    setSaving(true);
    try {
      await addExpense({
        description: description.trim(),
        category,
        amount: num,
        date: date || todayIso,
        notes: notes.trim(),
      });
      setDescription('');
      setAmount('');
      setNotes('');
      setModalOpen(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Header & Range Filter */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h2 className="font-display text-2xl font-semibold text-stone-900 dark:text-zinc-50">
            Money
          </h2>
          <p className="mt-0.5 text-sm text-stone-600 dark:text-zinc-400">
            Simple money in, money out, and what you keep — without accounting jargon.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-1 rounded-xl bg-stone-100 p-1 dark:bg-zinc-900">
            {(
              [
                { id: 'this_month', label: 'This month' },
                { id: 'last_30', label: 'Last 30 days' },
                { id: 'last_90', label: 'Last 90 days' },
                { id: 'all', label: 'All time' },
              ] as { id: FinanceRange; label: string }[]
            ).map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => setRange(r.id)}
                className={`rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                  range === r.id
                    ? 'bg-white text-stone-900 shadow-xs dark:bg-zinc-800 dark:text-zinc-100'
                    : 'text-stone-600 hover:text-stone-900 dark:text-zinc-400'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-stone-900 px-4 py-2 text-sm font-semibold text-white hover:bg-stone-800 whitespace-nowrap shrink-0 dark:bg-zinc-100 dark:text-zinc-900"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Add Expense
          </button>
        </div>
      </div>

      {/* 5 Summary Cards */}
      <section className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-stone-200 bg-stone-200 lg:grid-cols-5 dark:border-zinc-800 dark:bg-zinc-800">
        <div className="bg-white p-5 dark:bg-zinc-900">
          <p className="text-xs font-medium text-stone-500 dark:text-zinc-400">Revenue (orders)</p>
          <p className="mt-2 font-mono text-xl font-semibold text-stone-900 tabular-nums sm:text-2xl dark:text-zinc-100">
            {formatCurrency(summary.revenue, business.currency)}
          </p>
        </div>

        <div className="bg-white p-5 dark:bg-zinc-900">
          <p className="text-xs font-medium text-stone-500 dark:text-zinc-400">Payments received</p>
          <p className="mt-2 font-mono text-xl font-semibold text-stone-900 tabular-nums sm:text-2xl dark:text-zinc-100">
            {formatCurrency(summary.paymentsReceived, business.currency)}
          </p>
        </div>

        <div className="bg-white p-5 dark:bg-zinc-900">
          <p className="text-xs font-medium text-stone-500 dark:text-zinc-400">
            Outstanding payments
          </p>
          <p className="mt-2 font-mono text-xl font-semibold text-amber-700 tabular-nums sm:text-2xl dark:text-amber-400">
            {formatCurrency(summary.outstandingPayments, business.currency)}
          </p>
        </div>

        <div className="bg-white p-5 dark:bg-zinc-900">
          <p className="text-xs font-medium text-stone-500 dark:text-zinc-400">Expenses</p>
          <p className="mt-2 font-mono text-xl font-semibold text-stone-900 tabular-nums sm:text-2xl dark:text-zinc-100">
            {formatCurrency(summary.expensesTotal, business.currency)}
          </p>
        </div>

        <div className="col-span-2 bg-white p-5 lg:col-span-1 dark:bg-zinc-900">
          <p className="text-xs font-medium text-stone-500 dark:text-zinc-400">Estimated profit</p>
          <p
            className={`mt-2 font-mono text-xl font-semibold tabular-nums sm:text-2xl ${
              summary.estimatedProfit >= 0
                ? 'text-emerald-700 dark:text-emerald-400'
                : 'text-red-700 dark:text-red-400'
            }`}
          >
            {formatCurrency(summary.estimatedProfit, business.currency)}
          </p>
        </div>
      </section>

      {/* Monthly Chart */}
      <section className="rounded-2xl border border-stone-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-semibold text-stone-900 dark:text-zinc-100">
              Monthly Payments vs Expenses
            </h3>
            <p className="mt-0.5 text-xs text-stone-500 dark:text-zinc-400">
              Last 6 months comparison
            </p>
          </div>

          <div className="flex items-center gap-4 text-xs text-stone-600 dark:text-zinc-400">
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-xs bg-stone-900 dark:bg-zinc-100" />
              Received
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-xs bg-stone-300 dark:bg-zinc-600" />
              Expenses
            </span>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-6 gap-3 sm:gap-6">
          {monthlySeries.map((m) => {
            const revH = m.revenue === 0 ? 3 : Math.max(8, Math.round((m.revenue / maxMonthlyVal) * 100));
            const expH = m.expenses === 0 ? 3 : Math.max(8, Math.round((m.expenses / maxMonthlyVal) * 100));
            return (
              <div key={m.monthKey} className="flex flex-col items-center">
                <div className="flex h-40 w-full max-w-16 items-end justify-center gap-1.5">
                  <svg
                    viewBox="0 0 10 100"
                    preserveAspectRatio="none"
                    className="h-full w-1/2 overflow-hidden"
                    role="img"
                    aria-label={`${m.label} received: ${formatCurrency(m.revenue, business.currency)}`}
                  >
                    <title>{`${m.label} received: ${formatCurrency(m.revenue, business.currency)}`}</title>
                    <rect
                      x="0"
                      y={100 - revH}
                      width="10"
                      height={revH}
                      className="fill-stone-900 dark:fill-zinc-100"
                    />
                  </svg>
                  <svg
                    viewBox="0 0 10 100"
                    preserveAspectRatio="none"
                    className="h-full w-1/2 overflow-hidden"
                    role="img"
                    aria-label={`${m.label} expenses: ${formatCurrency(m.expenses, business.currency)}`}
                  >
                    <title>{`${m.label} expenses: ${formatCurrency(m.expenses, business.currency)}`}</title>
                    <rect
                      x="0"
                      y={100 - expH}
                      width="10"
                      height={expH}
                      className="fill-stone-300 dark:fill-zinc-600"
                    />
                  </svg>
                </div>
                <span className="mt-2 text-xs font-medium text-stone-600 dark:text-zinc-400">
                  {m.label}
                </span>
                <span className="font-mono text-[11px] text-stone-500 tabular-nums dark:text-zinc-500">
                  {formatCurrency(m.revenue, business.currency)}
                </span>
              </div>
            );
          })}
        </div>
      </section>

      {/* Expenses List */}
      <section className="rounded-2xl border border-stone-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-semibold text-stone-900 dark:text-zinc-100">
              Expenses
            </h3>
            <p className="mt-0.5 text-xs text-stone-500 dark:text-zinc-400">
              Keep track of materials, postage, packaging, and tools
            </p>
          </div>
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="text-xs font-semibold text-stone-900 hover:underline dark:text-zinc-100"
          >
            + Log expense
          </button>
        </div>

        {filteredExpenses.length === 0 ? (
          <div className="py-12 text-center">
            <Wallet className="mx-auto h-7 w-7 text-stone-400 dark:text-zinc-500" />
            <p className="mt-2.5 text-sm font-medium text-stone-800 dark:text-zinc-200">
              No expenses in this period
            </p>
            <p className="mt-1 text-xs text-stone-500 dark:text-zinc-400">
              Log materials, Royal Mail postage, or software costs to keep your estimated profit accurate.
            </p>
          </div>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-stone-200 text-xs font-medium text-stone-500 dark:border-zinc-800 dark:text-zinc-400">
                  <th className="py-2.5 pr-4">Description</th>
                  <th className="py-2.5 px-4">Category</th>
                  <th className="py-2.5 px-4">Date</th>
                  <th className="py-2.5 px-4 text-right">Amount</th>
                  <th className="py-2.5 pl-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 dark:divide-zinc-800/70">
                {filteredExpenses.map((exp) => (
                  <tr key={exp.id}>
                    <td className="py-3 pr-4">
                      <p className="font-medium text-stone-900 dark:text-zinc-100">
                        {exp.description}
                      </p>
                      {exp.notes && (
                        <p className="text-xs text-stone-500 dark:text-zinc-400">{exp.notes}</p>
                      )}
                    </td>
                    <td className="py-3 px-4 text-xs text-stone-600 dark:text-zinc-400">
                      {exp.category}
                    </td>
                    <td className="py-3 px-4 text-xs text-stone-600 whitespace-nowrap dark:text-zinc-400">
                      {formatShortDate(exp.date)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-medium text-stone-900 tabular-nums whitespace-nowrap dark:text-zinc-100">
                      {formatCurrency(exp.amount, business.currency)}
                    </td>
                    <td className="py-3 pl-4 text-right">
                      <button
                        type="button"
                        onClick={() => setConfirmDelete(exp)}
                        aria-label={`Delete expense "${exp.description}"`}
                        className="rounded-lg p-1.5 text-stone-400 hover:bg-stone-100 hover:text-red-600 dark:hover:bg-zinc-800"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Add Expense Modal */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
          aria-labelledby="add-expense-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) setModalOpen(false);
          }}
        >
          <div className="w-full max-w-md rounded-2xl border border-stone-200 bg-white p-6 shadow-2xl dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex items-center justify-between">
              <h3
                id="add-expense-title"
                className="font-display text-lg font-semibold text-stone-900 dark:text-zinc-100"
              >
                Add Expense
              </h3>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                aria-label="Close expense modal"
                className="rounded-lg p-1 text-stone-400 hover:bg-stone-100 dark:hover:bg-zinc-800"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreateExpense} className="mt-4 space-y-4">
              <div>
                <label
                  htmlFor="exp-desc"
                  className="block text-xs font-medium text-stone-700 dark:text-zinc-300"
                >
                  Description *
                </label>
                <input
                  id="exp-desc"
                  type="text"
                  required
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g. Textured cotton card & kraft envelopes"
                  className="mt-1 w-full rounded-xl border border-stone-200 bg-white px-3.5 py-2 text-sm text-stone-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="exp-cat"
                    className="block text-xs font-medium text-stone-700 dark:text-zinc-300"
                  >
                    Category
                  </label>
                  <select
                    id="exp-cat"
                    value={category}
                    onChange={(e) => setCategory(e.target.value as ExpenseCategory)}
                    className="mt-1 w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm text-stone-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                  >
                    {EXPENSE_CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="exp-amt"
                    className="block text-xs font-medium text-stone-700 dark:text-zinc-300"
                  >
                    Amount ({business.currency}) *
                  </label>
                  <input
                    id="exp-amt"
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="14.50"
                    className="mt-1 w-full rounded-xl border border-stone-200 bg-white px-3 py-2 font-mono text-sm text-stone-900 tabular-nums dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="exp-date"
                  className="block text-xs font-medium text-stone-700 dark:text-zinc-300"
                >
                  Date
                </label>
                <input
                  id="exp-date"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm text-stone-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                />
              </div>

              <div>
                <label
                  htmlFor="exp-notes"
                  className="block text-xs font-medium text-stone-700 dark:text-zinc-300"
                >
                  Notes
                </label>
                <input
                  id="exp-notes"
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Optional supplier or receipt note…"
                  className="mt-1 w-full rounded-xl border border-stone-200 bg-white px-3.5 py-2 text-sm text-stone-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="rounded-xl border border-stone-200 px-4 py-2 text-xs font-medium text-stone-700 hover:bg-stone-50 dark:border-zinc-700 dark:text-zinc-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-xl bg-stone-900 px-4 py-2 text-xs font-semibold text-white hover:bg-stone-800 dark:bg-zinc-100 dark:text-zinc-900"
                >
                  {saving ? 'Saving…' : 'Save Expense'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(confirmDelete)}
        title="Delete expense?"
        description={`Remove “${confirmDelete?.description}” from your expense log?`}
        confirmLabel="Delete Expense"
        onCancel={() => setConfirmDelete(null)}
        onConfirm={async () => {
          if (!confirmDelete) return;
          const id = confirmDelete.id;
          setConfirmDelete(null);
          await deleteExpense(id);
        }}
      />
    </div>
  );
}
