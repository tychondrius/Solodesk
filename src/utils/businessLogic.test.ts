import test from 'node:test';
import assert from 'node:assert/strict';
import {
  answerAssistantLocally,
  calculateOrderBalance,
  computeDailyRevenueSeries,
  computeDashboardMetrics,
  computeMoneySummary,
  computeMonthlyFinanceSeries,
  computeTodaysFocus,
  formatCurrency,
  generateTasksForOrder,
  getTimeGreeting,
  isDeterministicAssistantQuery,
  isUsableOrderDraft,
  parseNaturalDueDate,
  parseOrderLocally,
  runGlobalSearch,
  sanitizeUserFacingMessage,
  validateParsedOrderDraft,
} from './businessLogic';
import { createLunaDemoSeed } from '../data/demoData';

test('currency formatting handles GBP, EUR, USD prefixes and RON lei suffix accurately', () => {
  assert.equal(formatCurrency(22, 'GBP'), '£22');
  assert.equal(formatCurrency(14.5, 'GBP'), '£14.50');
  assert.equal(formatCurrency(35, 'EUR'), '€35');
  assert.equal(formatCurrency(99.9, 'USD'), '$99.90');
  assert.equal(formatCurrency(120, 'RON'), '120 lei');
  assert.equal(formatCurrency(45.5, 'RON'), '45.50 lei');
});

test('time greeting adapts to morning, afternoon, and evening with first name', () => {
  assert.equal(getTimeGreeting(9, 'Clara Bennett'), 'Good morning, Clara.');
  assert.equal(getTimeGreeting(14, 'Clara Bennett'), 'Good afternoon, Clara.');
  assert.equal(getTimeGreeting(20, 'Clara Bennett'), 'Good evening, Clara.');
});

test('calculateOrderBalance computes remaining balance, deposit status, and percentage', () => {
  const half = calculateOrderBalance(22, 11, 11);
  assert.equal(half.remainingBalance, 11);
  assert.equal(half.percentPaid, 50);
  assert.equal(half.depositPaid, true);
  assert.equal(half.isFullyPaid, false);

  const full = calculateOrderBalance(28, 28, 14);
  assert.equal(full.remainingBalance, 0);
  assert.equal(full.percentPaid, 100);
  assert.equal(full.isFullyPaid, true);
});

test('sanitizeUserFacingMessage blocks raw Gemini 503 JSON, Firebase/Firestore errors, and stack traces', () => {
  const fallback = 'SoloDesk couldn’t confidently understand this order. Please review the details manually.';

  assert.equal(
    sanitizeUserFacingMessage(
      '{"error":{"code":503,"message":"The model is overloaded. Please try again later.","status":"UNAVAILABLE"}}',
      fallback
    ),
    fallback
  );
  assert.equal(
    sanitizeUserFacingMessage(
      '{"error":"Missing or insufficient permissions.","operationType":"write","path":"orders/ord_1"}',
      fallback
    ),
    fallback
  );
  assert.equal(
    sanitizeUserFacingMessage('FirebaseError: Firebase: Error (auth/internal-error).', fallback),
    fallback
  );
  assert.equal(
    sanitizeUserFacingMessage('Error: Gemini API failed\n    at generateContent (server.ts:210:15)', fallback),
    fallback
  );

  // Friendly user-facing messages pass through intact
  assert.equal(
    sanitizeUserFacingMessage('Only £11 remains on this order.', fallback),
    'Only £11 remains on this order.'
  );
});

test('parseOrderLocally extracts Sarah couple portrait + pet example accurately', () => {
  const prompt =
    'Sarah ordered an A4 portrait for £20 plus a pet for £2. She paid £11 deposit and needs it by 14 November.';
  const draft = parseOrderLocally(prompt, '2026-10-25');

  assert.equal(isUsableOrderDraft(draft), true);
  assert.equal(draft.customerName, 'Sarah');
  assert.ok(draft.product.toLowerCase().includes('portrait'));
  assert.ok(draft.extras.toLowerCase().includes('pet'));
  assert.equal(draft.totalPrice, 22);
  assert.equal(draft.depositPaid, 11);
  assert.equal(draft.remainingBalance, 11);
  assert.equal(draft.dueDate, '2026-11-14');
  assert.equal(draft.customerNotes, prompt);
});

