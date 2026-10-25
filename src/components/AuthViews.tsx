import React, { useState } from 'react';
import {
  createUserWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
} from 'firebase/auth';
import { ArrowLeft, ArrowRight, CheckCircle2, Mail, Sparkles } from 'lucide-react';
import { auth, googleProvider } from '../firebase';
import { useApp } from '../context/AppContext';
import { CURRENCIES, CurrencyCode } from '../types';
import { sanitizeUserFacingMessage } from '../utils/businessLogic';

const BUSINESS_TYPES = [
  'Illustrator / Portrait Artist',
  'Etsy / Craft Business',
  'Baker / Cake Maker',
  'Personalised Gifts Seller',
  'Photographer / Videographer',
  'Beauty / Nail / Lash Professional',
  'Freelancer / Sole Trader',
  'Home Business / Other',
];

function friendlyAuthError(err: unknown, fallback: string): string {
  const code = (err as { code?: string })?.code || '';
  if (code === 'auth/invalid-email') {
    return 'Please enter a valid email address.';
  }
  if (code === 'auth/user-disabled') {
    return 'This account has been disabled. Please contact support.';
  }
  if (code === 'auth/too-many-requests') {
    return 'Too many attempts right now. Please wait a minute and try again.';
  }
  if (code === 'auth/network-request-failed') {
    return 'Network connection interrupted. Please check your internet and try again.';
  }
  if (code === 'auth/popup-blocked') {
    return 'Your browser blocked the sign-in window. Please allow popups for SoloDesk and try again.';
  }
  return sanitizeUserFacingMessage(err, fallback);
}

