import test from 'node:test';
import assert from 'node:assert/strict';
import {
  answerAssistantLocally,
  calculateOrderBalance,
  computeDashboardMetrics,
  computeMoneySummary,
  computeTodaysFocus,
  formatCurrency,
  generateTasksForOrder,
  getTimeGreeting,
  parseOrderLocally,
  runGlobalSearch,
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

test('parseOrderLocally extracts Sarah couple portrait + pet example accurately', () => {
  const prompt =
    'Sarah ordered an A4 couple portrait for £20 plus a pet for £2. She paid £11 deposit and needs it by 14 November.';
  const draft = parseOrderLocally(prompt, '2026-10-25');

  assert.equal(draft.customerName, 'Sarah');
  assert.ok(draft.product.toLowerCase().includes('couple portrait'));
  assert.equal(draft.totalPrice, 22);
  assert.equal(draft.depositPaid, 11);
  assert.equal(draft.remainingBalance, 11);
  assert.equal(draft.dueDate, '2026-11-14');
});

test('validateParsedOrderDraft clamps negative or out-of-range AI numbers safely', () => {
  const checked = validateParsedOrderDraft(
    {
      customerName: 'Emma',
      product: 'Custom Cake Topper',
      totalPrice: 30,
      depositPaid: 45, // overpaid input should clamp to totalPrice
      dueDate: '2026-11-09',
    },
    '2026-10-25'
  );
  assert.ok(checked);
  assert.equal(checked.totalPrice, 30);
  assert.equal(checked.depositPaid, 30);
  assert.equal(checked.remainingBalance, 0);
});

test('Luna Creative Studio seed generates 8 orders, Today Focus items, and accurate Money metrics', () => {
  const today = '2026-10-25';
  const seed = createLunaDemoSeed('test_uid', today);
  assert.equal(seed.orders.length, 8);
  assert.ok(seed.customers.length >= 6);

  const dash = computeDashboardMetrics(seed.orders, seed.payments, today);
  assert.ok(dash.revenueThisMonth > 0);
  assert.equal(dash.outstandingPayments, 124); // 11 + 20 + 20 + 19 + 54
  assert.equal(dash.activeOrdersCount, 7);

  const focus = computeTodaysFocus(seed.orders, seed.tasks, 'GBP', today);
  assert.ok(focus.length >= 3);
  assert.ok(
    !focus.some((f) => f.id.startsWith('focus_due_') && f.subtitle.includes('Dispatched')),
    'Dispatched orders should not trigger production due alerts'
  );

  const money = computeMoneySummary(seed.orders, seed.payments, seed.expenses, 'all', today);
  assert.ok(money.paymentsReceived > money.expensesTotal);
  assert.equal(money.estimatedProfit, Number((money.paymentsReceived - money.expensesTotal).toFixed(2)));

  // Auto-task generation for custom portrait order
  const generatedTasks = generateTasksForOrder(seed.orders[0], 'test_uid', 'test_uid', today);
  assert.ok(generatedTasks.length >= 3);

  // Assistant owes query
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

  // Global search
  const hits = runGlobalSearch('Emma', seed.customers, seed.orders, seed.tasks, 'GBP');
  assert.ok(hits.length >= 3);
});
