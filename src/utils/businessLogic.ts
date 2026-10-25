import {
  AppNotification,
  AssistantResponse,
  AssistantVisualItem,
  CURRENCIES,
  CurrencyCode,
  Customer,
  ExpenseRecord,
  FocusItem,
  MessagePresetType,
  Order,
  OrderStatus,
  ParsedOrderDraft,
  PaymentRecord,
  SmartInsight,
  TaskItem,
} from '../types';

export const ID_REGEX = /^[a-zA-Z0-9_\-]+$/;

export function sanitizeId(raw: string): string {
  const cleaned = raw.replace(/[^a-zA-Z0-9_\-]/g, '_').slice(0, 128);
  return cleaned.length > 0 ? cleaned : `id_${Date.now()}`;
}

export function createEntityId(prefix: string): string {
  const rand = Math.random().toString(36).slice(2, 9);
  return sanitizeId(`${prefix}_${Date.now()}_${rand}`);
}

export function clampString(value: string | undefined | null, maxLength: number): string {
  if (!value) return '';
  return String(value).trim().slice(0, maxLength);
}

export function roundMoney(amount: number): number {
  if (!Number.isFinite(amount)) return 0;
  return Math.round(amount * 100) / 100;
}

export function formatCurrency(
  amount: number,
  currency: CurrencyCode = 'GBP',
  options?: { forceDecimals?: boolean }
): string {
  const safe = roundMoney(amount);
  const cfg = CURRENCIES[currency] || CURRENCIES.GBP;
  const isWhole = Math.abs(safe - Math.round(safe)) < 0.005;
  const formattedNumber =
    isWhole && !options?.forceDecimals
      ? Math.round(Math.abs(safe)).toLocaleString('en-GB')
      : Math.abs(safe).toLocaleString('en-GB', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        });
  const sign = safe < 0 ? '-' : '';
  if (cfg.position === 'suffix') {
    return `${sign}${formattedNumber} ${cfg.symbol}`;
  }
  return `${sign}${cfg.symbol}${formattedNumber}`;
}

export function getFirstName(fullName: string): string {
  const trimmed = (fullName || '').trim();
  if (!trimmed) return 'there';
  return trimmed.split(/\s+/)[0];
}

export function getTimeGreeting(hour: number, fullName: string): string {
  const first = getFirstName(fullName);
  if (hour < 12) return `Good morning, ${first}.`;
  if (hour < 18) return `Good afternoon, ${first}.`;
  return `Good evening, ${first}.`;
}

export function getTodayIso(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function addDaysIso(baseIso: string, deltaDays: number): string {
  const [y, m, d] = baseIso.split('-').map(Number);
  const dt = new Date(Date.UTC(y || 2026, (m || 1) - 1, d || 1));
  dt.setUTCDate(dt.getUTCDate() + deltaDays);
  return dt.toISOString().slice(0, 10);
}

export function diffDays(fromIso: string, toIso: string): number {
  if (!fromIso || !toIso) return 999;
  const [y1, m1, d1] = fromIso.split('-').map(Number);
  const [y2, m2, d2] = toIso.split('-').map(Number);
  const t1 = Date.UTC(y1, (m1 || 1) - 1, d1 || 1);
  const t2 = Date.UTC(y2, (m2 || 1) - 1, d2 || 1);
  return Math.round((t2 - t1) / 86400000);
}

export function formatShortDate(isoDate: string): string {
  if (!isoDate) return 'No date set';
  const parts = isoDate.split('-').map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) return isoDate;
  const dt = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
  return dt.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  });
}

export function formatLongDate(isoDate: string): string {
  if (!isoDate) return 'No due date';
  const parts = isoDate.split('-').map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) return isoDate;
  const dt = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
  return dt.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  });
}

export function formatRelativeDue(dueDate: string, todayIso: string): string {
  if (!dueDate) return 'No due date';
  const days = diffDays(todayIso, dueDate);
  if (days < -1) return `${Math.abs(days)} days overdue`;
  if (days === -1) return 'Due yesterday';
  if (days === 0) return 'Due today';
  if (days === 1) return 'Due tomorrow';
  if (days <= 7) return `Due in ${days} days`;
  return `Due ${formatShortDate(dueDate)}`;
}

export function calculateOrderBalance(
  totalPrice: number,
  amountPaid: number,
  depositRequired: number = 0
): {
  totalPrice: number;
  amountPaid: number;
  remainingBalance: number;
  percentPaid: number;
  depositRequired: number;
  depositPaid: boolean;
  isFullyPaid: boolean;
} {
  const safeTotal = Math.max(0, roundMoney(totalPrice));
  const safePaid = Math.max(0, Math.min(safeTotal, roundMoney(amountPaid)));
  const remaining = Math.max(0, roundMoney(safeTotal - safePaid));
  const safeDeposit = Math.max(0, Math.min(safeTotal, roundMoney(depositRequired)));
  const percentPaid = safeTotal === 0 ? 100 : Math.min(100, Math.round((safePaid / safeTotal) * 100));
  return {
    totalPrice: safeTotal,
    amountPaid: safePaid,
    remainingBalance: remaining,
    percentPaid,
    depositRequired: safeDeposit,
    depositPaid: safeDeposit > 0 ? safePaid >= safeDeposit : safePaid > 0,
    isFullyPaid: remaining <= 0.005,
  };
}

export function isActiveOrderStatus(status: OrderStatus): boolean {
  return (
    status !== 'Completed' &&
    status !== 'Cancelled'
  );
}