export function AuthScreen() {
  const { authModeInitial, backToLanding, enterDemoMode, showToast } = useApp();
  const [mode, setMode] = useState<'login' | 'signup' | 'forgot'>(authModeInitial);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [providerNotice, setProviderNotice] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  const handleGoogleSignIn = async () => {
    setErrorMsg(null);
    setBusy(true);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code || '';
      if (code !== 'auth/popup-closed-by-user') {
        setErrorMsg(friendlyAuthError(err, 'Unable to sign in with Google right now.'));
      }
    } finally {
      setBusy(false);
    }
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setProviderNotice(false);

    const trimmedEmail = email.trim();
    if (!trimmedEmail || !trimmedEmail.includes('@')) {
      setErrorMsg('Please enter a valid email address.');
      return;
    }

    if (mode === 'forgot') {
      setBusy(true);
      try {
        await sendPasswordResetEmail(auth, trimmedEmail);
        setResetSent(true);
        showToast('Password reset link sent if an account exists.', 'info');
      } catch (err: unknown) {
        const code = (err as { code?: string })?.code || '';
        if (code === 'auth/operation-not-allowed') {
          setProviderNotice(true);
        } else {
          setErrorMsg(friendlyAuthError(err, 'Could not send reset email right now.'));
        }
      } finally {
        setBusy(false);
      }
      return;
    }

    if (password.length < 6) {
      setErrorMsg('Password must be at least 6 characters.');
      return;
    }

    setBusy(true);
    try {
      if (mode === 'signup') {
        const cred = await createUserWithEmailAndPassword(auth, trimmedEmail, password);
        await sendEmailVerification(cred.user);
      } else {
        await signInWithEmailAndPassword(auth, trimmedEmail, password);
      }
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code || '';
      if (code === 'auth/operation-not-allowed') {
        setProviderNotice(true);
      } else if (
        code === 'auth/invalid-credential' ||
        code === 'auth/wrong-password' ||
        code === 'auth/user-not-found'
      ) {
        setErrorMsg('Incorrect email or password. Please check and try again.');
      } else if (code === 'auth/email-already-in-use') {
        setErrorMsg('An account with this email already exists. Try logging in instead.');
      } else {
        setErrorMsg(friendlyAuthError(err, 'Unable to sign in right now. Please try again.'));
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col justify-between bg-[#f8f8f7] px-4 py-8 dark:bg-[#0c0c0e]">
      <div className="mx-auto w-full max-w-md">
        <button
          type="button"
          onClick={backToLanding}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-stone-600 transition-colors hover:text-stone-900 dark:text-zinc-400 dark:hover:text-zinc-100"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
          Back to SoloDesk
        </button>
      </div>

      <div className="mx-auto my-8 w-full max-w-md rounded-2xl border border-stone-200 bg-white p-7 sm:p-8 dark:border-zinc-800 dark:bg-zinc-900">
        <div>
          <p className="font-display text-lg font-semibold text-stone-900 dark:text-zinc-100">
            SoloDesk
          </p>
          <h1 className="mt-3 font-display text-2xl font-semibold text-stone-900 dark:text-zinc-50">
            {mode === 'signup'
              ? 'Create your free workspace'
              : mode === 'login'
                ? 'Welcome back'
                : 'Reset your password'}
          </h1>
          <p className="mt-1.5 text-sm text-stone-600 dark:text-zinc-400">
            {mode === 'signup'
              ? 'Start managing orders, payments, and tasks calmly.'
              : mode === 'login'
                ? 'Log in to access your orders and customers.'
                : 'Enter your email and we will send a password reset link.'}
          </p>
        </div>

        {mode !== 'forgot' && (
          <div className="mt-6">
            <button
              type="button"
              disabled={busy}
              onClick={handleGoogleSignIn}
              className="flex w-full items-center justify-center gap-2.5 rounded-xl bg-stone-900 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-stone-800 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              Continue with Google
            </button>

            <div className="my-5 flex items-center gap-3 text-xs text-stone-400 dark:text-zinc-500">
              <div className="h-px flex-1 bg-stone-200 dark:bg-zinc-800" />
              <span>or use email</span>
              <div className="h-px flex-1 bg-stone-200 dark:bg-zinc-800" />
            </div>
          </div>
        )}

        {providerNotice && (
          <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50/70 p-3.5 text-xs leading-relaxed text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
            <p className="font-semibold">Email/Password login is not enabled on this Firebase project yet.</p>
            <p className="mt-1">
              Use <strong>Continue with Google</strong> above right away, or enable{' '}
              <strong>Authentication &rarr; Sign-in method &rarr; Email/Password</strong> in your Firebase Console.
            </p>
          </div>
        )}

        {errorMsg && (
          <div
            role="alert"
            className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300"
          >
            {errorMsg}
          </div>
        )}

        {resetSent && mode === 'forgot' ? (
          <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50/60 p-4 text-sm text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-200">
            <p className="font-medium">Check your inbox</p>
            <p className="mt-1 text-xs">
              If an account exists for {email}, a reset link is on its way.
            </p>
            <button
              type="button"
              onClick={() => {
                setResetSent(false);
                setMode('login');
              }}
              className="mt-3 text-xs font-semibold underline"
            >
              Return to log in
            </button>
          </div>
        ) : (
          <form onSubmit={handleEmailSubmit} className="mt-4 space-y-4">
            <div>
              <label
                htmlFor="auth-email"
                className="block text-xs font-medium text-stone-700 dark:text-zinc-300"
              >
                Email address
              </label>
              <input
                id="auth-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@yourstudio.com"
                className="mt-1.5 w-full rounded-xl border border-stone-200 bg-white px-3.5 py-2.5 text-sm text-stone-900 focus:border-stone-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
              />
            </div>

            {mode !== 'forgot' && (
              <div>
                <div className="flex items-center justify-between">
                  <label
                    htmlFor="auth-password"
                    className="block text-xs font-medium text-stone-700 dark:text-zinc-300"
                  >
                    Password
                  </label>
                  {mode === 'login' && (
                    <button
                      type="button"
                      onClick={() => {
                        setErrorMsg(null);
                        setMode('forgot');
                      }}
                      className="text-xs font-medium text-stone-500 hover:text-stone-900 dark:text-zinc-400 dark:hover:text-zinc-200"
                    >
                      Forgot password?
                    </button>
                  )}
                </div>
                <input
                  id="auth-password"
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  className="mt-1.5 w-full rounded-xl border border-stone-200 bg-white px-3.5 py-2.5 text-sm text-stone-900 focus:border-stone-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                />
              </div>
            )}

            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-xl border border-stone-300 bg-stone-50 px-4 py-2.5 text-sm font-semibold text-stone-900 transition-colors hover:bg-stone-100 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700"
            >
              {busy
                ? 'Please wait…'
                : mode === 'signup'
                  ? 'Sign up with Email'
                  : mode === 'login'
                    ? 'Log in with Email'
                    : 'Send Reset Link'}
            </button>
          </form>
        )}

        <div className="mt-6 flex items-center justify-between border-t border-stone-100 pt-5 text-xs text-stone-600 dark:border-zinc-800 dark:text-zinc-400">
          {mode === 'signup' ? (
            <button
              type="button"
              onClick={() => {
                setErrorMsg(null);
                setMode('login');
              }}
              className="font-medium hover:text-stone-900 dark:hover:text-zinc-100"
            >
              Already have an account? Log in
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                setErrorMsg(null);
                setMode('signup');
              }}
              className="font-medium hover:text-stone-900 dark:hover:text-zinc-100"
            >
              New to SoloDesk? Sign up free
            </button>
          )}

          <button
            type="button"
            onClick={enterDemoMode}
            className="font-semibold text-stone-900 underline underline-offset-4 dark:text-zinc-200"
          >
            Try Live Demo
          </button>
        </div>
      </div>

      <p className="text-center text-xs text-stone-400 dark:text-zinc-500">
        Your business data is isolated and protected by Firebase security rules.
      </p>
    </div>
  );
}