test('parseOrderLocally handles unit pricing, paid half, paid in full, still owes, weekdays, and delivery methods', () => {
  // 1. Unit pricing + collection + Friday deadline + £10 deposit
  const cupcakes = parseOrderLocally(
    'Chloe ordered 2 cupcakes boxes at £15 each for collection. £10 deposit paid, needs it Friday.',
    '2026-10-25' // Sunday -> Friday is 2026-10-30
  );
  assert.equal(cupcakes.customerName, 'Chloe');
  assert.equal(cupcakes.quantity, 2);
  assert.equal(cupcakes.totalPrice, 30);
  assert.equal(cupcakes.depositPaid, 10);
  assert.equal(cupcakes.remainingBalance, 20);
  assert.equal(cupcakes.deliveryMethod, 'Local Collection');
  assert.equal(cupcakes.dueDate, '2026-10-30');

  // 2. Paid half + due next week + Royal Mail
  const halfPaid = parseOrderLocally(
    'Liam ordered a custom wooden memory box for £48, paid half, due next week, post it via Royal Mail.',
    '2026-10-25'
  );
  assert.equal(halfPaid.customerName, 'Liam');
  assert.equal(halfPaid.totalPrice, 48);
  assert.equal(halfPaid.depositPaid, 24);
  assert.equal(halfPaid.remainingBalance, 24);
  assert.equal(halfPaid.dueDate, '2026-11-01');
  assert.equal(halfPaid.deliveryMethod, 'Royal Mail / Post');

  // 3. Paid in full
  const fullPaid = parseOrderLocally(
    'Hannah bought a bridal bouquet preservation frame for £95, paid in full.',
    '2026-10-25'
  );
  assert.equal(fullPaid.customerName, 'Hannah');
  assert.equal(fullPaid.totalPrice, 95);
  assert.equal(fullPaid.depositPaid, 95);
  assert.equal(fullPaid.remainingBalance, 0);
  assert.equal(fullPaid.dueDate, ''); // Do NOT invent a due date when none mentioned!
  assert.equal(fullPaid.dueDateDisplay, 'Not specified');

  // 4. Still owes £15
  const stillOwes = parseOrderLocally(
    'Megan ordered a personalised hoodie for £35 and still owes £15.',
    '2026-10-25'
  );
  assert.equal(stillOwes.customerName, 'Megan');
  assert.equal(stillOwes.totalPrice, 35);
  assert.equal(stillOwes.depositPaid, 20);
  assert.equal(stillOwes.remainingBalance, 15);
});

test('parseOrderLocally does NOT invent missing fields and marks unusable gibberish as not usable', () => {
  const gibberish = parseOrderLocally('hello there testing 123', '2026-10-25');
  assert.equal(isUsableOrderDraft(gibberish), false);

  const noDate = parseNaturalDueDate('Custom cake topper for £18', '2026-10-25');
  assert.equal(noDate.iso, '');
  assert.equal(noDate.display, 'Not specified');
});

test('validateParsedOrderDraft clamps negative or out-of-range AI numbers and preserves original message', () => {
  const checked = validateParsedOrderDraft(
    {
      customerName: 'Emma',
      product: 'Custom Cake Topper',
      totalPrice: 30,
      depositPaid: 45, // overpaid input should clamp to totalPrice
      dueDate: '2026-11-09',
    },
    '2026-10-25',
    'Emma wants a custom cake topper £30 by 9 Nov'
  );
  assert.ok(checked);
  assert.equal(checked.totalPrice, 30);
  assert.equal(checked.depositPaid, 30);
  assert.equal(checked.remainingBalance, 0);
  assert.ok(checked.customerNotes.includes('Emma wants a custom cake topper'));
});