export function generateTasksForOrder(
  order: Order,
  ownerId: string,
  businessId: string,
  todayIso: string
): TaskItem[] {
  const tasks: TaskItem[] = [];
  const firstName = getFirstName(order.customerName);
  const due = order.dueDate || addDaysIso(todayIso, 7);
  const prepDue = diffDays(todayIso, due) > 2 ? addDaysIso(due, -2) : todayIso;
  const previewDue = diffDays(todayIso, due) > 1 ? addDaysIso(due, -1) : todayIso;

  tasks.push({
    id: createEntityId('tsk'),
    ownerId,
    businessId,
    title: clampString(`Create ${order.product} for ${firstName}`, 240),
    customerId: order.customerId,
    customerName: order.customerName,
    orderId: order.id,
    orderNumber: order.orderNumber,
    dueDate: prepDue,
    priority: diffDays(todayIso, due) <= 3 ? 'High' : 'Medium',
    completed: false,
    autoGenerated: true,
  });

  const lowerProd = `${order.product} ${order.description}`.toLowerCase();
  if (
    lowerProd.includes('portrait') ||
    lowerProd.includes('custom') ||
    lowerProd.includes('personalised') ||
    lowerProd.includes('topper') ||
    lowerProd.includes('design') ||
    lowerProd.includes('print')
  ) {
    tasks.push({
      id: createEntityId('tsk'),
      ownerId,
      businessId,
      title: clampString(`Send preview to ${firstName} for approval`, 240),
      customerId: order.customerId,
      customerName: order.customerName,
      orderId: order.id,
      orderNumber: order.orderNumber,
      dueDate: previewDue,
      priority: 'Medium',
      completed: false,
      autoGenerated: true,
    });
  }

  if (!order.deliveryMethod.toLowerCase().includes('digital')) {
    tasks.push({
      id: createEntityId('tsk'),
      ownerId,
      businessId,
      title: clampString(
        order.deliveryMethod.toLowerCase().includes('collection')
          ? `Package ${firstName}'s order for collection`
          : `Package & post ${firstName}'s order`,
        240
      ),
      customerId: order.customerId,
      customerName: order.customerName,
      orderId: order.id,
      orderNumber: order.orderNumber,
      dueDate: due,
      priority: diffDays(todayIso, due) <= 2 ? 'High' : 'Medium',
      completed: false,
      autoGenerated: true,
    });
  }

  if (order.remainingBalance > 0) {
    tasks.push({
      id: createEntityId('tsk'),
      ownerId,
      businessId,
      title: clampString(`Payment due from ${firstName} (${order.orderNumber})`, 240),
      customerId: order.customerId,
      customerName: order.customerName,
      orderId: order.id,
      orderNumber: order.orderNumber,
      dueDate: due,
      priority: 'Medium',
      completed: false,
      autoGenerated: true,
    });
  }

  return tasks;
}

export interface DashboardMetrics {
  revenueThisMonth: number;
  outstandingPayments: number;
  activeOrdersCount: number;
  ordersDueSoonCount: number;
  lastMonthRevenue: number;
  momChangePercent: number | null;
}

export function computeDashboardMetrics(
  orders: Order[],
  payments: PaymentRecord[],
  todayIso: string
): DashboardMetrics {
  const currentYm = todayIso.slice(0, 7);
  const [y, m] = currentYm.split('-').map(Number);
  const prevDate = new Date(Date.UTC(y, m - 2, 1));
  const prevYm = prevDate.toISOString().slice(0, 7);

  const nonCancelledOrders = orders.filter((o) => o.status !== 'Cancelled' && !o.archived);

  // Revenue this month: sum of payments received this month (or order amountPaid if no payment records)
  let revenueThisMonth = 0;
  let lastMonthRevenue = 0;

  if (payments.length > 0) {
    for (const p of payments) {
      if (p.date.startsWith(currentYm)) revenueThisMonth += p.amount;
      else if (p.date.startsWith(prevYm)) lastMonthRevenue += p.amount;
    }
  } else {
    for (const o of nonCancelledOrders) {
      if (o.orderDate.startsWith(currentYm)) revenueThisMonth += o.amountPaid;
      else if (o.orderDate.startsWith(prevYm)) lastMonthRevenue += o.amountPaid;
    }
  }

  let outstandingPayments = 0;
  let activeOrdersCount = 0;
  let ordersDueSoonCount = 0;

  for (const o of nonCancelledOrders) {
    if (o.remainingBalance > 0) {
      outstandingPayments += o.remainingBalance;
    }
    if (isActiveOrderStatus(o.status)) {
      activeOrdersCount += 1;
      if (o.dueDate && o.status !== 'Dispatched') {
        const d = diffDays(todayIso, o.dueDate);
        if (d <= 5) {
          ordersDueSoonCount += 1;
        }
      }
    }
  }

  const momChangePercent =
    lastMonthRevenue > 0
      ? Math.round(((revenueThisMonth - lastMonthRevenue) / lastMonthRevenue) * 100)
      : null;

  return {
    revenueThisMonth: roundMoney(revenueThisMonth),
    outstandingPayments: roundMoney(outstandingPayments),
    activeOrdersCount,
    ordersDueSoonCount,
    lastMonthRevenue: roundMoney(lastMonthRevenue),
    momChangePercent,
  };
}

