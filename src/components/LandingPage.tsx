import React, { useState } from 'react';
import {
  ArrowRight,
  Check,
  CheckCircle2,
  CreditCard,
  ListChecks,
  MessageSquare,
  Sparkles,
  Store,
} from 'lucide-react';
import { useApp } from '../context/AppContext';

const HERO_IMAGE = '/src/assets/images/solodesk_maker_studio_hero_1792929063957.jpg';
const BAKER_IMAGE = '/src/assets/images/craft_baker_artisan_1792929064885.jpg';
const GIFT_IMAGE = '/src/assets/images/floral_gift_packaging_1792929065826.jpg';

function StudioImage({
  src,
  alt,
  fallbackTitle,
  className = '',
}: {
  src: string;
  alt: string;
  fallbackTitle: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div
        className={`flex flex-col items-center justify-center bg-gradient-to-br from-stone-200 via-stone-100 to-amber-50 p-8 text-center dark:from-zinc-800 dark:via-zinc-900 dark:to-zinc-800 ${className}`}
      >
        <Store className="h-8 w-8 text-stone-500 dark:text-zinc-400" aria-hidden="true" />
        <p className="mt-3 font-display text-base font-medium text-stone-700 dark:text-zinc-200">
          {fallbackTitle}
        </p>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={`object-cover ${className}`}
    />
  );
}

