import React, { useMemo, useState } from 'react';
import {
  ArrowRight,
  Plus,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import {
  computeDailyRevenueSeries,
  computeDashboardMetrics,
  computeSmartInsights,
  computeTodaysFocus,
  formatCurrency,
  formatRelativeDue,
  formatShortDate,
  getTimeGreeting,
} from '../utils/businessLogic';
import { FocusItem, OrderStatus, SmartInsight } from '../types';
import { fetchAiBusinessInsights } from '../services/aiClient';

export function statusTextClass(status: OrderStatus): string {
  switch (status) {
    case 'Completed':
      return 'text-emerald-700 dark:text-emerald-400';
    case 'Ready':
    case 'Dispatched':
      return 'text-indigo-700 dark:text-indigo-400';
    case 'Waiting for Customer':
      return 'text-amber-700 dark:text-amber-400';
    case 'Cancelled':
      return 'text-stone-400 line-through dark:text-zinc-500';
    default:
      return 'text-stone-700 dark:text-zinc-300';
  }
}

export function DashboardView() {
  const {
    business,
    orders,
    payments,
    expenses,
    tasks,
    todayIso,
    setActiveSection,
    setSelectedOrderId,
    setOrdersStatusFilter,
    openOrderModal,
    updateOrderStatus,
    toggleTask,
  } = useApp();

  const [aiInsights, setAiInsights] = useState<SmartInsight[] | null>(null);
  const [refreshingInsights, setRefreshingInsights] = useState(false);
  const [hoveredBarIdx, setHoveredBarIdx] = useState<number | null>(null);

  const greeting = useMemo(
    () => getTimeGreeting(new Date().getHours(), business.ownerName),
    [business.ownerName]
  );

  const metrics = useMemo(
    () => computeDashboardMetrics(orders, payments, todayIso),
    [orders, payments, todayIso]
  );

  const focusItems = useMemo(
    () => computeTodaysFocus(orders, tasks, business.currency, todayIso),
    [orders, tasks, business.currency, todayIso]
  );

  const defaultInsights = useMemo(
    () => computeSmartInsights(orders, payments, business.currency, todayIso),
    [orders, payments, business.currency, todayIso]
  );

  const insights = aiInsights || defaultInsights;

  const recentOrders = useMemo(
    () =>
      [...orders]
        .filter((o) => !o.archived)
        .sort((a, b) => b.orderDate.localeCompare(a.orderDate))
        .slice(0, 6),
    [orders]
  );

  const revenueSeries = useMemo(
    () => computeDailyRevenueSeries(payments, orders, todayIso, 30),
    [payments, orders, todayIso]
  );

  const maxDaily = useMemo(
    () => Math.max(10, ...revenueSeries.map((d) => d.amount)),
    [revenueSeries]
  );

  const thirtyDayTotal = useMemo(
    () => revenueSeries.reduce((s, d) => s + d.amount, 0),
    [revenueSeries]
  );

  const handleFocusAction = async (item: FocusItem) => {
    if (item.actionType === 'mark_dispatched' && item.targetId) {
      await updateOrderStatus(item.targetId, 'Dispatched');
      return;
    }
    if (item.actionType === 'complete_task' && item.targetId) {
      await toggleTask(item.targetId);
      return;
    }
    if (item.actionType === 'filter_waiting') {
      setOrdersStatusFilter('Waiting for Customer');
      setActiveSection('orders');
      return;
    }
    if (item.targetId) {
      setActiveSection('orders');
      setSelectedOrderId(item.targetId);
    }
  };

  const handleRefreshInsights = async () => {
    setRefreshingInsights(true);
    const fresh = await fetchAiBusinessInsights({
      businessName: business.name,
      currency: business.currency,
      todayIso,
      orders,
      payments,
      expenses,
    });
    if (fresh) setAiInsights(fresh);
    setRefreshingInsights(false);
  };

  return (
    <div className="space-y-8">
      {/* Greeting & Quick Actions */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h2 className="font-display text-2xl font-semibold tracking-tight text-stone-900 sm:text-3xl dark:text-zinc-50">
            {greeting}
          </h2>
          <p className="mt-1 text-sm text-stone-600 dark:text-zinc-400">
            Here is what is happening at {business.name} today.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => openOrderModal('ai')}
            className="inline-flex items-center gap-1.5 rounded-xl border border-stone-200 bg-white px-4 py-2 text-sm font-medium text-stone-800 transition-colors hover:bg-stone-50 whitespace-nowrap shrink-0 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            <Sparkles className="h-4 w-4" aria-hidden="true" />
            Create with AI
          </button>
          <button
            type="button"
            onClick={() => openOrderModal('manual')}
            className="inline-flex items-center gap-1.5 rounded-xl bg-stone-900 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-stone-800 whitespace-nowrap shrink-0 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            New Order
          </button>
        </div>
      </div>

      {/* 4 Core KPI Metrics */}
      <section
        aria-label="Key business metrics"
        className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-stone-200 bg-stone-200 lg:grid-cols-4 dark:border-zinc-800 dark:bg-zinc-800"
      >
        <div className="bg-white p-5 sm:p-6 dark:bg-zinc-900">
          <p className="text-xs font-medium text-stone-500 dark:text-zinc-400">
            Revenue this month
          </p>
          <p className="mt-2 font-mono text-2xl font-semibold text-stone-900 tabular-nums sm:text-3xl dark:text-zinc-50">
            {formatCurrency(metrics.revenueThisMonth, business.currency)}
          </p>
          <p className="mt-1.5 text-xs text-stone-500 dark:text-zinc-400">
            {metrics.momChangePercent !== null
              ? `${metrics.momChangePercent >= 0 ? '+' : ''}${metrics.momChangePercent}% vs last month`
              : 'Payments collected this month'}
          </p>
        </div>

        <button
          type="button"
          onClick={() => setActiveSection('money')}
          className="bg-white p-5 text-left transition-colors hover:bg-stone-50/70 sm:p-6 dark:bg-zinc-900 dark:hover:bg-zinc-800/60"
        >
          <p className="text-xs font-medium text-stone-500 dark:text-zinc-400">
            Outstanding payments
          </p>
          <p className="mt-2 font-mono text-2xl font-semibold text-stone-900 tabular-nums sm:text-3xl dark:text-zinc-50">
            {formatCurrency(metrics.outstandingPayments, business.currency)}
          </p>
          <p className="mt-1.5 text-xs text-amber-700 dark:text-amber-400">
            {metrics.outstandingPayments > 0 ? 'Awaiting customer balances' : 'All balances settled'}
          </p>
        </button>

        <button
          type="button"
          onClick={() => {
            setOrdersStatusFilter('All');
            setActiveSection('orders');
          }}
          className="bg-white p-5 text-left transition-colors hover:bg-stone-50/70 sm:p-6 dark:bg-zinc-900 dark:hover:bg-zinc-800/60"
        >
          <p className="text-xs font-medium text-stone-500 dark:text-zinc-400">Active orders</p>
          <p className="mt-2 font-mono text-2xl font-semibold text-stone-900 tabular-nums sm:text-3xl dark:text-zinc-50">
            {metrics.activeOrdersCount}
          </p>
          <p className="mt-1.5 text-xs text-stone-500 dark:text-zinc-400">
            In your current order book
          </p>
        </button>

        <button
          type="button"
          onClick={() => setActiveSection('orders')}
          className="bg-white p-5 text-left transition-colors hover:bg-stone-50/70 sm:p-6 dark:bg-zinc-900 dark:hover:bg-zinc-800/60"
        >
          <p className="text-xs font-medium text-stone-500 dark:text-zinc-400">Orders due soon</p>
          <p className="mt-2 font-mono text-2xl font-semibold text-stone-900 tabular-nums sm:text-3xl dark:text-zinc-50">
            {metrics.ordersDueSoonCount}
          </p>
          <p className="mt-1.5 text-xs text-stone-500 dark:text-zinc-400">
            Due within the next 5 days
          </p>
        </button>
      </section>

      {/* Today's Focus & Smart Insights */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Today's Focus */}
        <section className="rounded-2xl border border-stone-200 bg-white p-6 lg:col-span-7 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-semibold text-stone-900 dark:text-zinc-100">
                Today’s Focus
              </h3>
              <p className="mt-0.5 text-xs text-stone-500 dark:text-zinc-400">
                The most important things needing your attention right now
              </p>
            </div>
            <button
              type="button"
              onClick={() => setActiveSection('tasks')}
              className="text-xs font-medium text-stone-600 hover:text-stone-900 whitespace-nowrap shrink-0 dark:text-zinc-400 dark:hover:text-zinc-200"
            >
              All tasks &rarr;
            </button>
          </div>

          {focusItems.length === 0 ? (
            <div className="mt-6 py-8 text-center">
              <p className="text-sm font-medium text-stone-700 dark:text-zinc-300">
                Nothing urgent needs attention today.
              </p>
              <p className="mt-1 text-xs text-stone-500 dark:text-zinc-400">
                New deadlines, ready parcels, and unpaid balances will show up here automatically.
              </p>
            </div>
          ) : (
            <div className="mt-4 divide-y divide-stone-100 dark:divide-zinc-800/80">
              {focusItems.map((item) => (
                <div
                  key={item.id}
                  className="flex flex-col justify-between gap-3 py-3.5 sm:flex-row sm:items-center"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-stone-900 dark:text-zinc-100">
                      {item.title}
                    </p>
                    <p className="mt-0.5 text-xs text-stone-500 dark:text-zinc-400">
                      {item.urgency === 'high' && (
                        <span className="font-semibold text-red-700 dark:text-red-400">
                          Priority ·{' '}
                        </span>
                      )}
                      {item.subtitle}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => void handleFocusAction(item)}
                    className="self-start rounded-lg border border-stone-200 bg-stone-50 px-3 py-1.5 text-xs font-semibold text-stone-800 transition-colors hover:bg-stone-100 whitespace-nowrap shrink-0 sm:self-center dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
                  >
                    {item.actionLabel}
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Smart Business Insights */}
        <section className="rounded-2xl border border-stone-200 bg-white p-6 lg:col-span-5 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h3 className="text-base font-semibold text-stone-900 dark:text-zinc-100">
                Business Insights
              </h3>
              <p className="mt-0.5 text-xs text-stone-500 dark:text-zinc-400">
                Patterns spotted across your orders
              </p>
            </div>
            <button
              type="button"
              disabled={refreshingInsights || orders.length === 0}
              onClick={() => void handleRefreshInsights()}
              aria-label="Refresh AI business insights"
              className="inline-flex items-center gap-1.5 rounded-lg border border-stone-200 px-2.5 py-1.5 text-xs font-medium text-stone-600 transition-colors hover:bg-stone-50 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${refreshingInsights ? 'animate-spin' : ''}`}
                aria-hidden="true"
              />
              <span>AI Refresh</span>
            </button>
          </div>

          {insights.length === 0 ? (
            <div className="mt-6 py-8 text-center text-xs text-stone-500 dark:text-zinc-400">
              Add a couple of orders to unlock personalised revenue and product insights.
            </div>
          ) : (
            <div className="mt-4 divide-y divide-stone-100 dark:divide-zinc-800/80">
              {insights.map((ins) => (
                <div key={ins.id} className="py-3.5">
                  <p className="text-sm font-medium text-stone-900 dark:text-zinc-100">
                    {ins.title}
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-stone-500 dark:text-zinc-400">
                    {ins.detail}
                  </p>
                </div>
              ))}
            </div>
          )}

          <div className="mt-4 border-t border-stone-100 pt-3 dark:border-zinc-800">
            <button
              type="button"
              onClick={() => setActiveSection('assistant')}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-stone-900 hover:underline dark:text-zinc-200"
            >
              Ask AI Assistant a question about your numbers
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>
        </section>
      </div>

      {/* Recent Orders */}
      <section className="rounded-2xl border border-stone-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-semibold text-stone-900 dark:text-zinc-100">
              Recent Orders
            </h3>
            <p className="mt-0.5 text-xs text-stone-500 dark:text-zinc-400">
              Click any order to view notes, record a payment, or write a message
            </p>
          </div>
          <button
            type="button"
            onClick={() => setActiveSection('orders')}
            className="text-xs font-semibold text-stone-800 hover:underline whitespace-nowrap shrink-0 dark:text-zinc-200"
          >
            View all orders &rarr;
          </button>
        </div>

        {recentOrders.length === 0 ? (
          <div className="mt-6 py-10 text-center">
            <p className="text-sm font-medium text-stone-800 dark:text-zinc-200">
              No orders yet
            </p>
            <p className="mt-1 text-xs text-stone-500 dark:text-zinc-400">
              Log your first order manually or describe it in plain English with AI.
            </p>
            <button
              type="button"
              onClick={() => openOrderModal('ai')}
              className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-stone-900 px-4 py-2 text-xs font-semibold text-white dark:bg-zinc-100 dark:text-zinc-900"
            >
              <Sparkles className="h-3.5 w-3.5" />
              Create First Order
            </button>
          </div>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-stone-200 text-xs font-medium text-stone-500 dark:border-zinc-800 dark:text-zinc-400">
                  <th className="py-2.5 pr-4">Customer</th>
                  <th className="py-2.5 px-4">Order</th>
                  <th className="py-2.5 px-4 text-right">Amount</th>
                  <th className="py-2.5 px-4">Due date</th>
                  <th className="py-2.5 pl-4 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 dark:divide-zinc-800/70">
                {recentOrders.map((order) => (
                  <tr
                    key={order.id}
                    onClick={() => {
                      setActiveSection('orders');
                      setSelectedOrderId(order.id);
                    }}
                    className="cursor-pointer transition-colors hover:bg-stone-50 dark:hover:bg-zinc-800/50"
                  >
                    <td className="py-3 pr-4 font-medium text-stone-900 whitespace-nowrap dark:text-zinc-100">
                      {order.customerName}
                      <span className="ml-2 font-mono text-xs font-normal text-stone-400 dark:text-zinc-500">
                        {order.orderNumber}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-stone-700 dark:text-zinc-300">
                      <span className="line-clamp-1">{order.product}</span>
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-stone-900 tabular-nums whitespace-nowrap dark:text-zinc-100">
                      {formatCurrency(order.totalPrice, business.currency)}
                      {order.remainingBalance > 0 && (
                        <span className="block text-[11px] text-amber-700 dark:text-amber-400">
                          {formatCurrency(order.remainingBalance, business.currency)} owed
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-xs text-stone-600 whitespace-nowrap dark:text-zinc-400">
                      {order.dueDate ? formatRelativeDue(order.dueDate, todayIso) : '—'}
                    </td>
                    <td className="py-3 pl-4 text-right text-xs font-medium whitespace-nowrap">
                      <span className={statusTextClass(order.status)}>{order.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Money Overview — Last 30 Days */}
      <section className="rounded-2xl border border-stone-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
          <div>
            <h3 className="text-base font-semibold text-stone-900 dark:text-zinc-100">
              Money Overview
            </h3>
            <p className="mt-0.5 text-xs text-stone-500 dark:text-zinc-400">
              Payments received over the last 30 days ({formatCurrency(thirtyDayTotal, business.currency)} total)
            </p>
          </div>
          <button
            type="button"
            onClick={() => setActiveSection('money')}
            className="text-xs font-semibold text-stone-800 hover:underline self-start whitespace-nowrap shrink-0 sm:self-center dark:text-zinc-200"
          >
            Open Money &amp; Expenses &rarr;
          </button>
        </div>

        <div className="mt-6">
          <div className="flex h-44 items-end gap-1 sm:gap-1.5" role="img" aria-label="30-day revenue bar chart">
            {revenueSeries.map((pt, idx) => {
              const heightPct = pt.amount === 0 ? 4 : Math.max(12, Math.round((pt.amount / maxDaily) * 100));
              const isHovered = hoveredBarIdx === idx;
              return (
                <div
                  key={pt.date}
                  onMouseEnter={() => setHoveredBarIdx(idx)}
                  onMouseLeave={() => setHoveredBarIdx(null)}
                  className="group relative flex h-full flex-1 flex-col justify-end"
                >
                  {isHovered && (
                    <div className="pointer-events-none absolute -top-9 left-1/2 z-10 -translate-x-1/2 rounded-lg bg-stone-900 px-2 py-1 font-mono text-[10px] text-white shadow whitespace-nowrap dark:bg-zinc-100 dark:text-zinc-900">
                      {pt.label}: {formatCurrency(pt.amount, business.currency)}
                    </div>
                  )}
                  <svg
                    viewBox="0 0 10 100"
                    preserveAspectRatio="none"
                    className="h-full w-full overflow-hidden rounded-t-sm"
                    aria-hidden="true"
                  >
                    <rect
                      x="0"
                      y={100 - heightPct}
                      width="10"
                      height={heightPct}
                      className={`transition-opacity ${
                        pt.amount > 0
                          ? 'fill-stone-800 group-hover:opacity-80 dark:fill-zinc-200'
                          : 'fill-stone-100 dark:fill-zinc-800'
                      }`}
                    />
                  </svg>
                </div>
              );
            })}
          </div>
          <div className="mt-2 flex items-center justify-between font-mono text-[11px] text-stone-400 tabular-nums dark:text-zinc-500">
            <span>{formatShortDate(revenueSeries[0]?.date || '')}</span>
            <span>{formatShortDate(revenueSeries[14]?.date || '')}</span>
            <span>Today ({formatShortDate(todayIso)})</span>
          </div>
        </div>
      </section>
    </div>
  );
}