export function computeTodaysFocus(
  orders: Order[],
  tasks: TaskItem[],
  currency: CurrencyCode,
  todayIso: string
): FocusItem[] {
  const items: FocusItem[] = [];
  const activeOrders = orders.filter((o) => !o.archived && isActiveOrderStatus(o.status));

  // 1. Overdue or due today/tomorrow orders (excluding already-dispatched parcels)
  const urgentDue = [...activeOrders]
    .filter((o) => o.status !== 'Dispatched' && o.dueDate && diffDays(todayIso, o.dueDate) <= 2)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));

  for (const o of urgentDue.slice(0, 2)) {
    const d = diffDays(todayIso, o.dueDate);
    const first = getFirstName(o.customerName);
    if (o.status === 'Ready') {
      items.push({
        id: `focus_ship_${o.id}`,
        title:
          d <= 0
            ? `${first}’s order needs to be posted today.`
            : `${first}’s ${o.product.toLowerCase()} is ready for dispatch.`,
        subtitle: `${o.orderNumber} · ${o.product} · ${o.deliveryMethod}`,
        urgency: d <= 0 ? 'high' : 'medium',
        actionLabel: 'Mark dispatched',
        actionType: 'mark_dispatched',
        targetId: o.id,
      });
    } else {
      const duePhrase =
        d < 0
          ? `was due ${Math.abs(d)} day${Math.abs(d) === 1 ? '' : 's'} ago`
          : d === 0
            ? 'is due today'
            : d === 1
              ? 'is due tomorrow'
              : `is due in ${d} days`;
      items.push({
        id: `focus_due_${o.id}`,
        title: `${first}’s ${o.product.toLowerCase()} ${duePhrase}.`,
        subtitle: `${o.orderNumber} · ${o.status}`,
        urgency: d <= 0 ? 'high' : 'medium',
        actionLabel: 'View order',
        actionType: 'open_order',
        targetId: o.id,
      });
    }
  }

  // 2. Customers waiting for previews / approval
  const waitingOrders = activeOrders.filter((o) => o.status === 'Waiting for Customer');
  if (waitingOrders.length > 0) {
    items.push({
      id: 'focus_waiting_customers',
      title:
        waitingOrders.length === 1
          ? `${waitingOrders[0].customerName} is waiting on preview follow-up.`
          : `${waitingOrders.length} customers are waiting for previews or approval.`,
      subtitle: waitingOrders.map((w) => getFirstName(w.customerName)).slice(0, 3).join(', '),
      urgency: 'medium',
      actionLabel: waitingOrders.length === 1 ? 'Open order' : 'Review waiting',
      actionType: waitingOrders.length === 1 ? 'open_order' : 'filter_waiting',
      targetId: waitingOrders.length === 1 ? waitingOrders[0].id : undefined,
    });
  }

  // 3. Outstanding balances on Ready / Dispatched / near-due orders
  const unpaidOrders = [...orders]
    .filter((o) => !o.archived && o.status !== 'Cancelled' && o.remainingBalance > 0)
    .sort((a, b) => {
      const scoreA = a.status === 'Ready' || a.status === 'Dispatched' ? 0 : 1;
      const scoreB = b.status === 'Ready' || b.status === 'Dispatched' ? 0 : 1;
      if (scoreA !== scoreB) return scoreA - scoreB;
      return b.remainingBalance - a.remainingBalance;
    });

  for (const u of unpaidOrders.slice(0, 2)) {
    if (items.length >= 5) break;
    items.push({
      id: `focus_pay_${u.id}`,
      title: `${getFirstName(u.customerName)} still owes ${formatCurrency(u.remainingBalance, currency)}.`,
      subtitle: `${u.product} · ${formatCurrency(u.amountPaid, currency)} of ${formatCurrency(u.totalPrice, currency)} paid`,
      urgency: u.status === 'Ready' || u.status === 'Dispatched' ? 'high' : 'normal',
      actionLabel: 'Record payment',
      actionType: 'record_payment',
      targetId: u.id,
    });
  }

  // 4. Tasks due today or overdue if space remains
  if (items.length < 4) {
    const dueTasks = tasks
      .filter((t) => !t.completed && t.dueDate && diffDays(todayIso, t.dueDate) <= 0)
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
    for (const t of dueTasks.slice(0, 4 - items.length)) {
      items.push({
        id: `focus_task_${t.id}`,
        title: t.title,
        subtitle: t.customerName ? `${t.customerName} · ${formatRelativeDue(t.dueDate, todayIso)}` : formatRelativeDue(t.dueDate, todayIso),
        urgency: diffDays(todayIso, t.dueDate) < 0 ? 'high' : 'normal',
        actionLabel: 'Mark done',
        actionType: 'complete_task',
        targetId: t.id,
      });
    }
  }

  return items.slice(0, 5);
}

export function computeSmartInsights(
  orders: Order[],
  payments: PaymentRecord[],
  currency: CurrencyCode,
  todayIso: string
): SmartInsight[] {
  const insights: SmartInsight[] = [];
  const validOrders = orders.filter((o) => o.status !== 'Cancelled' && !o.archived);
  if (validOrders.length === 0) return insights;

  const metrics = computeDashboardMetrics(orders, payments, todayIso);

  if (metrics.momChangePercent !== null && metrics.momChangePercent !== 0) {
    const dir = metrics.momChangePercent > 0 ? 'more' : 'less';
    insights.push({
      id: 'insight_mom',
      title: `You made ${Math.abs(metrics.momChangePercent)}% ${dir} this month than last month.`,
      detail: `${formatCurrency(metrics.revenueThisMonth, currency)} received so far vs ${formatCurrency(metrics.lastMonthRevenue, currency)} last month.`,
      category: 'revenue',
    });
  }

  // Highest earning product
  const byProduct = new Map<string, number>();
  for (const o of validOrders) {
    const key = o.product.trim();
    byProduct.set(key, (byProduct.get(key) || 0) + o.totalPrice);
  }
  const sortedProducts = [...byProduct.entries()].sort((a, b) => b[1] - a[1]);
  if (sortedProducts.length > 0) {
    const [topName, topRev] = sortedProducts[0];
    insights.push({
      id: 'insight_top_product',
      title: `${topName} is currently your highest-earning item.`,
      detail: `Generated ${formatCurrency(topRev, currency)} across your order book.`,
      category: 'product',
    });
  }

  if (metrics.outstandingPayments > 0) {
    const unpaidCount = validOrders.filter((o) => o.remainingBalance > 0).length;
    insights.push({
      id: 'insight_outstanding',
      title: `You have ${formatCurrency(metrics.outstandingPayments, currency)} in outstanding payments.`,
      detail: `Spread across ${unpaidCount} order${unpaidCount === 1 ? '' : 's'} awaiting final balance.`,
      category: 'payments',
    });
  }

  // Busiest day of week
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const dayCounts = [0, 0, 0, 0, 0, 0, 0];
  for (const o of validOrders) {
    const parts = o.orderDate.split('-').map(Number);
    if (parts.length === 3 && !parts.some(isNaN)) {
      const dow = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2])).getUTCDay();
      dayCounts[dow] += 1;
    }
  }
  const maxCount = Math.max(...dayCounts);
  if (maxCount >= 2) {
    const busiestDay = dayNames[dayCounts.indexOf(maxCount)];
    insights.push({
      id: 'insight_busiest_day',
      title: `${busiestDay} is your busiest order day.`,
      detail: `${maxCount} of your recent orders were placed on a ${busiestDay}.`,
      category: 'schedule',
    });
  }

  return insights.slice(0, 3);
}

