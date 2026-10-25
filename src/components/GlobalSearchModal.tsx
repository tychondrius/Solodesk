import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CheckSquare, Package, Search, User, X } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { runGlobalSearch, SearchHit } from '../utils/businessLogic';
import { useLockBodyScroll } from '../utils/useLockBodyScroll';

export function GlobalSearchModal() {
  const {
    searchOpen,
    setSearchOpen,
    customers,
    orders,
    tasks,
    business,
    setActiveSection,
    setSelectedOrderId,
    setSelectedCustomerId,
  } = useApp();

  useLockBodyScroll(searchOpen);

  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (searchOpen) {
      setQuery('');
      setTimeout(() => inputRef.current?.focus(), 20);
    }
  }, [searchOpen]);

  const hits = useMemo(
    () => runGlobalSearch(query, customers, orders, tasks, business.currency),
    [query, customers, orders, tasks, business.currency]
  );

  if (!searchOpen) return null;

  const handleSelect = (hit: SearchHit) => {
    setSearchOpen(false);
    if (hit.kind === 'order') {
      setActiveSection('orders');
      setSelectedOrderId(hit.id);
    } else if (hit.kind === 'customer') {
      setActiveSection('customers');
      setSelectedCustomerId(hit.id);
    } else {
      setActiveSection('tasks');
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4 pt-16 backdrop-blur-xs sm:pt-24"
      role="dialog"
      aria-modal="true"
      aria-label="Global workspace search"
      onClick={(e) => {
        if (e.target === e.currentTarget) setSearchOpen(false);
      }}
    >
      <div className="w-full max-w-xl overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-center gap-3 border-b border-stone-200 px-4 py-3.5 dark:border-zinc-800">
          <Search className="h-4 w-4 shrink-0 text-stone-400" aria-hidden="true" />
          <label htmlFor="global-search-input" className="sr-only">
            Search orders, customers, order IDs, products, or notes
          </label>
          <input
            id="global-search-input"
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search customers, order IDs, products, or notes…"
            className="w-full bg-transparent text-sm text-stone-900 placeholder:text-stone-400 focus:outline-none dark:text-zinc-100"
          />
          <button
            type="button"
            onClick={() => setSearchOpen(false)}
            aria-label="Close search"
            className="rounded-lg p-1 text-stone-400 hover:bg-stone-100 hover:text-stone-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-96 overflow-y-auto p-2">
          {query.trim().length === 0 ? (
            <div className="px-4 py-8 text-center">
              <p className="text-sm font-medium text-stone-700 dark:text-zinc-300">
                Find anything in {business.name}
              </p>
              <p className="mt-1 text-xs text-stone-500 dark:text-zinc-400">
                Try searching a name like “Emma”, an order ID like “SD-1048”, or “portrait”.
              </p>
            </div>
          ) : hits.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <p className="text-sm text-stone-600 dark:text-zinc-400">
                No matching orders, customers, or tasks for “{query}”.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-stone-100 dark:divide-zinc-800/70">
              {hits.map((hit) => (
                <button
                  key={`${hit.kind}_${hit.id}`}
                  type="button"
                  onClick={() => handleSelect(hit)}
                  className="flex w-full items-center justify-between gap-4 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-stone-50 dark:hover:bg-zinc-800/70"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-stone-100 text-stone-600 dark:bg-zinc-800 dark:text-zinc-300">
                      {hit.kind === 'order' ? (
                        <Package className="h-4 w-4" />
                      ) : hit.kind === 'customer' ? (
                        <User className="h-4 w-4" />
                      ) : (
                        <CheckSquare className="h-4 w-4" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-stone-900 dark:text-zinc-100">
                        {hit.title}
                      </p>
                      <p className="truncate text-xs text-stone-500 dark:text-zinc-400">
                        {hit.subtitle}
                      </p>
                    </div>
                  </div>
                  <span className="shrink-0 font-mono text-xs font-medium text-stone-600 tabular-nums dark:text-zinc-300">
                    {hit.meta}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
