/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { LandingPage } from './components/LandingPage';
import { AuthScreen, OnboardingWizard, VerifyEmailScreen } from './components/AuthViews';
import { AppShell } from './components/AppShell';
import { DashboardView } from './components/DashboardView';
import { OrdersView } from './components/OrdersView';
import { CustomersView } from './components/CustomersView';
import { TasksView } from './components/TasksView';
import { MoneyView } from './components/MoneyView';
import { AiAssistantView } from './components/AiAssistantView';
import { SettingsView } from './components/SettingsView';
import { OrderFormModal } from './components/OrderFormModal';
import { MessageWriterModal } from './components/MessageWriterModal';
import { GlobalSearchModal } from './components/GlobalSearchModal';

function WorkspaceSkeleton() {
  return (
    <div className="min-h-screen bg-[#f8f8f7] p-8 dark:bg-[#0c0c0e]">
      <div className="mx-auto max-w-5xl space-y-6 animate-pulse">
        <div className="h-8 w-56 rounded-xl bg-stone-200 dark:bg-zinc-800" />
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[1, 2, 3, 4].map((n) => (
            <div key={n} className="h-28 rounded-2xl bg-stone-200/80 dark:bg-zinc-800/80" />
          ))}
        </div>
        <div className="h-64 rounded-2xl bg-stone-200/70 dark:bg-zinc-800/70" />
      </div>
    </div>
  );
}

function SoloDeskRouter() {
  const { screenMode, loadingAuth, activeSection } = useApp();

  if (loadingAuth) {
    return <WorkspaceSkeleton />;
  }

  if (screenMode === 'landing') {
    return <LandingPage />;
  }

  if (screenMode === 'auth') {
    return <AuthScreen />;
  }

  if (screenMode === 'verify_email') {
    return <VerifyEmailScreen />;
  }

  if (screenMode === 'onboarding') {
    return <OnboardingWizard />;
  }

  return (
    <>
      <AppShell>
        {activeSection === 'dashboard' && <DashboardView />}
        {activeSection === 'orders' && <OrdersView />}
        {activeSection === 'customers' && <CustomersView />}
        {activeSection === 'tasks' && <TasksView />}
        {activeSection === 'money' && <MoneyView />}
        {activeSection === 'assistant' && <AiAssistantView />}
        {activeSection === 'settings' && <SettingsView />}
      </AppShell>
      <OrderFormModal />
      <MessageWriterModal />
      <GlobalSearchModal />
    </>
  );
}

export default function App() {
  return (
    <AppProvider>
      <SoloDeskRouter />
    </AppProvider>
  );
}