export interface DailyPoint {
  date: string;
  label: string;
  amount: number;
}

export function computeDailyRevenueSeries(
  payments: PaymentRecord[],
  orders: Order[],
  todayIso: string,
  days: number = 30
): DailyPoint[] {
  const map = new Map<string, number>();
  for (let i = days - 1; i >= 0; i--) {
    const iso = addDaysIso(todayIso, -i);
    map.set(iso, 0);
  }

  if (payments.length > 0) {
    for (const p of payments) {
      if (map.has(p.date)) {
        map.set(p.date, roundMoney((map.get(p.date) || 0) + p.amount));
      }
    }
  } else {
    for (const o of orders) {
      if (o.status !== 'Cancelled' && map.has(o.orderDate)) {
        map.set(o.orderDate, roundMoney((map.get(o.orderDate) || 0) + o.amountPaid));
      }
    }
  }

  return [...map.entries()].map(([date, amount]) => ({
    date,
    label: formatShortDate(date),
    amount,
  }));
}

export type FinanceRange = 'this_month' | 'last_30' | 'last_90' | 'all';

export interface MoneySummary {
  revenue: number;
  paymentsReceived: number;
  outstandingPayments: number;
  expensesTotal: number;
  estimatedProfit: number;
}

export function isDateInFinanceRange(dateIso: string, range: FinanceRange, todayIso: string): boolean {
  if (!dateIso) return false;
  if (range === 'all') return true;
  if (range === 'this_month') return dateIso.slice(0, 7) === todayIso.slice(0, 7);
  const days = range === 'last_30' ? 30 : 90;
  const startIso = addDaysIso(todayIso, -(days - 1));
  return dateIso >= startIso && dateIso <= addDaysIso(todayIso, 365);
}

export function computeMoneySummary(
  orders: Order[],
  payments: PaymentRecord[],
  expenses: ExpenseRecord[],
  range: FinanceRange,
  todayIso: string
): MoneySummary {
  const validOrders = orders.filter((o) => o.status !== 'Cancelled' && !o.archived);
  const filteredOrders = validOrders.filter((o) => isDateInFinanceRange(o.orderDate, range, todayIso));

  const revenue = roundMoney(filteredOrders.reduce((sum, o) => sum + o.totalPrice, 0));

  let paymentsReceived = 0;
  if (payments.length > 0) {
    paymentsReceived = roundMoney(
      payments
        .filter((p) => isDateInFinanceRange(p.date, range, todayIso))
        .reduce((sum, p) => sum + p.amount, 0)
    );
  } else {
    paymentsReceived = roundMoney(filteredOrders.reduce((sum, o) => sum + o.amountPaid, 0));
  }

  const outstandingPayments = roundMoney(
    validOrders.reduce((sum, o) => sum + o.remainingBalance, 0)
  );

  const expensesTotal = roundMoney(
    expenses
      .filter((e) => isDateInFinanceRange(e.date, range, todayIso))
      .reduce((sum, e) => sum + e.amount, 0)
  );

  const estimatedProfit = roundMoney(paymentsReceived - expensesTotal);

  return {
    revenue,
    paymentsReceived,
    outstandingPayments,
    expensesTotal,
    estimatedProfit,
  };
}

export interface MonthlyBarPoint {
  monthKey: string;
  label: string;
  revenue: number;
  expenses: number;
}

export function computeMonthlyFinanceSeries(
  payments: PaymentRecord[],
  orders: Order[],
  expenses: ExpenseRecord[],
  todayIso: string,
  monthsCount: number = 6
): MonthlyBarPoint[] {
  const [y, m] = todayIso.slice(0, 7).split('-').map(Number);
  const points: MonthlyBarPoint[] = [];

  for (let i = monthsCount - 1; i >= 0; i--) {
    const dt = new Date(Date.UTC(y, m - 1 - i, 1));
    const key = dt.toISOString().slice(0, 7);
    const label = dt.toLocaleDateString('en-GB', { month: 'short', timeZone: 'UTC' });

    const rev =
      payments.length > 0
        ? payments.filter((p) => p.date.startsWith(key)).reduce((s, p) => s + p.amount, 0)
        : orders
            .filter((o) => o.status !== 'Cancelled' && o.orderDate.startsWith(key))
            .reduce((s, o) => s + o.amountPaid, 0);

    const exp = expenses
      .filter((e) => e.date.startsWith(key))
      .reduce((s, e) => s + e.amount, 0);

    points.push({
      monthKey: key,
      label,
      revenue: roundMoney(rev),
      expenses: roundMoney(exp),
    });
  }

  return points;
}

export function computeCustomerStats(customerId: string, orders: Order[]) {
  const custOrders = orders.filter((o) => o.customerId === customerId && o.status !== 'Cancelled');
  const totalSpent = roundMoney(custOrders.reduce((s, o) => s + o.totalPrice, 0));
  const outstandingBalance = roundMoney(custOrders.reduce((s, o) => s + o.remainingBalance, 0));
  return {
    orderCount: custOrders.length,
    totalSpent,
    outstandingBalance,
    orders: orders
      .filter((o) => o.customerId === customerId)
      .sort((a, b) => b.orderDate.localeCompare(a.orderDate)),
  };
}

