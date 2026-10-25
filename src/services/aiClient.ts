import {
  AssistantResponse,
  CURRENCIES,
  CurrencyCode,
  Customer,
  ExpenseRecord,
  MessagePresetType,
  Order,
  ParsedOrderDraft,
  PaymentRecord,
  SmartInsight,
  TaskItem,
} from '../types';
import {
  answerAssistantLocally,
  computeMoneySummary,
  draftMessageLocally,
  formatCurrency,
  formatShortDate,
  parseOrderLocally,
  validateParsedOrderDraft,
} from '../utils/businessLogic';

export async function extractOrderWithAi(params: {
  prompt: string;
  currency: CurrencyCode;
  todayIso: string;
}): Promise<{
  draft: ParsedOrderDraft;
  source: 'gemini' | 'fallback';
  warning?: string;
}> {
  try {
    const response = await fetch('/api/ai/parse-order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
      signal: AbortSignal.timeout(5000),
    });
    const data = await response.json();
    if (response.ok && data?.parsed) {
      const validated = validateParsedOrderDraft(data.parsed, params.todayIso);
      if (validated) {
        return { draft: validated, source: 'gemini' };
      }
    }
    const fallback = parseOrderLocally(params.prompt, params.todayIso);
    return {
      draft: fallback,
      source: 'fallback',
      warning:
        data?.error ||
        'Live AI extraction was unavailable — extracted a draft locally for you to review.',
    };
  } catch {
    const fallback = parseOrderLocally(params.prompt, params.todayIso);
    return {
      draft: fallback,
      source: 'fallback',
      warning: 'Could not reach the AI service — extracted a draft locally for you to review.',
    };
  }
}

export async function askBusinessAssistant(params: {
  question: string;
  businessName: string;
  currency: CurrencyCode;
  todayIso: string;
  orders: Order[];
  customers: Customer[];
  payments: PaymentRecord[];
  expenses: ExpenseRecord[];
  tasks: TaskItem[];
}): Promise<{ response: AssistantResponse; warning?: string }> {
  const moneyThisMonth = computeMoneySummary(
    params.orders,
    params.payments,
    params.expenses,
    'this_month',
    params.todayIso
  );

  const businessContext = {
    businessName: params.businessName,
    currency: params.currency,
    symbol: CURRENCIES[params.currency].symbol,
    todayIso: params.todayIso,
    summary: moneyThisMonth,
    orders: params.orders
      .filter((o) => !o.archived)
      .slice(0, 60)
      .map((o) => ({
        id: o.id,
        orderNumber: o.orderNumber,
        customerId: o.customerId,
        customerName: o.customerName,
        product: o.product,
        totalPrice: o.totalPrice,
        amountPaid: o.amountPaid,
        remainingBalance: o.remainingBalance,
        orderDate: o.orderDate,
        dueDate: o.dueDate,
        status: o.status,
      })),
    customers: params.customers.slice(0, 50).map((c) => ({
      id: c.id,
      name: c.name,
      instagram: c.instagram,
      lastInteractionAt: c.lastInteractionAt,
    })),
    expenses: params.expenses.slice(0, 40).map((e) => ({
      description: e.description,
      category: e.category,
      amount: e.amount,
      date: e.date,
    })),
    tasks: params.tasks
      .filter((t) => !t.completed)
      .slice(0, 30)
      .map((t) => ({
        title: t.title,
        customerName: t.customerName,
        dueDate: t.dueDate,
        priority: t.priority,
      })),
  };

  try {
    const res = await fetch('/api/ai/assistant', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        question: params.question,
        businessContext,
      }),
      signal: AbortSignal.timeout(5000),
    });
    const payload = await res.json();
    if (res.ok && payload?.data?.headline) {
      const d = payload.data;
      return {
        response: {
          headline: String(d.headline),
          summary: String(d.summary || ''),
          visualType:
            d.visualType === 'list' || d.visualType === 'metrics' ? d.visualType : 'none',
          items: Array.isArray(d.items) ? d.items.slice(0, 12) : [],
          footerLabel: d.footerLabel ? String(d.footerLabel) : undefined,
          footerValue: d.footerValue ? String(d.footerValue) : undefined,
          followUpSuggestions: Array.isArray(d.followUpSuggestions)
            ? d.followUpSuggestions.slice(0, 3)
            : [],
          source: 'gemini',
        },
      };
    }

    const local = answerAssistantLocally(
      params.question,
      params.orders,
      params.payments,
      params.expenses,
      params.tasks,
      params.currency,
      params.todayIso
    );
    return {
      response: local,
      warning: payload?.error,
    };
  } catch {
    const local = answerAssistantLocally(
      params.question,
      params.orders,
      params.payments,
      params.expenses,
      params.tasks,
      params.currency,
      params.todayIso
    );
    return {
      response: local,
      warning: 'Answered directly from your workspace records while AI connection was offline.',
    };
  }
}

