import React, { useEffect, useRef, useState } from 'react';
import {
  Bell,
  CheckCheck,
  CheckSquare,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  Package,
  Plus,
  Search,
  Settings,
  Sparkles,
  Sun,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { NavSection } from '../types';
import { sanitizeUserFacingMessage } from '../utils/businessLogic';
import { useLockBodyScroll } from '../utils/useLockBodyScroll';

const NAV_ITEMS: { id: NavSection; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'orders', label: 'Orders', icon: Package },
  { id: 'customers', label: 'Customers', icon: Users },
  { id: 'tasks', label: 'Tasks', icon: CheckSquare },
  { id: 'money', label: 'Money', icon: Wallet },
  { id: 'assistant', label: 'AI Assistant', icon: Sparkles },
  { id: 'settings', label: 'Settings', icon: Settings },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const {
    business,
    isDemoMode,
    activeSection,
    setActiveSection,
    openOrderModal,
    setSearchOpen,
    notifications,
    unreadNotificationCount,
    markNotificationRead,
    markAllNotificationsRead,
    setSelectedOrderId,
    setSelectedCustomerId,
    theme,
    toggleTheme,
    logout,
    openAuthScreen,
    toasts,
  } = useApp();

  const [notifOpen, setNotifOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);

  useLockBodyScroll(mobileMenuOpen);

  useEffect(() => {
    if (!notifOpen) return;
    const handlePointerDown = (e: PointerEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setNotifOpen(false);
    };
    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [notifOpen]);

  const currentNav = NAV_ITEMS.find((n) => n.id === activeSection) || NAV_ITEMS[0];

  const handleNotificationClick = async (notifId: string, orderId: string, customerId: string) => {
    await markNotificationRead(notifId);
    setNotifOpen(false);
    if (orderId) {
      setActiveSection('orders');
      setSelectedOrderId(orderId);
    } else if (customerId) {
      setActiveSection('customers');
      setSelectedCustomerId(customerId);
    } else {
      setActiveSection('tasks');
    }
  };

  return (
    <div className="flex min-h-screen bg-[#f8f8f7] text-stone-900 dark:bg-[#0c0c0e] dark:text-zinc-100">
      {/* Desktop Sidebar */}
      <aside
        aria-label="Primary Sidebar"
        className="hidden w-64 shrink-0 flex-col justify-between border-r border-stone-200/80 bg-white px-4 py-5 lg:flex dark:border-zinc-800/90 dark:bg-[#121215]"
      >
        <div>
          <div className="flex items-center justify-between px-2">
            <div>
              <p className="font-display text-lg font-semibold tracking-tight text-stone-900 dark:text-zinc-100">
                SoloDesk
              </p>
              <p className="mt-0.5 truncate text-xs text-stone-500 dark:text-zinc-400">
                {business.name}
              </p>
            </div>
          </div>

          <div className="mt-5 px-1">
            <button
              type="button"
              onClick={() => openOrderModal('manual')}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-stone-900 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-stone-800 whitespace-nowrap shrink-0 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              New Order
            </button>
          </div>

          <nav aria-label="Workspace sections" className="mt-6 space-y-1">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const active = activeSection === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveSection(item.id)}
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors whitespace-nowrap ${
                    active
                      ? 'bg-stone-100 text-stone-950 font-semibold dark:bg-zinc-800/90 dark:text-zinc-50'
                      : 'text-stone-600 hover:bg-stone-50 hover:text-stone-900 dark:text-zinc-400 dark:hover:bg-zinc-800/50 dark:hover:text-zinc-200'
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        <div className="space-y-3 border-t border-stone-100 pt-4 dark:border-zinc-800/80">
          {isDemoMode && (
            <div className="rounded-xl border border-stone-200 bg-stone-50 p-3 dark:border-zinc-800 dark:bg-zinc-900">
              <p className="text-xs font-semibold text-stone-800 dark:text-zinc-200">
                Interactive Demo Mode
              </p>
              <p className="mt-0.5 text-xs text-stone-500 dark:text-zinc-400">
                Exploring {business.name}. Sign up free to sync your own studio.
              </p>
              <button
                type="button"
                onClick={() => openAuthScreen('signup')}
                className="mt-2.5 w-full rounded-lg bg-stone-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-stone-800 dark:bg-zinc-100 dark:text-zinc-900"
              >
                Create My Account
              </button>
            </div>
          )}

          <div className="flex items-center justify-between px-2">
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold text-stone-800 dark:text-zinc-200">
                {business.ownerName}
              </p>
              <p className="text-xs text-stone-500 dark:text-zinc-400">
                {business.currency} · {business.plan === 'solo' ? 'Solo Plan' : 'Free Plan'}
              </p>
            </div>
            <button
              type="button"
              onClick={logout}
              aria-label="Log out"
              title="Log out"
              className="rounded-lg p-2 text-stone-500 transition-colors hover:bg-stone-100 hover:text-stone-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Column */}
      <div className="flex min-w-0 flex-1 flex-col pb-20 lg:pb-0">
        {/* Top Workspace Header */}
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between gap-4 border-b border-stone-200/80 bg-[#f8f8f7]/90 px-4 backdrop-blur-md sm:px-8 dark:border-zinc-800/80 dark:bg-[#0c0c0e]/90">
          <div className="flex items-center gap-3 min-w-0">
            <span className="font-display text-base font-semibold text-stone-900 lg:hidden dark:text-zinc-100">
              SoloDesk
            </span>
            <span className="hidden text-xs text-stone-400 lg:inline" aria-hidden="true">
              {business.name} /
            </span>
            <h1 className="truncate text-sm font-semibold text-stone-900 dark:text-zinc-100">
              {currentNav.label}
            </h1>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Global Search Trigger */}
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              aria-label="Search orders, customers, and products"
              className="flex items-center gap-2 rounded-xl border border-stone-200 bg-white px-3 py-1.5 text-xs text-stone-500 transition-colors hover:border-stone-300 hover:text-stone-800 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200"
            >
              <Search className="h-3.5 w-3.5" aria-hidden="true" />
              <span className="hidden sm:inline">Search…</span>
              <kbd className="hidden rounded bg-stone-100 px-1.5 py-0.5 font-mono text-[10px] text-stone-500 sm:inline dark:bg-zinc-800 dark:text-zinc-400">
                ⌘K
              </kbd>
            </button>

            {/* Theme Toggle */}
            <button
              type="button"
              onClick={toggleTheme}
              aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              className="rounded-xl border border-stone-200 bg-white p-2 text-stone-600 transition-colors hover:bg-stone-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>

            {/* Notifications Popover */}
            <div ref={notifRef} className="relative">
              <button
                type="button"
                onClick={() => setNotifOpen((prev) => !prev)}
                aria-label={`Notifications (${unreadNotificationCount} unread)`}
                aria-expanded={notifOpen}
                className="relative rounded-xl border border-stone-200 bg-white p-2 text-stone-600 transition-colors hover:bg-stone-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                <Bell className="h-4 w-4" />
                {unreadNotificationCount > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-stone-900 px-1 font-mono text-[10px] font-semibold text-white tabular-nums dark:bg-zinc-100 dark:text-zinc-900">
                    {unreadNotificationCount}
                  </span>
                )}
              </button>

              {notifOpen && (
                <div
                  role="dialog"
                  aria-label="Notification centre"
                  className="absolute right-0 z-40 mt-2 w-[min(20rem,calc(100vw-1.5rem))] overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-xl sm:w-96 dark:border-zinc-800 dark:bg-zinc-900"
                >
                    <div className="flex items-center justify-between border-b border-stone-100 px-4 py-3 dark:border-zinc-800">
                      <span className="text-xs font-semibold text-stone-900 dark:text-zinc-100">
                        Notifications
                      </span>
                      {unreadNotificationCount > 0 && (
                        <button
                          type="button"
                          onClick={() => void markAllNotificationsRead()}
                          className="inline-flex items-center gap-1 text-xs font-medium text-stone-600 hover:text-stone-900 dark:text-zinc-400 dark:hover:text-zinc-200"
                        >
                          <CheckCheck className="h-3.5 w-3.5" />
                          Mark all read
                        </button>
                      )}
                    </div>

                    <div className="max-h-80 overflow-y-auto divide-y divide-stone-100 dark:divide-zinc-800">
                      {notifications.length === 0 ? (
                        <div className="px-4 py-8 text-center text-xs text-stone-500 dark:text-zinc-400">
                          You’re all caught up — no pending alerts.
                        </div>
                      ) : (
                        notifications.map((n) => (
                          <button
                            key={n.id}
                            type="button"
                            onClick={() =>
                              void handleNotificationClick(
                                n.id,
                                n.relatedOrderId,
                                n.relatedCustomerId
                              )
                            }
                            className={`block w-full px-4 py-3 text-left transition-colors hover:bg-stone-50 dark:hover:bg-zinc-800/70 ${
                              n.read ? 'opacity-60' : ''
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-xs font-semibold text-stone-900 dark:text-zinc-100">
                                {n.title}
                              </p>
                              {!n.read && (
                                <span className="text-[11px] font-medium text-amber-700 dark:text-amber-400">
                                  New
                                </span>
                              )}
                            </div>
                            <p className="mt-0.5 text-xs text-stone-600 dark:text-zinc-400">
                              {n.message}
                            </p>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
              )}
            </div>

            {/* Quick AI Order CTA on sections without their own hero Order buttons */}
            {activeSection !== 'dashboard' && activeSection !== 'orders' && (
              <button
                type="button"
                onClick={() => openOrderModal('ai')}
                className="hidden items-center gap-1.5 rounded-xl border border-stone-200 bg-white px-3 py-1.5 text-xs font-semibold text-stone-800 transition-colors hover:bg-stone-50 whitespace-nowrap shrink-0 sm:inline-flex dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
              >
                <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                Create with AI
              </button>
            )}
          </div>
        </header>

        {/* Page Body */}
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-8 sm:py-8">
          {children}
        </main>
      </div>

      {/* Mobile Bottom Navigation (Compact 56px height + safe-area inset) */}
      <nav
        aria-label="Mobile navigation"
        className="fixed inset-x-0 bottom-0 z-20 flex min-h-14 items-center justify-around border-t border-stone-200 bg-white px-2 pt-1 pb-safe lg:hidden dark:border-zinc-800 dark:bg-[#121215]"
      >
        <button
          type="button"
          onClick={() => setActiveSection('dashboard')}
          className={`flex flex-col items-center gap-0.5 px-3 py-1 text-[11px] font-medium ${
            activeSection === 'dashboard'
              ? 'text-stone-950 font-semibold dark:text-zinc-50'
              : 'text-stone-500 dark:text-zinc-400'
          }`}
        >
          <LayoutDashboard className="h-4 w-4" />
          <span>Home</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSection('orders')}
          className={`flex flex-col items-center gap-0.5 px-3 py-1 text-[11px] font-medium ${
            activeSection === 'orders'
              ? 'text-stone-950 font-semibold dark:text-zinc-50'
              : 'text-stone-500 dark:text-zinc-400'
          }`}
        >
          <Package className="h-4 w-4" />
          <span>Orders</span>
        </button>

        <button
          type="button"
          onClick={() => openOrderModal('manual')}
          aria-label="New Order"
          className="flex h-9 w-9 items-center justify-center rounded-xl bg-stone-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
        >
          <Plus className="h-4 w-4" />
        </button>

        <button
          type="button"
          onClick={() => setActiveSection('tasks')}
          className={`flex flex-col items-center gap-0.5 px-3 py-1 text-[11px] font-medium ${
            activeSection === 'tasks'
              ? 'text-stone-950 font-semibold dark:text-zinc-50'
              : 'text-stone-500 dark:text-zinc-400'
          }`}
        >
          <CheckSquare className="h-4 w-4" />
          <span>Tasks</span>
        </button>

        <button
          type="button"
          onClick={() => setMobileMenuOpen(true)}
          aria-label="More sections"
          className={`flex flex-col items-center gap-0.5 px-3 py-1 text-[11px] font-medium ${
            ['customers', 'money', 'assistant', 'settings'].includes(activeSection)
              ? 'text-stone-950 font-semibold dark:text-zinc-50'
              : 'text-stone-500 dark:text-zinc-400'
          }`}
        >
          <Menu className="h-4 w-4" />
          <span>More</span>
        </button>
      </nav>

      {/* Mobile More Drawer */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end bg-black/50 lg:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="More navigation options"
          onClick={(e) => {
            if (e.target === e.currentTarget) setMobileMenuOpen(false);
          }}
        >
          <div className="max-h-[85dvh] w-full overflow-y-auto overscroll-contain rounded-t-2xl border-t border-stone-200 bg-white p-5 pb-safe dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex items-center justify-between pb-3">
              <p className="text-sm font-semibold text-stone-900 dark:text-zinc-100">
                {business.name}
              </p>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                aria-label="Close menu"
                className="rounded-lg p-1.5 text-stone-500 hover:bg-stone-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setActiveSection(item.id);
                      setMobileMenuOpen(false);
                    }}
                    className="flex items-center gap-2.5 rounded-xl border border-stone-200 px-3.5 py-3 text-left text-sm font-medium text-stone-800 hover:bg-stone-50 dark:border-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-800"
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>

            <div className="mt-4 flex items-center justify-between border-t border-stone-100 pt-3 dark:border-zinc-800">
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  openOrderModal('ai');
                }}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-stone-900 dark:text-zinc-100"
              >
                <Sparkles className="h-3.5 w-3.5" />
                Create Order with AI
              </button>
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  void logout();
                }}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-stone-600 dark:text-zinc-400"
              >
                <LogOut className="h-3.5 w-3.5" />
                Log out
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Subtle Toast Stack */}
      {toasts.length > 0 && (
        <div
          aria-live="polite"
          className="fixed right-4 bottom-18 z-50 flex flex-col gap-2 lg:bottom-6"
        >
          {toasts.map((t) => (
            <div
              key={t.id}
              className={`rounded-xl border px-4 py-2.5 text-xs font-medium shadow-lg ${
                t.tone === 'error'
                  ? 'border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200'
                  : 'border-stone-800 bg-stone-900 text-white dark:border-zinc-700 dark:bg-zinc-100 dark:text-zinc-900'
              }`}
            >
              {sanitizeUserFacingMessage(
                t.text,
                'Something went wrong. Please review and try again.'
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