export interface SearchHit {
  id: string;
  kind: 'order' | 'customer' | 'task';
  title: string;
  subtitle: string;
  meta: string;
}

export function runGlobalSearch(
  query: string,
  customers: Customer[],
  orders: Order[],
  tasks: TaskItem[],
  currency: CurrencyCode
): SearchHit[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const hits: SearchHit[] = [];

  for (const o of orders) {
    const hay = `${o.orderNumber} ${o.customerName} ${o.product} ${o.description} ${o.customerNotes} ${o.internalNotes} ${o.status}`.toLowerCase();
    if (hay.includes(q)) {
      hits.push({
        id: o.id,
        kind: 'order',
        title: `${o.orderNumber} · ${o.product}`,
        subtitle: `${o.customerName} · ${o.status}`,
        meta: formatCurrency(o.totalPrice, currency),
      });
    }
  }

  for (const c of customers) {
    const hay = `${c.name} ${c.email} ${c.phone} ${c.instagram} ${c.facebook} ${c.notes}`.toLowerCase();
    if (hay.includes(q)) {
      hits.push({
        id: c.id,
        kind: 'customer',
        title: c.name,
        subtitle: [c.instagram, c.email, c.phone].filter(Boolean).join(' · ') || 'Customer profile',
        meta: 'Customer',
      });
    }
  }

  for (const t of tasks) {
    const hay = `${t.title} ${t.customerName} ${t.orderNumber}`.toLowerCase();
    if (hay.includes(q)) {
      hits.push({
        id: t.id,
        kind: 'task',
        title: t.title,
        subtitle: t.customerName ? `${t.customerName} · Due ${formatShortDate(t.dueDate)}` : `Due ${formatShortDate(t.dueDate)}`,
        meta: t.completed ? 'Completed' : t.priority,
      });
    }
  }

  return hits.slice(0, 15);
}

// Natural-language date & order fallback parser + strict Gemini schema validator
const MONTH_MAP: Record<string, number> = {
  jan: 1, january: 1,
  feb: 2, february: 2,
  mar: 3, march: 3,
  apr: 4, april: 4,
  may: 5,
  jun: 6, june: 6,
  jul: 7, july: 7,
  aug: 8, august: 8,
  sep: 9, sept: 9, september: 9,
  oct: 10, october: 10,
  nov: 11, november: 11,
  dec: 12, december: 12,
};