export function VerifyEmailScreen() {
  const {
    firebaseUser,
    refreshVerificationStatus,
    resendVerificationEmail,
    logout,
    enterDemoMode,
  } = useApp();

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f8f8f7] p-4 dark:bg-[#0c0c0e]">
      <div className="w-full max-w-md rounded-2xl border border-stone-200 bg-white p-8 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-stone-100 text-stone-700 dark:bg-zinc-800 dark:text-zinc-200">
          <Mail className="h-5 w-5" aria-hidden="true" />
        </div>
        <h1 className="mt-4 font-display text-2xl font-semibold text-stone-900 dark:text-zinc-100">
          Verify your email address
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-stone-600 dark:text-zinc-400">
          We sent a verification link to <strong>{firebaseUser?.email}</strong>. Verify your email to unlock secure cloud storage for your business.
        </p>

        <div className="mt-6 space-y-2.5">
          <button
            type="button"
            onClick={refreshVerificationStatus}
            className="w-full rounded-xl bg-stone-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-stone-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            I’ve verified my email — Continue
          </button>
          <button
            type="button"
            onClick={resendVerificationEmail}
            className="w-full rounded-xl border border-stone-200 px-4 py-2.5 text-sm font-medium text-stone-700 hover:bg-stone-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            Resend verification email
          </button>
        </div>

        <div className="mt-6 flex items-center justify-between border-t border-stone-100 pt-4 text-xs text-stone-500 dark:border-zinc-800 dark:text-zinc-400">
          <button type="button" onClick={logout} className="hover:text-stone-900 dark:hover:text-zinc-200">
            Sign out
          </button>
          <button
            type="button"
            onClick={enterDemoMode}
            className="font-semibold text-stone-900 underline dark:text-zinc-200"
          >
            Explore Demo Workspace meanwhile
          </button>
        </div>
      </div>
    </div>
  );
}