export function LandingPage() {
  const { openAuthScreen, enterDemoMode } = useApp();

  const [samplePrompt, setSamplePrompt] = useState(
    'Sarah ordered an A4 couple portrait for £20 plus a pet for £2. She paid £11 deposit and needs it by 14 November.'
  );

  return (
    <div className="min-h-screen bg-[#f8f8f7] text-stone-900 dark:bg-[#0c0c0e] dark:text-zinc-100">
      {/* Strict 3-Zone Top Bar Contract */}
      <header className="sticky top-0 z-30 border-b border-stone-200/80 bg-[#f8f8f7]/90 backdrop-blur-md dark:border-zinc-800/80 dark:bg-[#0c0c0e]/90">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-8 px-6 py-4">
          <a
            href="#top"
            className="font-display text-xl font-semibold tracking-tight text-stone-900 whitespace-nowrap shrink-0 dark:text-zinc-100"
          >
            SoloDesk
          </a>

          <nav
            aria-label="Marketing navigation"
            className="hidden items-center gap-7 text-sm font-medium text-stone-600 md:flex dark:text-zinc-400"
          >
            <a
              href="#how-it-works"
              className="transition-colors hover:text-stone-900 hover:underline hover:underline-offset-4 whitespace-nowrap shrink-0 dark:hover:text-zinc-100"
            >
              How It Works
            </a>
            <a
              href="#ai-orders"
              className="transition-colors hover:text-stone-900 hover:underline hover:underline-offset-4 whitespace-nowrap shrink-0 dark:hover:text-zinc-100"
            >
              AI Orders
            </a>
            <a
              href="#built-for"
              className="transition-colors hover:text-stone-900 hover:underline hover:underline-offset-4 whitespace-nowrap shrink-0 dark:hover:text-zinc-100"
            >
              Built For
            </a>
            <a
              href="#pricing"
              className="transition-colors hover:text-stone-900 hover:underline hover:underline-offset-4 whitespace-nowrap shrink-0 dark:hover:text-zinc-100"
            >
              Pricing
            </a>
          </nav>

          <div className="flex items-center shrink-0">
            <button
              type="button"
              onClick={() => openAuthScreen('signup')}
              className="rounded-xl bg-stone-900 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-stone-800 whitespace-nowrap shrink-0 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              Start Free
            </button>
          </div>
        </div>
      </header>

      <main id="top">
        {/* Hero Section */}
        <section className="mx-auto max-w-6xl px-6 pt-14 pb-20 lg:pt-20 lg:pb-28">
          <div className="grid grid-cols-1 items-stretch gap-12 lg:grid-cols-12">
            <div className="flex flex-col justify-center lg:col-span-6">
              <p className="text-xs font-medium tracking-wide text-stone-500 dark:text-zinc-400">
                Built for makers, freelancers & independent studios
              </p>
              <h1 className="mt-4 max-w-xl font-display text-4xl font-semibold tracking-tight text-stone-900 [text-wrap:balance] sm:text-5xl lg:text-[3.35rem] lg:leading-[1.08] dark:text-zinc-50">
                Your business. Without the admin headache.
              </h1>
              <p className="mt-5 max-w-lg text-base leading-relaxed text-stone-600 sm:text-lg dark:text-zinc-400">
                Track orders, customers, payments and deadlines — and let AI handle the boring bits.
              </p>

              <div className="mt-8 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => openAuthScreen('signup')}
                  className="inline-flex items-center gap-2 rounded-xl bg-stone-900 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-stone-800 whitespace-nowrap shrink-0 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
                >
                  Start Free
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </button>
                <a
                  href="#how-it-works"
                  className="inline-flex items-center justify-center rounded-xl border border-stone-300 bg-white px-5 py-3 text-sm font-medium text-stone-800 transition-colors hover:bg-stone-50 whitespace-nowrap shrink-0 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
                >
                  See How It Works
                </a>
              </div>

              <div className="mt-6 flex flex-wrap items-center gap-4 text-xs text-stone-500 dark:text-zinc-400">
                <button
                  type="button"
                  onClick={enterDemoMode}
                  className="font-semibold text-stone-800 underline underline-offset-4 transition-colors hover:text-stone-950 dark:text-zinc-200 dark:hover:text-white"
                >
                  Explore interactive demo (Luna Creative Studio)
                </button>
                <span aria-hidden="true">·</span>
                <button
                  type="button"
                  onClick={() => openAuthScreen('login')}
                  className="font-medium text-stone-600 hover:text-stone-900 dark:text-zinc-400 dark:hover:text-zinc-100"
                >
                  Already have an account? Log in
                </button>
              </div>
            </div>

            <div className="lg:col-span-6">
              <div className="relative h-full min-h-[320px] overflow-hidden rounded-2xl border border-stone-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
                <StudioImage
                  src={HERO_IMAGE}
                  alt="Sunlit creative desk with framed couple portrait illustration and wrapped customer parcels"
                  fallbackTitle="Luna Creative Studio Workspace"
                  className="h-full w-full lg:h-full"
                />
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-6 text-white">
                  <p className="text-xs font-medium text-stone-200">
                    Today’s Focus · Luna Creative Studio
                  </p>
                  <p className="mt-1 text-sm font-semibold">
                    Emma’s A4 Couple Portrait due 14 Nov · £11 deposit paid · Ready for colour preview
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Proof / Clarity Strip */}
          <div className="mt-12 grid grid-cols-1 gap-6 rounded-2xl border border-stone-200 bg-white p-6 sm:grid-cols-3 dark:border-zinc-800 dark:bg-zinc-900">
            <div>
              <p className="font-mono text-2xl font-semibold text-stone-900 tabular-nums dark:text-zinc-100">
                15 sec
              </p>
              <p className="mt-1 text-sm text-stone-600 dark:text-zinc-400">
                Turn a WhatsApp or Instagram message into a structured order with tasks.
              </p>
            </div>
            <div className="border-t border-stone-100 pt-4 sm:border-t-0 sm:border-l sm:pt-0 sm:pl-6 dark:border-zinc-800">
              <p className="font-mono text-2xl font-semibold text-stone-900 tabular-nums dark:text-zinc-100">
                100% clear
              </p>
              <p className="mt-1 text-sm text-stone-600 dark:text-zinc-400">
                Deposits, remaining balances, and dispatch deadlines visible at a glance.
              </p>
            </div>
            <div className="border-t border-stone-100 pt-4 sm:border-t-0 sm:border-l sm:pt-0 sm:pl-6 dark:border-zinc-800">
              <p className="font-mono text-2xl font-semibold text-stone-900 tabular-nums dark:text-zinc-100">
                Zero bloat
              </p>
              <p className="mt-1 text-sm text-stone-600 dark:text-zinc-400">
                No double-entry accounting jargon or enterprise CRM clutter.
              </p>
            </div>
          </div>
        </section>

        {/* Section 1: Everything in one place */}
        <section
          id="how-it-works"
          className="border-t border-stone-200/80 bg-white py-20 dark:border-zinc-800/80 dark:bg-zinc-900/40"
        >
          <div className="mx-auto max-w-6xl px-6">
            <div className="max-w-2xl">
              <p className="text-xs font-medium text-stone-500 dark:text-zinc-400">
                01. Everything in one place
              </p>
              <h2 className="mt-2 font-display text-3xl font-semibold tracking-tight text-stone-900 [text-wrap:balance] sm:text-4xl dark:text-zinc-100">
                Stop piecing orders together from DMs, notebooks, and spreadsheets.
              </h2>
              <p className="mt-3 text-base text-stone-600 dark:text-zinc-400">
                Whether an order arrives through Instagram, WhatsApp, Facebook, Etsy, or email, SoloDesk keeps every detail, note, and payment calmly organised in one place.
              </p>
            </div>

            <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-3">
              <div className="rounded-2xl border border-stone-200 bg-[#f8f8f7] p-6 dark:border-zinc-800 dark:bg-zinc-900">
                <ListChecks className="h-5 w-5 text-stone-700 dark:text-zinc-300" aria-hidden="true" />
                <h3 className="mt-4 text-base font-semibold text-stone-900 dark:text-zinc-100">
                  Know what needs doing today
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-stone-600 dark:text-zinc-400">
                  Every order automatically creates practical checklist steps — from sending previews to posting parcels — and surfaces urgent items on your morning dashboard.
                </p>
              </div>

              <div className="rounded-2xl border border-stone-200 bg-[#f8f8f7] p-6 dark:border-zinc-800 dark:bg-zinc-900">
                <CreditCard className="h-5 w-5 text-stone-700 dark:text-zinc-300" aria-hidden="true" />
                <h3 className="mt-4 text-base font-semibold text-stone-900 dark:text-zinc-100">
                  Never forget a payment
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-stone-600 dark:text-zinc-400">
                  Track 50% deposits, SumUp, PayPal, cash, or bank transfers effortlessly. Always know exactly who has paid in full and who still owes a balance.
                </p>
              </div>

              <div className="rounded-2xl border border-stone-200 bg-[#f8f8f7] p-6 dark:border-zinc-800 dark:bg-zinc-900">
                <MessageSquare className="h-5 w-5 text-stone-700 dark:text-zinc-300" aria-hidden="true" />
                <h3 className="mt-4 text-base font-semibold text-stone-900 dark:text-zinc-100">
                  Polite customer updates in seconds
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-stone-600 dark:text-zinc-400">
                  Draft warm, natural payment reminders, preview messages, and dispatch notes ready to copy straight into WhatsApp or Instagram.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Section 2: Create orders with AI */}
        <section id="ai-orders" className="mx-auto max-w-6xl px-6 py-20">
          <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-12">
            <div className="lg:col-span-5">
              <p className="text-xs font-medium text-stone-500 dark:text-zinc-400">
                02. Create orders with AI
              </p>
              <h2 className="mt-2 font-display text-3xl font-semibold tracking-tight text-stone-900 [text-wrap:balance] sm:text-4xl dark:text-zinc-100">
                Type how you naturally talk. SoloDesk fills out the form.
              </h2>
              <p className="mt-4 text-base leading-relaxed text-stone-600 dark:text-zinc-400">
                Paste a quick summary of what your customer asked for. SoloDesk extracts the customer, product, extras, deposit, remaining balance, and deadline — and always lets you check everything before saving.
              </p>
              <div className="mt-6">
                <button
                  type="button"
                  onClick={enterDemoMode}
                  className="inline-flex items-center gap-2 rounded-xl bg-stone-900 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-stone-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
                >
                  <Sparkles className="h-4 w-4" aria-hidden="true" />
                  Try AI Order Creation Live
                </button>
              </div>
            </div>

            <div className="lg:col-span-7">
              <div className="rounded-2xl border border-stone-200 bg-white p-6 sm:p-8 dark:border-zinc-800 dark:bg-zinc-900">
                <label
                  htmlFor="landing-ai-demo"
                  className="block text-xs font-medium text-stone-500 dark:text-zinc-400"
                >
                  Natural-language order note
                </label>
                <textarea
                  id="landing-ai-demo"
                  rows={3}
                  value={samplePrompt}
                  onChange={(e) => setSamplePrompt(e.target.value)}
                  className="mt-2 w-full rounded-xl border border-stone-200 bg-stone-50 p-3.5 text-sm text-stone-800 focus:border-stone-400 focus:outline-none dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200"
                />

                <div className="mt-6 border-t border-stone-100 pt-5 dark:border-zinc-800">
                  <p className="text-xs font-semibold text-stone-900 dark:text-zinc-100">
                    I understood (always reviewed by you before saving):
                  </p>
                  <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-3">
                    <div>
                      <dt className="text-xs text-stone-500 dark:text-zinc-400">Customer</dt>
                      <dd className="mt-0.5 font-medium text-stone-900 dark:text-zinc-100">Sarah</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-stone-500 dark:text-zinc-400">Product</dt>
                      <dd className="mt-0.5 font-medium text-stone-900 dark:text-zinc-100">
                        A4 Couple Portrait
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-stone-500 dark:text-zinc-400">Extras</dt>
                      <dd className="mt-0.5 font-medium text-stone-900 dark:text-zinc-100">Pet</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-stone-500 dark:text-zinc-400">Total</dt>
                      <dd className="mt-0.5 font-mono font-semibold text-stone-900 tabular-nums dark:text-zinc-100">
                        £22
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-stone-500 dark:text-zinc-400">Paid / Remaining</dt>
                      <dd className="mt-0.5 font-mono font-medium text-stone-900 tabular-nums dark:text-zinc-100">
                        £11 / £11
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-stone-500 dark:text-zinc-400">Due</dt>
                      <dd className="mt-0.5 font-medium text-stone-900 dark:text-zinc-100">
                        14 November
                      </dd>
                    </div>
                  </dl>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Section 3: Built for tiny businesses */}
        <section
          id="built-for"
          className="border-t border-stone-200/80 bg-white py-20 dark:border-zinc-800/80 dark:bg-zinc-900/40"
        >
          <div className="mx-auto max-w-6xl px-6">
            <div className="max-w-2xl">
              <p className="text-xs font-medium text-stone-500 dark:text-zinc-400">
                03. Built for tiny businesses
              </p>
              <h2 className="mt-2 font-display text-3xl font-semibold tracking-tight text-stone-900 [text-wrap:balance] sm:text-4xl dark:text-zinc-100">
                Made for one-person businesses doing creative, hands-on work.
              </h2>
              <p className="mt-3 text-base text-stone-600 dark:text-zinc-400">
                Designed around how sole traders actually work — custom commissions, deposits, preview approvals, local collections, and post-office runs.
              </p>
            </div>

            <div className="mt-12 grid grid-cols-1 gap-8 md:grid-cols-2">
              <div className="overflow-hidden rounded-2xl border border-stone-200 bg-[#f8f8f7] dark:border-zinc-800 dark:bg-zinc-900">
                <StudioImage
                  src={BAKER_IMAGE}
                  alt="Artisan celebration cake with bespoke wooden birthday topper in a bright studio kitchen"
                  fallbackTitle="Bakers, Cake Makers & Event Creators"
                  className="aspect-[4/3] w-full"
                />
                <div className="p-6">
                  <h3 className="text-lg font-semibold text-stone-900 dark:text-zinc-100">
                    Bakers, Photographers & Beauty Pros
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-stone-600 dark:text-zinc-400">
                    Keep booking dates, deposits, flavour or styling notes, and collection schedules crystal clear without juggling three calendars.
                  </p>
                </div>
              </div>

              <div className="overflow-hidden rounded-2xl border border-stone-200 bg-[#f8f8f7] dark:border-zinc-800 dark:bg-zinc-900">
                <StudioImage
                  src={GIFT_IMAGE}
                  alt="Handmade personalised gift boxes wrapped with linen ribbon and shipping labels"
                  fallbackTitle="Etsy Sellers, Illustrators & Craft Studios"
                  className="aspect-[4/3] w-full"
                />
                <div className="p-6">
                  <h3 className="text-lg font-semibold text-stone-900 dark:text-zinc-100">
                    Etsy Sellers, Illustrators & Gift Makers
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-stone-600 dark:text-zinc-400">
                    Track personalisation wording, proof approvals, Royal Mail tracking numbers, and material expenses in GBP £, EUR €, USD $, or RON lei.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Section 4: Simple Pricing Preview */}
        <section id="pricing" className="mx-auto max-w-5xl px-6 py-20">
          <div className="text-center">
            <p className="text-xs font-medium text-stone-500 dark:text-zinc-400">04. Simple pricing</p>
            <h2 className="mt-2 font-display text-3xl font-semibold tracking-tight text-stone-900 [text-wrap:balance] sm:text-4xl dark:text-zinc-100">
              Start free. Upgrade only when your order book grows.
            </h2>
            <p className="mt-3 text-sm text-stone-600 dark:text-zinc-400">
              No credit card required. Cancel or switch plans anytime.
            </p>
          </div>

          <div className="mt-12 grid grid-cols-1 gap-8 md:grid-cols-2">
            {/* Free Plan */}
            <div className="flex flex-col justify-between rounded-2xl border border-stone-200 bg-white p-8 dark:border-zinc-800 dark:bg-zinc-900">
              <div>
                <p className="text-sm font-semibold text-stone-900 dark:text-zinc-100">Free</p>
                <p className="mt-1 text-xs text-stone-500 dark:text-zinc-400">
                  For side hustles & getting started
                </p>
                <div className="mt-5 flex items-baseline gap-1">
                  <span className="font-mono text-4xl font-semibold text-stone-900 tabular-nums dark:text-zinc-100">
                    £0
                  </span>
                  <span className="text-sm text-stone-500 dark:text-zinc-400">/forever</span>
                </div>

                <ul className="mt-6 space-y-3 text-sm text-stone-700 dark:text-zinc-300">
                  {[
                    'Up to 10 active orders',
                    'Customer management',
                    'Payment tracking',
                    'Basic dashboard',
                  ].map((feat) => (
                    <li key={feat} className="flex items-center gap-2.5">
                      <Check className="h-4 w-4 shrink-0 text-stone-600 dark:text-zinc-400" />
                      <span>{feat}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="mt-8">
                <button
                  type="button"
                  onClick={() => openAuthScreen('signup')}
                  className="w-full rounded-xl border border-stone-300 px-4 py-2.5 text-sm font-semibold text-stone-900 transition-colors hover:bg-stone-50 dark:border-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-800"
                >
                  Start Free
                </button>
                <p className="mt-2.5 text-center text-xs text-stone-500 dark:text-zinc-400">
                  No credit card required.
                </p>
              </div>
            </div>

            {/* Solo Plan */}
            <div className="flex flex-col justify-between rounded-2xl border-2 border-stone-900 bg-white p-8 dark:border-zinc-200 dark:bg-zinc-900">
              <div>
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-stone-900 dark:text-zinc-100">Solo</p>
                  <span className="text-xs font-medium text-stone-600 dark:text-zinc-400">
                    For busy sole traders
                  </span>
                </div>
                <p className="mt-1 text-xs text-stone-500 dark:text-zinc-400">
                  Full AI assistant & unlimited orders
                </p>
                <div className="mt-5 flex items-baseline gap-1">
                  <span className="font-mono text-4xl font-semibold text-stone-900 tabular-nums dark:text-zinc-100">
                    £5.99
                  </span>
                  <span className="text-sm text-stone-500 dark:text-zinc-400">/month</span>
                </div>

                <ul className="mt-6 space-y-3 text-sm text-stone-700 dark:text-zinc-300">
                  {[
                    'Unlimited orders',
                    'AI order creation',
                    'AI assistant',
                    'AI message writer',
                    'Business insights',
                    'Advanced reports',
                  ].map((feat) => (
                    <li key={feat} className="flex items-center gap-2.5">
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-stone-900 dark:text-zinc-100" />
                      <span>{feat}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="mt-8">
                <button
                  type="button"
                  onClick={() => openAuthScreen('signup')}
                  className="w-full rounded-xl bg-stone-900 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-stone-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
                >
                  Start Free Trial
                </button>
                <p className="mt-2.5 text-center text-xs text-stone-500 dark:text-zinc-400">
                  No credit card required.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Quiet Footer */}
      <footer className="border-t border-stone-200/80 py-10 dark:border-zinc-800/80">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 text-xs text-stone-500 sm:flex-row dark:text-zinc-400">
          <div className="flex items-center gap-3">
            <span className="font-display text-sm font-semibold text-stone-800 dark:text-zinc-200">
              SoloDesk
            </span>
            <span aria-hidden="true">·</span>
            <span>Run your small business without becoming an admin person.</span>
          </div>
          <div className="flex items-center gap-6">
            <button
              type="button"
              onClick={enterDemoMode}
              className="hover:text-stone-900 dark:hover:text-zinc-200"
            >
              Interactive Demo
            </button>
            <button
              type="button"
              onClick={() => openAuthScreen('login')}
              className="hover:text-stone-900 dark:hover:text-zinc-200"
            >
              Log in
            </button>
            <button
              type="button"
              onClick={() => openAuthScreen('signup')}
              className="hover:text-stone-900 dark:hover:text-zinc-200"
            >
              Sign up
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