export function parseNaturalDueDate(text: string, todayIso: string): { iso: string; display: string } {
  const lower = text.toLowerCase();
  if (lower.includes('tomorrow')) {
    const iso = addDaysIso(todayIso, 1);
    return { iso, display: formatLongDate(iso) };
  }
  if (lower.includes('next week')) {
    const iso = addDaysIso(todayIso, 7);
    return { iso, display: formatLongDate(iso) };
  }

  // Match "14 November" or "November 14" or "14th Nov"
  const dmy = text.match(/\b(\d{1,2})(?:st|nd|rd|th)?\s+(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t|tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\b/i);
  const mdy = text.match(/\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t|tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+(\d{1,2})(?:st|nd|rd|th)?\b/i);

  const [curY, curM, curD] = todayIso.split('-').map(Number);

  if (dmy || mdy) {
    const day = dmy ? Number(dmy[1]) : Number(mdy![2]);
    const monthStr = (dmy ? dmy[2] : mdy![1]).toLowerCase();
    const month = MONTH_MAP[monthStr] || curM;
    let year = curY;
    if (month < curM || (month === curM && day < curD - 2)) {
      year += 1;
    }
    const iso = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return { iso, display: formatLongDate(iso) };
  }

  const defaultIso = addDaysIso(todayIso, 7);
  return { iso: defaultIso, display: formatLongDate(defaultIso) };
}

export function parseOrderLocally(prompt: string, todayIso: string): ParsedOrderDraft {
  const clean = prompt.trim();
  // Customer name heuristic: first capitalized name before "ordered", "wants", "booked", "asked"
  const custMatch = clean.match(/^([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s+(?:ordered|wants|booked|asked|bought|commissioned)/i);
  const customerName = custMatch ? custMatch[1].trim() : 'Walk-in Customer';

  // Product heuristic
  const prodMatch = clean.match(/(?:ordered|wants|booked|commissioned)\s+(?:an?\s+|the\s+)?([^.,£€$]+?)(?:\s+for\s+[£€$\d]|\s+at\s+[£€$\d]|[,.;]|$)/i);
  const rawProduct = prodMatch ? prodMatch[1].trim() : 'Custom Order';
  const product = rawProduct
    .split(/\s+/)
    .map((w) => (w.length > 2 ? w[0].toUpperCase() + w.slice(1) : w.toUpperCase() === w ? w : w))
    .join(' ');

  // Extras heuristic: "plus a pet for £2"
  const extraMatch = clean.match(/\b(?:plus|with|and\s+extra)\s+(?:an?\s+)?([^.,£€$]+?)(?:\s+for\s+[£€$]?\d+(?:\.\d+)?|\s*[,.]|$)/i);
  const extras = extraMatch ? extraMatch[1].trim() : '';

  // Prices heuristic: distinguish deposit/paid amounts vs item prices
  const paidMatch = clean.match(/(?:paid|sent|gave)\s*(?:a\s*)?[£€$]?(\d+(?:\.\d{1,2})?)\s*(?:lei)?(?:\s*deposit)?/i) ||
    clean.match(/deposit\s*(?:of\s*)?[£€$]?(\d+(?:\.\d{1,2})?)/i);
  const depositPaid = paidMatch ? roundMoney(Number(paidMatch[1])) : 0;

  // Item amounts before "paid" / "deposit"
  const beforePaidClause = clean.split(/\b(?:she|he|they)?\s*(?:paid|deposit)\b/i)[0] || clean;
  const priceMatches = [...beforePaidClause.matchAll(/(?:[£€$]\s*(\d+(?:\.\d{1,2})?)|(\d+(?:\.\d{1,2})?)\s*(?:lei|gbp|eur|usd)|\bfor\s+(\d+(?:\.\d{1,2})?))/gi)];
  let totalPrice = 0;
  for (const m of priceMatches) {
    const val = Number(m[1] || m[2] || m[3] || 0);
    if (Number.isFinite(val)) totalPrice += val;
  }
  if (totalPrice === 0 && depositPaid > 0) {
    totalPrice = depositPaid * 2;
  }
  const fullPaidWord = /\bpaid\s+in\s+full\b/i.test(clean);
  const actualPaid = fullPaidWord ? totalPrice : Math.min(totalPrice, depositPaid);
  const remainingBalance = Math.max(0, roundMoney(totalPrice - actualPaid));

  const due = parseNaturalDueDate(clean, todayIso);
  const deliveryMethod = /\bcollect/i.test(clean)
    ? 'Local Collection'
    : /\bdigital|email\b/i.test(clean)
      ? 'Digital Download'
      : 'Royal Mail / Post';

  return {
    customerName: clampString(customerName, 140),
    product: clampString(product, 200),
    extras: clampString(extras, 120),
    description: clampString(extras ? `${product} (+ ${extras})` : product, 500),
    quantity: 1,
    totalPrice: roundMoney(totalPrice),
    depositPaid: roundMoney(actualPaid),
    remainingBalance,
    dueDate: due.iso,
    dueDateDisplay: due.display,
    deliveryMethod,
    customerNotes: clampString(clean, 500),
    suggestedTasks: [
      `Create ${product}`,
      `Send preview to ${getFirstName(customerName)}`,
      deliveryMethod === 'Local Collection' ? 'Prepare for collection' : 'Package & post order',
    ],
  };
}

export function validateParsedOrderDraft(raw: unknown, todayIso: string): ParsedOrderDraft | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;
  const customerName = clampString(typeof obj.customerName === 'string' ? obj.customerName : '', 140);
  const product = clampString(typeof obj.product === 'string' ? obj.product : '', 200);
  if (!customerName && !product) return null;

  const totalPrice = Math.max(0, Math.min(1000000, roundMoney(Number(obj.totalPrice) || 0)));
  const depositPaid = Math.max(0, Math.min(totalPrice || 1000000, roundMoney(Number(obj.depositPaid) || 0)));
  const computedRemaining = Math.max(0, roundMoney(totalPrice - depositPaid));

  const rawDue = typeof obj.dueDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(obj.dueDate)
    ? obj.dueDate
    : addDaysIso(todayIso, 7);

  return {
    customerName: customerName || 'New Customer',
    product: product || 'Custom Order',
    extras: clampString(typeof obj.extras === 'string' ? obj.extras : '', 140),
    description: clampString(typeof obj.description === 'string' ? obj.description : '', 1000),
    quantity: Math.max(1, Math.min(10000, Math.round(Number(obj.quantity) || 1))),
    totalPrice,
    depositPaid,
    remainingBalance: computedRemaining,
    dueDate: rawDue,
    dueDateDisplay: clampString(
      typeof obj.dueDateDisplay === 'string' && obj.dueDateDisplay
        ? obj.dueDateDisplay
        : formatLongDate(rawDue),
      60
    ),
    deliveryMethod: clampString(
      typeof obj.deliveryMethod === 'string' && obj.deliveryMethod
        ? obj.deliveryMethod
        : 'Royal Mail / Post',
      60
    ),
    customerNotes: clampString(typeof obj.customerNotes === 'string' ? obj.customerNotes : '', 1000),
    suggestedTasks: Array.isArray(obj.suggestedTasks)
      ? obj.suggestedTasks
          .filter((t): t is string => typeof t === 'string' && t.trim().length > 0)
          .slice(0, 6)
          .map((t) => clampString(t, 200))
      : [],
  };
}

export function answerAssistantLocally(
  question: string,
  orders: Order[],
  payments: PaymentRecord[],
  expenses: ExpenseRecord[],
  tasks: TaskItem[],
  currency: CurrencyCode,
  todayIso: string
): AssistantResponse {
  const q = question.toLowerCase();
  const validOrders = orders.filter((o) => o.status !== 'Cancelled' && !o.archived);

  if (q.includes('owe') || q.includes('unpaid') || q.includes('outstanding') || q.includes('balance')) {
    const owing = validOrders
      .filter((o) => o.remainingBalance > 0)
      .sort((a, b) => b.remainingBalance - a.remainingBalance);
    const total = roundMoney(owing.reduce((s, o) => s + o.remainingBalance, 0));
    const items: AssistantVisualItem[] = owing.map((o) => ({
      label: o.customerName,
      sublabel: `${o.product} (${o.orderNumber}) · Due ${formatShortDate(o.dueDate)}`,
      value: formatCurrency(o.remainingBalance, currency),
      status: o.status,
      relatedOrderId: o.id,
      relatedCustomerId: o.customerId,
    }));
    return {
      headline:
        owing.length === 0
          ? 'Everyone is paid up right now.'
          : `${owing.length} customer${owing.length === 1 ? ' owes' : 's owe'} you a combined ${formatCurrency(total, currency)}.`,
      summary:
        owing.length === 0
          ? 'There are zero outstanding balances across your active orders.'
          : 'Here are the orders with remaining balances to collect before or upon completion.',
      visualType: 'list',
      items,
      footerLabel: 'Total outstanding',
      footerValue: formatCurrency(total, currency),
      followUpSuggestions: ['What orders are due this week?', 'How much did I make this month?'],
      source: 'local',
    };
  }

  if (q.includes('overdue') || q.includes('late')) {
    const overdue = validOrders
      .filter((o) => isActiveOrderStatus(o.status) && o.dueDate && diffDays(todayIso, o.dueDate) < 0)
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
    return {
      headline:
        overdue.length === 0
          ? 'Great news — you have no overdue orders.'
          : `You have ${overdue.length} overdue order${overdue.length === 1 ? '' : 's'} needing attention.`,
      summary:
        overdue.length === 0
          ? 'All active orders are currently on or ahead of schedule.'
          : 'Prioritise these orders first or send a quick update message to the customer.',
      visualType: 'list',
      items: overdue.map((o) => ({
        label: `${o.customerName} — ${o.product}`,
        sublabel: `${formatRelativeDue(o.dueDate, todayIso)} · ${o.status}`,
        value: formatCurrency(o.totalPrice, currency),
        relatedOrderId: o.id,
      })),
      followUpSuggestions: ['What should I work on today?', 'Who owes me money?'],
      source: 'local',
    };
  }

  if (q.includes('due this week') || q.includes('upcoming') || q.includes('deadline')) {
    const dueWeek = validOrders
      .filter((o) => {
        if (!isActiveOrderStatus(o.status) || !o.dueDate) return false;
        const d = diffDays(todayIso, o.dueDate);
        return d >= 0 && d <= 7;
      })
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate));

    return {
      headline:
        dueWeek.length === 0
          ? 'No orders are due in the next 7 days.'
          : `${dueWeek.length} order${dueWeek.length === 1 ? ' is' : 's are'} due over the next 7 days.`,
      summary: 'Sorted by earliest deadline so you can plan your studio time calmly.',
      visualType: 'list',
      items: dueWeek.map((o) => ({
        label: `${o.customerName} — ${o.product}`,
        sublabel: `${formatRelativeDue(o.dueDate, todayIso)} (${formatShortDate(o.dueDate)})`,
        value: o.status,
        relatedOrderId: o.id,
      })),
      followUpSuggestions: ['What should I work on today?', 'Which customers are waiting for something?'],
      source: 'local',
    };
  }

  if (q.includes('waiting') || q.includes('approval') || q.includes('preview')) {
    const waiting = validOrders.filter((o) => o.status === 'Waiting for Customer');
    return {
      headline:
        waiting.length === 0
          ? 'No customers are currently marked as Waiting for Customer.'
          : `${waiting.length} customer${waiting.length === 1 ? ' is' : 's are'} waiting on previews, details, or approval.`,
      summary: 'Open any order below to generate a friendly follow-up message in one click.',
      visualType: 'list',
      items: waiting.map((o) => ({
        label: o.customerName,
        sublabel: `${o.product} · Due ${formatShortDate(o.dueDate)}`,
        value: formatCurrency(o.totalPrice, currency),
        relatedOrderId: o.id,
        relatedCustomerId: o.customerId,
      })),
      followUpSuggestions: ['Who owes me money?', 'What orders are due this week?'],
      source: 'local',
    };
  }

  if (q.includes('most money') || q.includes('best') || q.includes('highest') || q.includes('product')) {
    const byProd = new Map<string, { revenue: number; count: number }>();
    for (const o of validOrders) {
      const prev = byProd.get(o.product) || { revenue: 0, count: 0 };
      byProd.set(o.product, { revenue: roundMoney(prev.revenue + o.totalPrice), count: prev.count + 1 });
    }
    const ranked = [...byProd.entries()].sort((a, b) => b[1].revenue - a[1].revenue).slice(0, 5);
    return {
      headline:
        ranked.length > 0
          ? `${ranked[0][0]} is your highest-earning product at ${formatCurrency(ranked[0][1].revenue, currency)}.`
          : 'Add your first orders to see product earnings.',
      summary: 'Breakdown of your top products and services by total order value.',
      visualType: 'list',
      items: ranked.map(([name, stat]) => ({
        label: name,
        sublabel: `${stat.count} order${stat.count === 1 ? '' : 's'}`,
        value: formatCurrency(stat.revenue, currency),
      })),
      followUpSuggestions: ['How much did I make this month?', 'Who owes me money?'],
      source: 'local',
    };
  }

  if (q.includes('how much') || q.includes('make') || q.includes('revenue') || q.includes('profit') || q.includes('month')) {
    const money = computeMoneySummary(orders, payments, expenses, 'this_month', todayIso);
    return {
      headline: `You have received ${formatCurrency(money.paymentsReceived, currency)} this month (${formatCurrency(money.estimatedProfit, currency)} after expenses).`,
      summary: `Total orders booked this month: ${formatCurrency(money.revenue, currency)}, with ${formatCurrency(money.outstandingPayments, currency)} still to collect across open orders.`,
      visualType: 'metrics',
      items: [
        { label: 'Payments received', sublabel: 'This month', value: formatCurrency(money.paymentsReceived, currency) },
        { label: 'Expenses logged', sublabel: 'This month', value: formatCurrency(money.expensesTotal, currency) },
        { label: 'Estimated profit', sublabel: 'Received minus expenses', value: formatCurrency(money.estimatedProfit, currency) },
        { label: 'Outstanding balance', sublabel: 'To collect', value: formatCurrency(money.outstandingPayments, currency) },
      ],
      followUpSuggestions: ['Who owes me money?', 'Which product made me the most money?'],
      source: 'local',
    };
  }

  // Default: What should I work on today?
  const focus = computeTodaysFocus(orders, tasks, currency, todayIso);
  return {
    headline:
      focus.length === 0
        ? 'Your desk is clear today — no urgent deadlines or overdue items.'
        : `Here are the top ${focus.length} priorities to focus on today.`,
    summary: 'Prioritised by order due dates, ready-to-post parcels, and pending balances.',
    visualType: 'list',
    items: focus.map((f) => ({
      label: f.title,
      sublabel: f.subtitle,
      value: f.actionLabel,
      relatedOrderId: f.actionType !== 'complete_task' ? f.targetId : undefined,
    })),
    followUpSuggestions: ['Who owes me money?', 'What orders are due this week?', 'Show my overdue orders.'],
    source: 'local',
  };
}