export async function generateCustomerMessage(params: {
  preset: MessagePresetType;
  customPrompt?: string;
  customerName: string;
  businessName: string;
  currency: CurrencyCode;
  order?: Order | null;
}): Promise<{ subjectLine: string; message: string; source: 'gemini' | 'fallback'; warning?: string }> {
  const orderSummary = params.order
    ? {
        orderNumber: params.order.orderNumber,
        product: params.order.product,
        total: formatCurrency(params.order.totalPrice, params.currency),
        paid: formatCurrency(params.order.amountPaid, params.currency),
        remaining: formatCurrency(params.order.remainingBalance, params.currency),
        dueDate: formatShortDate(params.order.dueDate),
        trackingNumber: params.order.trackingNumber || undefined,
      }
    : undefined;

  try {
    const res = await fetch('/api/ai/write-message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        preset: params.preset,
        customPrompt: params.customPrompt || '',
        customerName: params.customerName,
        businessName: params.businessName,
        orderSummary,
      }),
      signal: AbortSignal.timeout(5000),
    });
    const data = await res.json();
    if (res.ok && data?.message) {
      return {
        subjectLine: String(data.subjectLine || ''),
        message: String(data.message),
        source: 'gemini',
      };
    }
    const local = draftMessageLocally({
      preset: params.preset,
      customerName: params.customerName,
      businessName: params.businessName,
      product: params.order?.product,
      remainingFormatted: params.order
        ? formatCurrency(params.order.remainingBalance, params.currency)
        : undefined,
      dueDateFormatted: params.order ? formatShortDate(params.order.dueDate) : undefined,
      customPrompt: params.customPrompt,
    });
    return { ...local, source: 'fallback', warning: data?.error };
  } catch {
    const local = draftMessageLocally({
      preset: params.preset,
      customerName: params.customerName,
      businessName: params.businessName,
      product: params.order?.product,
      remainingFormatted: params.order
        ? formatCurrency(params.order.remainingBalance, params.currency)
        : undefined,
      dueDateFormatted: params.order ? formatShortDate(params.order.dueDate) : undefined,
      customPrompt: params.customPrompt,
    });
    return {
      ...local,
      source: 'fallback',
      warning: 'Generated a friendly editable draft locally while AI service was offline.',
    };
  }
}

export async function fetchAiBusinessInsights(params: {
  businessName: string;
  currency: CurrencyCode;
  todayIso: string;
  orders: Order[];
  payments: PaymentRecord[];
  expenses: ExpenseRecord[];
}): Promise<SmartInsight[] | null> {
  const summary = computeMoneySummary(
    params.orders,
    params.payments,
    params.expenses,
    'this_month',
    params.todayIso
  );
  try {
    const res = await fetch('/api/ai/insights', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        businessContext: {
          businessName: params.businessName,
          currency: params.currency,
          todayIso: params.todayIso,
          summary,
          orders: params.orders.slice(0, 15).map((o) => ({
            product: o.product,
            totalPrice: o.totalPrice,
            remainingBalance: o.remainingBalance,
            orderDate: o.orderDate,
            status: o.status,
          })),
        },
      }),
      signal: AbortSignal.timeout(15000),
    });
    const data = await res.json();
    if (res.ok && Array.isArray(data?.insights) && data.insights.length > 0) {
      return data.insights.slice(0, 3).map((item: Record<string, unknown>, idx: number) => ({
        id: `ai_insight_${idx}`,
        title: String(item.title || ''),
        detail: String(item.detail || ''),
        category:
          item.category === 'revenue' ||
          item.category === 'product' ||
          item.category === 'payments' ||
          item.category === 'schedule'
            ? item.category
            : 'revenue',
      }));
    }
    return null;
  } catch {
    return null;
  }
}