test('archiving a paid order preserves its historical payments in Dashboard & Money calculations while excluding cancelled orders', () => {
  const today = '2026-10-25';
  const seed = createLunaDemoSeed('test_uid', today);

  const beforeDash = computeDashboardMetrics(seed.orders, seed.payments, today);
  const beforeMoney = computeMoneySummary(seed.orders, seed.payments, seed.expenses, 'this_month', today);
  const beforeDaily = computeDailyRevenueSeries(seed.payments, seed.orders, today, 30);
  const beforeMonthly = computeMonthlyFinanceSeries(seed.payments, seed.orders, seed.expenses, today, 6);

  // Archive SD-1047 (Jessica Brown £28 paid in full)
  const ordersWithArchived = seed.orders.map((o) =>
    o.orderNumber === 'SD-1047' ? { ...o, archived: true } : o
  );
  assert.equal(ordersWithArchived.some((o) => o.archived), true);

  const afterDash = computeDashboardMetrics(ordersWithArchived, seed.payments, today);
  const afterMoney = computeMoneySummary(ordersWithArchived, seed.payments, seed.expenses, 'this_month', today);
  const afterDaily = computeDailyRevenueSeries(seed.payments, ordersWithArchived, today, 30);
  const afterMonthly = computeMonthlyFinanceSeries(seed.payments, ordersWithArchived, seed.expenses, today, 6);

  assert.equal(afterDash.revenueThisMonth, beforeDash.revenueThisMonth);
  assert.equal(afterMoney.paymentsReceived, beforeMoney.paymentsReceived);
  assert.equal(afterMoney.revenue, beforeMoney.revenue);
  assert.equal(afterMoney.estimatedProfit, beforeMoney.estimatedProfit);
  assert.deepEqual(afterDaily, beforeDaily);
  assert.deepEqual(afterMonthly, beforeMonthly);

  // Cancelled orders ARE excluded from revenue
  const ordersWithCancelled = seed.orders.map((o) =>
    o.orderNumber === 'SD-1047' ? { ...o, status: 'Cancelled' as const } : o
  );
  const cancelledDash = computeDashboardMetrics(ordersWithCancelled, seed.payments, today);
  assert.equal(cancelledDash.revenueThisMonth, beforeDash.revenueThisMonth - 28);
});

test('deterministic AI assistant queries & Luna Creative Studio metrics remain exact', () => {
  const today = '2026-10-25';
  const seed = createLunaDemoSeed('test_uid', today);
  assert.equal(seed.orders.length, 8);

  assert.equal(isDeterministicAssistantQuery('Who owes me money?'), true);
  assert.equal(isDeterministicAssistantQuery('How much did I make this month?'), true);
  assert.equal(isDeterministicAssistantQuery('What expenses did I have?'), true);

  const dash = computeDashboardMetrics(seed.orders, seed.payments, today);
  assert.equal(dash.outstandingPayments, 124);
  assert.equal(dash.activeOrdersCount, 7);

  const focus = computeTodaysFocus(seed.orders, seed.tasks, 'GBP', today);
  assert.ok(focus.length >= 3);

  const generatedTasks = generateTasksForOrder(seed.orders[0], 'test_uid', 'test_uid', today);
  assert.ok(generatedTasks.length >= 3);

  const owesAns = answerAssistantLocally(
    'Who owes me money?',
    seed.orders,
    seed.payments,
    seed.expenses,
    seed.tasks,
    'GBP',
    today
  );
  assert.equal(owesAns.visualType, 'list');
  assert.equal(owesAns.footerValue, '£124');
  assert.equal(owesAns.items.length, 5);

  const expAns = answerAssistantLocally(
    'What expenses did I have?',
    seed.orders,
    seed.payments,
    seed.expenses,
    seed.tasks,
    'GBP',
    today
  );
  assert.equal(expAns.visualType, 'list');
  assert.ok(expAns.items.length >= 2);

  const hits = runGlobalSearch('Emma', seed.customers, seed.orders, seed.tasks, 'GBP');
  assert.ok(hits.length >= 3);
});
