import React, { useMemo, useState } from 'react';
import { Package, Plus, Search, Sparkles } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { ORDER_STATUSES, OrderStatus } from '../types';
import {
  calculateOrderBalance,
  formatCurrency,
  formatRelativeDue,
} from '../utils/businessLogic';
import { statusTextClass } from './DashboardView';
import { OrderDetailDrawer } from './OrderDetailDrawer';

export function OrdersView() {
  const {
    orders,
    business,
    todayIso,
    ordersStatusFilter,
    setOrdersStatusFilter,
    selectedOrderId,
    setSelectedOrderId,
    openOrderModal,
  } = useApp();

  const [searchQuery, setSearchQuery] = useState('');

  const filterTabs: (OrderStatus | 'All' | 'Archived')[] = [
    'All',
    ...ORDER_STATUSES,
    'Archived',
  ];

  const filteredOrders = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return orders.filter((o) => {
      if (ordersStatusFilter === 'Archived') {
        if (!o.archived) return false;
      } else {
        if (o.archived) return false;
        if (ordersStatusFilter !== 'All' && o.status !== ordersStatusFilter) return false;
      }

      if (!q) return true;
      return `${o.orderNumber} ${o.customerName} ${o.product} ${o.description} ${o.customerNotes}`
        .toLowerCase()
        .includes(q);
    });
  }, [orders, ordersStatusFilter, searchQuery]);

  const selectedOrder = useMemo(
    () => orders.find((o) => o.id === selectedOrderId) || null,
    [orders, selectedOrderId]
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h2 className="font-display text-2xl font-semibold text-stone-900 dark:text-zinc-50">
            Orders
          </h2>
          <p className="mt-0.5 text-sm text-stone-600 dark:text-zinc-400">
            Manage commissions, deposits, due dates, and dispatches in one calm list.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => openOrderModal('ai')}
            className="inline-flex items-center gap-1.5 rounded-xl border border-stone-200 bg-white px-4 py-2 text-sm font-medium text-stone-800 hover:bg-stone-50 whitespace-nowrap shrink-0 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            <Sparkles className="h-4 w-4" aria-hidden="true" />
            Create with AI
          </button>
          <button
            type="button"
            onClick={() => openOrderModal('manual')}
            className="inline-flex items-center gap-1.5 rounded-xl bg-stone-900 px-4 py-2 text-sm font-semibold text-white hover:bg-stone-800 whitespace-nowrap shrink-0 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            New Order
          </button>
        </div>
      </div>

      {/* Search & Status Filter Bar */}
      <div className="space-y-3">
        <div className="relative">
          <Search
            className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-stone-400"
            aria-hidden="true"
          />
          <label htmlFor="orders-search" className="sr-only">
            Search orders
          </label>
          <input
            id="orders-search"
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by customer, order ID (e.g. SD-1048), product, or note…"
            className="w-full rounded-xl border border-stone-200 bg-white py-2.5 pr-4 pl-10 text-sm text-stone-900 placeholder:text-stone-400 focus:border-stone-500 focus:outline-none dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
          />
        </div>

        <div className="flex items-center gap-1 overflow-x-auto rounded-xl bg-stone-100 p-1 dark:bg-zinc-900">
          {filterTabs.map((tab) => {
            const active = ordersStatusFilter === tab;
            return (
              <button
                key={tab}
                type="button"
                onClick={() => setOrdersStatusFilter(tab)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                  active
                    ? 'bg-white text-stone-900 shadow-xs dark:bg-zinc-800 dark:text-zinc-100'
                    : 'text-stone-600 hover:text-stone-900 dark:text-zinc-400 dark:hover:text-zinc-200'
                }`}
              >
                {tab}
              </button>
            );
          })}
        </div>
      </div>

      {/* Orders Table / List */}
      <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        {filteredOrders.length === 0 ? (
          <div className="px-6 py-14 text-center">
            <Package className="mx-auto h-8 w-8 text-stone-400 dark:text-zinc-500" aria-hidden="true" />
            <h3 className="mt-3 text-sm font-semibold text-stone-900 dark:text-zinc-100">
              No matching orders
            </h3>
            <p className="mt-1 text-xs text-stone-500 dark:text-zinc-400">
              {searchQuery || ordersStatusFilter !== 'All'
                ? 'Try clearing your search or switching status filters.'
                : 'Add your first customer order manually or describe it naturally with AI.'}
            </p>
            <div className="mt-4 flex justify-center gap-2">
              {(searchQuery || ordersStatusFilter !== 'All') && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setOrdersStatusFilter('All');
                  }}
                  className="rounded-xl border border-stone-200 px-3.5 py-2 text-xs font-medium text-stone-700 hover:bg-stone-50 dark:border-zinc-700 dark:text-zinc-300"
                >
                  Clear filters
                </button>
              )}
              <button
                type="button"
                onClick={() => openOrderModal('manual')}
                className="rounded-xl bg-stone-900 px-4 py-2 text-xs font-semibold text-white hover:bg-stone-800 dark:bg-zinc-100 dark:text-zinc-900"
              >
                + New Order
              </button>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-stone-200 text-xs font-medium text-stone-500 dark:border-zinc-800 dark:text-zinc-400">
                  <th className="py-3 pr-4 pl-6">Order</th>
                  <th className="py-3 px-4">Customer</th>
                  <th className="py-3 px-4">Product / Service</th>
                  <th className="py-3 px-4">Payment</th>
                  <th className="py-3 px-4">Due</th>
                  <th className="py-3 pr-6 pl-4 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 dark:divide-zinc-800/70">
                {filteredOrders.map((order) => {
                  const bal = calculateOrderBalance(
                    order.totalPrice,
                    order.amountPaid,
                    order.depositRequired
                  );
                  return (
                    <tr
                      key={order.id}
                      onClick={() => setSelectedOrderId(order.id)}
                      className="cursor-pointer transition-colors hover:bg-stone-50 dark:hover:bg-zinc-800/50"
                    >
                      <td className="py-3.5 pr-4 pl-6 font-mono text-xs font-medium text-stone-600 whitespace-nowrap dark:text-zinc-400">
                        {order.orderNumber}
                      </td>
                      <td className="py-3.5 px-4 font-medium text-stone-900 whitespace-nowrap dark:text-zinc-100">
                        {order.customerName}
                      </td>
                      <td className="py-3.5 px-4 text-stone-700 dark:text-zinc-300">
                        <p className="line-clamp-1 font-medium">{order.product}</p>
                        {order.quantity > 1 && (
                          <span className="text-xs text-stone-400">Qty {order.quantity}</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-2 font-mono text-xs tabular-nums">
                          <span className="font-semibold text-stone-900 dark:text-zinc-100">
                            {formatCurrency(order.amountPaid, business.currency)}
                          </span>
                          <span className="text-stone-400">/</span>
                          <span className="text-stone-600 dark:text-zinc-400">
                            {formatCurrency(order.totalPrice, business.currency)}
                          </span>
                        </div>
                        <svg
                          viewBox="0 0 100 6"
                          preserveAspectRatio="none"
                          aria-hidden="true"
                          className="mt-1 h-1.5 w-24 overflow-hidden rounded-full bg-stone-200 dark:bg-zinc-800"
                        >
                          <rect
                            x="0"
                            y="0"
                            width={bal.percentPaid}
                            height="6"
                            className={
                              bal.isFullyPaid
                                ? 'fill-emerald-600 dark:fill-emerald-500'
                                : 'fill-stone-800 dark:fill-zinc-300'
                            }
                          />
                        </svg>
                      </td>
                      <td className="py-3.5 px-4 text-xs text-stone-600 whitespace-nowrap dark:text-zinc-400">
                        {order.dueDate ? formatRelativeDue(order.dueDate, todayIso) : '—'}
                      </td>
                      <td className="py-3.5 pr-6 pl-4 text-right text-xs font-semibold whitespace-nowrap">
                        <span className={statusTextClass(order.status)}>{order.status}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selectedOrder && (
        <OrderDetailDrawer
          order={selectedOrder}
          onClose={() => setSelectedOrderId(null)}
        />
      )}
    </div>
  );
}
