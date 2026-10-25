import React, { useState } from 'react';
import { Check, Download, LogOut, Moon, RefreshCw, Sun } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { CURRENCIES, CurrencyCode, PlanTier } from '../types';
import { ConfirmDialog } from './ConfirmDialog';

export function SettingsView() {
  const {
    business,
    userProfile,
    firebaseUser,
    isDemoMode,
    theme,
    setThemePreference,
    updateSettings,
    orders,
    customers,
    payments,
    expenses,
    tasks,
    seedSampleData,
    resetDemoData,
    logout,
    openAuthScreen,
  } = useApp();

  const [ownerName, setOwnerName] = useState(business.ownerName);
  const [businessName, setBusinessName] = useState(business.name);
  const [businessType, setBusinessType] = useState(business.businessType);
  const [currency, setCurrency] = useState<CurrencyCode>(business.currency);
  const [notificationsEnabled, setNotificationsEnabled] = useState(
    userProfile ? userProfile.notificationsEnabled : true
  );
  const [saving, setSaving] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);

  const handleSaveProfileAndBusiness = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await updateSettings({
        ownerName: ownerName.trim(),
        businessName: businessName.trim(),
        businessType: businessType.trim(),
        currency,
        notificationsEnabled,
      });
    } finally {
      setSaving(false);
    }
  };

  const handlePlanChange = async (plan: PlanTier) => {
    await updateSettings({ plan });
  };

  const handleExportJson = () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      business,
      customers,
      orders,
      payments,
      expenses,
      tasks,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${business.name.toLowerCase().replace(/\s+/g, '-')}-solodesk-backup.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <h2 className="font-display text-2xl font-semibold text-stone-900 dark:text-zinc-50">
          Settings
        </h2>
        <p className="mt-0.5 text-sm text-stone-600 dark:text-zinc-400">
          Manage your profile, business details, currency, appearance, and workspace data.
        </p>
      </div>

      {/* 1. Profile, Business Information & Currency */}
      <form
        onSubmit={handleSaveProfileAndBusiness}
        className="space-y-6 rounded-2xl border border-stone-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900"
      >
        <div>
          <h3 className="text-base font-semibold text-stone-900 dark:text-zinc-100">
            Profile &amp; Business Information
          </h3>
          <p className="mt-0.5 text-xs text-stone-500 dark:text-zinc-400">
            Shown on your dashboard and used when drafting customer messages.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label
              htmlFor="set-owner-name"
              className="block text-xs font-medium text-stone-700 dark:text-zinc-300"
            >
              Your name
            </label>
            <input
              id="set-owner-name"
              type="text"
              required
              value={ownerName}
              onChange={(e) => setOwnerName(e.target.value)}
              className="mt-1 w-full rounded-xl border border-stone-200 bg-white px-3.5 py-2 text-sm text-stone-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
            />
          </div>

          <div>
            <label
              htmlFor="set-biz-name"
              className="block text-xs font-medium text-stone-700 dark:text-zinc-300"
            >
              Business name
            </label>
            <input
              id="set-biz-name"
              type="text"
              required
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              className="mt-1 w-full rounded-xl border border-stone-200 bg-white px-3.5 py-2 text-sm text-stone-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
            />
          </div>
        </div>

        <div>
          <label
            htmlFor="set-biz-type"
            className="block text-xs font-medium text-stone-700 dark:text-zinc-300"
          >
            Business type
          </label>
          <input
            id="set-biz-type"
            type="text"
            value={businessType}
            onChange={(e) => setBusinessType(e.target.value)}
            className="mt-1 w-full rounded-xl border border-stone-200 bg-white px-3.5 py-2 text-sm text-stone-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
          />
        </div>

        {/* Currency */}
        <div className="border-t border-stone-100 pt-5 dark:border-zinc-800">
          <label className="block text-sm font-semibold text-stone-900 dark:text-zinc-100">
            Currency
          </label>
          <p className="mt-0.5 text-xs text-stone-500 dark:text-zinc-400">
            Choose how prices, balances, and charts are formatted across SoloDesk.
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            {(Object.keys(CURRENCIES) as CurrencyCode[]).map((code) => {
              const cfg = CURRENCIES[code];
              const active = currency === code;
              return (
                <button
                  key={code}
                  type="button"
                  onClick={() => setCurrency(code)}
                  className={`flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2.5 text-xs font-semibold transition-colors ${
                    active
                      ? 'border-stone-900 bg-stone-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900'
                      : 'border-stone-200 bg-white text-stone-700 hover:bg-stone-50 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-300'
                  }`}
                >
                  <span>{code}</span>
                  <span className="font-mono">{cfg.symbol}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Notifications */}
        <div className="border-t border-stone-100 pt-5 dark:border-zinc-800">
          <label className="flex cursor-pointer items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-stone-900 dark:text-zinc-100">
                In-App Notifications
              </p>
              <p className="text-xs text-stone-500 dark:text-zinc-400">
                Alerts for orders due soon, overdue items, unpaid balances, and customer approvals.
              </p>
            </div>
            <input
              type="checkbox"
              checked={notificationsEnabled}
              onChange={(e) => setNotificationsEnabled(e.target.checked)}
              className="h-4 w-4 rounded border-stone-300"
            />
          </label>
        </div>

        <div className="flex justify-end border-t border-stone-100 pt-4 dark:border-zinc-800">
          <button
            type="submit"
            disabled={saving}
            className="rounded-xl bg-stone-900 px-5 py-2.5 text-xs font-semibold text-white hover:bg-stone-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
          >
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </form>

      {/* 2. Appearance */}
      <section className="rounded-2xl border border-stone-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <h3 className="text-base font-semibold text-stone-900 dark:text-zinc-100">Appearance</h3>
        <p className="mt-0.5 text-xs text-stone-500 dark:text-zinc-400">
          Switch between crisp daylight mode and calm dark mode.
        </p>

        <div className="mt-4 flex gap-3">
          <button
            type="button"
            onClick={() => setThemePreference('light')}
            className={`flex flex-1 items-center justify-center gap-2 rounded-xl border px-4 py-3 text-xs font-semibold transition-colors ${
              theme === 'light'
                ? 'border-stone-900 bg-stone-900 text-white'
                : 'border-stone-200 bg-stone-50 text-stone-700 hover:bg-stone-100 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-300'
            }`}
          >
            <Sun className="h-4 w-4" />
            Light Mode
          </button>

          <button
            type="button"
            onClick={() => setThemePreference('dark')}
            className={`flex flex-1 items-center justify-center gap-2 rounded-xl border px-4 py-3 text-xs font-semibold transition-colors ${
              theme === 'dark'
                ? 'border-zinc-100 bg-zinc-100 text-zinc-900'
                : 'border-stone-200 bg-stone-50 text-stone-700 hover:bg-stone-100 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-300'
            }`}
          >
            <Moon className="h-4 w-4" />
            Dark Mode
          </button>
        </div>
      </section>

      {/* 3. Account & Plan Architecture (Stripe-ready preview, no live billing) */}
      <section className="rounded-2xl border border-stone-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-base font-semibold text-stone-900 dark:text-zinc-100">
              Account &amp; Plan
            </h3>
            <p className="mt-0.5 text-xs text-stone-500 dark:text-zinc-400">
              {isDemoMode
                ? 'Currently exploring Demo Mode. Create a free account to sync across devices.'
                : `Signed in as ${firebaseUser?.email || userProfile?.email}`}
            </p>
          </div>
          <span className="text-xs font-semibold text-stone-600 dark:text-zinc-300">
            Subscription billing coming soon
          </span>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div
            className={`rounded-xl border p-4 ${
              business.plan === 'free'
                ? 'border-stone-900 dark:border-zinc-200'
                : 'border-stone-200 dark:border-zinc-800'
            }`}
          >
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-stone-900 dark:text-zinc-100">Free (£0)</p>
              {business.plan === 'free' && (
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                  <Check className="h-3.5 w-3.5" /> Current
                </span>
              )}
            </div>
            <p className="mt-1 text-xs text-stone-500 dark:text-zinc-400">
              Up to 10 active orders, customer management, payment tracking.
            </p>
            {business.plan !== 'free' && (
              <button
                type="button"
                onClick={() => void handlePlanChange('free')}
                className="mt-3 rounded-lg border border-stone-200 px-3 py-1.5 text-xs font-medium text-stone-700 hover:bg-stone-50 dark:border-zinc-700 dark:text-zinc-300"
              >
                Switch to Free tier
              </button>
            )}
          </div>

          <div
            className={`rounded-xl border p-4 ${
              business.plan === 'solo'
                ? 'border-stone-900 dark:border-zinc-200'
                : 'border-stone-200 dark:border-zinc-800'
            }`}
          >
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-stone-900 dark:text-zinc-100">
                Solo (£5.99/mo preview)
              </p>
              {business.plan === 'solo' && (
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                  <Check className="h-3.5 w-3.5" /> Active Preview
                </span>
              )}
            </div>
            <p className="mt-1 text-xs text-stone-500 dark:text-zinc-400">
              Unlimited orders, AI order creation, AI assistant &amp; message writer.
            </p>
            {business.plan !== 'solo' && (
              <button
                type="button"
                onClick={() => void handlePlanChange('solo')}
                className="mt-3 rounded-lg bg-stone-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-stone-800 dark:bg-zinc-100 dark:text-zinc-900"
              >
                Enable Solo Preview (Free during beta)
              </button>
            )}
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-stone-100 pt-4 dark:border-zinc-800">
          {isDemoMode ? (
            <button
              type="button"
              onClick={() => openAuthScreen('signup')}
              className="rounded-xl bg-stone-900 px-4 py-2 text-xs font-semibold text-white hover:bg-stone-800 dark:bg-zinc-100 dark:text-zinc-900"
            >
              Sign up to save your own workspace
            </button>
          ) : (
            <span className="text-xs text-stone-500 dark:text-zinc-400">
              Cloud sync active with Firebase Firestore
            </span>
          )}

          <button
            type="button"
            onClick={() => void logout()}
            className="inline-flex items-center gap-1.5 rounded-xl border border-stone-200 px-4 py-2 text-xs font-medium text-stone-700 hover:bg-stone-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            <LogOut className="h-3.5 w-3.5" />
            Log out
          </button>
        </div>
      </section>

      {/* 4. Data Management */}
      <section className="rounded-2xl border border-stone-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <h3 className="text-base font-semibold text-stone-900 dark:text-zinc-100">Data</h3>
        <p className="mt-0.5 text-xs text-stone-500 dark:text-zinc-400">
          Export a full copy of your workspace records or load sample studio data.
        </p>

        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={handleExportJson}
            className="inline-flex items-center gap-1.5 rounded-xl border border-stone-200 px-4 py-2 text-xs font-semibold text-stone-800 hover:bg-stone-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            <Download className="h-3.5 w-3.5" />
            Export JSON Backup
          </button>

          {!isDemoMode && orders.length === 0 && (
            <button
              type="button"
              onClick={() => void seedSampleData()}
              className="inline-flex items-center gap-1.5 rounded-xl border border-stone-200 px-4 py-2 text-xs font-medium text-stone-700 hover:bg-stone-50 dark:border-zinc-700 dark:text-zinc-300"
            >
              Load Sample Studio Data
            </button>
          )}

          {isDemoMode && (
            <button
              type="button"
              onClick={() => setConfirmReset(true)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-stone-200 px-4 py-2 text-xs font-medium text-stone-700 hover:bg-stone-50 dark:border-zinc-700 dark:text-zinc-300"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Reset Demo Data
            </button>
          )}
        </div>
      </section>

      <ConfirmDialog
        open={confirmReset}
        title="Reset demo workspace?"
        description="This restores Luna Creative Studio back to its original 8 sample orders, customers, and tasks."
        confirmLabel="Reset Demo"
        destructive={false}
        onCancel={() => setConfirmReset(false)}
        onConfirm={() => {
          setConfirmReset(false);
          resetDemoData();
        }}
      />
    </div>
  );
}