export function draftMessageLocally(params: {
  preset: MessagePresetType;
  customerName: string;
  businessName: string;
  product?: string;
  remainingFormatted?: string;
  dueDateFormatted?: string;
  customPrompt?: string;
}): { subjectLine: string; message: string } {
  const first = getFirstName(params.customerName);
  const item = params.product || 'your order';
  const rem = params.remainingFormatted || 'the remaining balance';

  switch (params.preset) {
    case 'payment_reminder':
      return {
        subjectLine: `Friendly reminder regarding ${item}`,
        message: `Hi ${first}! Just a friendly little reminder that ${rem} for your ${item} is still outstanding. Whenever you're ready, let me know and I can pop over my payment details. Thank you so much! — ${params.businessName}`,
      };
    case 'order_ready':
      return {
        subjectLine: `Your ${item} is ready!`,
        message: `Hi ${first}! Lovely news — your ${item} is all finished, packed, and ready to go! Let me know if you have any questions before it heads your way. Thank you again for your order! — ${params.businessName}`,
      };
    case 'preview_ready':
      return {
        subjectLine: `Preview ready for your ${item}`,
        message: `Hi ${first}! I’ve just finished putting together the preview for your ${item}. Have a look whenever you get a moment and let me know if you’d like any little tweaks before I finalise it for you! — ${params.businessName}`,
      };
    case 'need_info':
      return {
        subjectLine: `Quick question about your ${item}`,
        message: `Hi ${first}! Thank you again for ordering ${item}. Before I get started, could you send over a couple of quick details (such as reference photos or wording preferences) so I can make sure everything is spot on for ${params.dueDateFormatted || 'your deadline'}? Thank you! — ${params.businessName}`,
      };
    case 'thank_you':
      return {
        subjectLine: `Thank you from ${params.businessName}`,
        message: `Hi ${first}! I just wanted to say a huge thank you for supporting ${params.businessName} with your ${item} order. It means the world to a small business — I hope you absolutely love it! — ${params.businessName}`,
      };
    default:
      return {
        subjectLine: `Update on ${item}`,
        message: `Hi ${first}! ${params.customPrompt ? params.customPrompt.trim() : `Just checking in with a quick update on your ${item}.`} Let me know if you need anything at all! — ${params.businessName}`,
      };
  }
}