export function OnboardingWizard() {
  const { firebaseUser, completeOnboarding, logout } = useApp();
  const [ownerName, setOwnerName] = useState(firebaseUser?.displayName || '');
  const [businessName, setBusinessName] = useState('');
  const [businessType, setBusinessType] = useState(BUSINESS_TYPES[0]);
  const [currency, setCurrency] = useState<CurrencyCode>('GBP');
  const [loadSampleData, setLoadSampleData] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ownerName.trim() || !businessName.trim()) {
      setError('Please enter your name and your business name.');
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await completeOnboarding({
        ownerName: ownerName.trim(),
        businessName: businessName.trim(),
        businessType: businessType.trim(),
        currency,
        loadSampleData,
      });
    } catch (err) {
      setError(
        sanitizeUserFacingMessage(err, 'Unable to save setup right now. Please try again.')
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f8f8f7] px-4 py-10 dark:bg-[#0c0c0e]">
      <div className="w-full max-w-lg rounded-2xl border border-stone-200 bg-white p-8 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-center justify-between">
          <span className="font-display text-lg font-semibold text-stone-900 dark:text-zinc-100">
            SoloDesk Setup
          </span>
          <button
            type="button"
            onClick={logout}
            className="text-xs text-stone-500 hover:text-stone-800 dark:text-zinc-400 dark:hover:text-zinc-200"
          >
            Log out
          </button>
        </div>

        <h1 className="mt-4 font-display text-2xl font-semibold text-stone-900 dark:text-zinc-50">
          Tell us a little about your business
        </h1>
        <p className="mt-1.5 text-sm text-stone-600 dark:text-zinc-400">
          Takes 20 seconds. You can change any of these later in Settings.
        </p>

        {error && (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-6 space-y-5">
          <div>
            <label
              htmlFor="onb-name"
              className="block text-xs font-semibold text-stone-800 dark:text-zinc-200"
            >
              1. What is your name?
            </label>
            <input
              id="onb-name"
              type="text"
              required
              maxLength={120}
              value={ownerName}
              onChange={(e) => setOwnerName(e.target.value)}
              placeholder="e.g. Clara Bennett"
              className="mt-1.5 w-full rounded-xl border border-stone-200 bg-white px-3.5 py-2.5 text-sm text-stone-900 focus:border-stone-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
            />
          </div>

          <div>
            <label
              htmlFor="onb-biz-name"
              className="block text-xs font-semibold text-stone-800 dark:text-zinc-200"
            >
              2. What is your business called?
            </label>
            <input
              id="onb-biz-name"
              type="text"
              required
              maxLength={140}
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              placeholder="e.g. Luna Creative Studio"
              className="mt-1.5 w-full rounded-xl border border-stone-200 bg-white px-3.5 py-2.5 text-sm text-stone-900 focus:border-stone-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
            />
          </div>

          <div>
            <label
              htmlFor="onb-biz-type"
              className="block text-xs font-semibold text-stone-800 dark:text-zinc-200"
            >
              3. What type of business do you run?
            </label>
            <select
              id="onb-biz-type"
              value={businessType}
              onChange={(e) => setBusinessType(e.target.value)}
              className="mt-1.5 w-full rounded-xl border border-stone-200 bg-white px-3.5 py-2.5 text-sm text-stone-900 focus:border-stone-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
            >
              {BUSINESS_TYPES.map((bt) => (
                <option key={bt} value={bt}>
                  {bt}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="onb-currency"
              className="block text-xs font-semibold text-stone-800 dark:text-zinc-200"
            >
              4. What currency do you use?
            </label>
            <div className="mt-2 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
              {(Object.keys(CURRENCIES) as CurrencyCode[]).map((code) => {
                const cfg = CURRENCIES[code];
                const active = currency === code;
                return (
                  <button
                    key={code}
                    type="button"
                    onClick={() => setCurrency(code)}
                    className={`flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2.5 text-sm font-medium transition-colors ${
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

          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-stone-200 bg-stone-50/70 p-3.5 dark:border-zinc-800 dark:bg-zinc-950">
            <input
              type="checkbox"
              checked={loadSampleData}
              onChange={(e) => setLoadSampleData(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-stone-300 text-stone-900"
            />
            <span className="text-xs leading-relaxed text-stone-600 dark:text-zinc-400">
              <strong className="font-semibold text-stone-900 dark:text-zinc-200">
                Include sample orders & customers
              </strong>{' '}
              so my dashboard isn’t empty while I explore SoloDesk.
            </span>
          </label>

          <button
            type="submit"
            disabled={saving}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-stone-900 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-stone-800 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            {saving ? (
              'Setting up your workspace…'
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                Open My Workspace
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