export function buildNotifications(
  orders: Order[],
  tasks: TaskItem[],
  existingReadMap: Record<string, boolean>,
  ownerId: string,
  businessId: string,
  currency: CurrencyCode,
  todayIso: string
): AppNotification[] {
  const list: AppNotification[] = [];
  const activeOrders = orders.filter((o) => !o.archived && o.status !== 'Cancelled');

  const ownerPfx = sanitizeId(ownerId).slice(0, 20);

  for (const o of activeOrders) {
    if (isActiveOrderStatus(o.status) && o.dueDate) {
      const d = diffDays(todayIso, o.dueDate);
      if (d < 0) {
        const id = sanitizeId(`notif_${ownerPfx}_overdue_${o.id}`);
        list.push({
          id,
          ownerId,
          businessId,
          type: 'overdue',
          title: `Overdue: ${o.customerName}`,
          message: `${o.product} (${o.orderNumber}) was due ${formatShortDate(o.dueDate)}.`,
          relatedOrderId: o.id,
          relatedCustomerId: o.customerId,
          read: Boolean(existingReadMap[id]),
        });
      } else if (d <= 3) {
        const id = sanitizeId(`notif_${ownerPfx}_deadline_${o.id}`);
        list.push({
          id,
          ownerId,
          businessId,
          type: 'deadline',
          title: d === 0 ? `Due today: ${o.product}` : `Due soon: ${o.product}`,
          message: `${o.customerName}'s order is ${formatRelativeDue(o.dueDate, todayIso).toLowerCase()}.`,
          relatedOrderId: o.id,
          relatedCustomerId: o.customerId,
          read: Boolean(existingReadMap[id]),
        });
      }
    }

    if (o.status === 'Waiting for Customer') {
      const id = sanitizeId(`notif_${ownerPfx}_approval_${o.id}`);
      list.push({
        id,
        ownerId,
        businessId,
        type: 'approval',
        title: `Waiting for ${getFirstName(o.customerName)}`,
        message: `${o.product} is awaiting customer preview approval or details.`,
        relatedOrderId: o.id,
        relatedCustomerId: o.customerId,
        read: Boolean(existingReadMap[id]),
      });
    }

    if (o.remainingBalance > 0 && (o.status === 'Ready' || o.status === 'Dispatched')) {
      const id = sanitizeId(`notif_${ownerPfx}_pay_${o.id}`);
      list.push({
        id,
        ownerId,
        businessId,
        type: 'payment',
        title: `Balance unpaid: ${formatCurrency(o.remainingBalance, currency)}`,
        message: `${o.customerName} still owes ${formatCurrency(o.remainingBalance, currency)} on ${o.product}.`,
        relatedOrderId: o.id,
        relatedCustomerId: o.customerId,
        read: Boolean(existingReadMap[id]),
      });
    }
  }

  const tasksToday = tasks.filter((t) => !t.completed && t.dueDate === todayIso);
  if (tasksToday.length > 0) {
    const id = sanitizeId(`notif_${ownerPfx}_tasks_${todayIso}`);
    list.push({
      id,
      ownerId,
      businessId,
      type: 'task',
      title: `${tasksToday.length} task${tasksToday.length === 1 ? '' : 's'} due today`,
      message: tasksToday.map((t) => t.title).slice(0, 2).join(' · '),
      relatedOrderId: tasksToday[0].orderId || '',
      relatedCustomerId: tasksToday[0].customerId || '',
      read: Boolean(existingReadMap[id]),
    });
  }

  return list.slice(0, 12);
}
