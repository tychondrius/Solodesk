import { auth } from '../firebase';
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
  isDeterministicAssistantQuery,
  isUsableOrderDraft,
  parseOrderLocally,
  sanitizeUserFacingMessage,
  validateParsedOrderDraft,
} from '../utils/businessLogic';

const TRANSIENT_HTTP_STATUSES = new Set([408, 429, 500, 502, 503, 504]);

function delayMs(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function buildAuthorizedHeaders(): Promise<Record<string, string> | null> {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    return null;
  }
  try {
    const idToken = await currentUser.getIdToken();
    if (!idToken) return null;
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
    };
  } catch {
    return null;
  }
}

async function postAiEndpoint(
  url: string,
  payload: Record<string, unknown>,
  timeoutMs = 8500
): Promise<{ ok: boolean; status: number; data: Record<string, unknown> | null }> {
  const headers = await buildAuthorizedHeaders();
  if (!headers) {
    // Unauthenticated / Interactive Demo Mode: skip server call to avoid 401 console noise
    return { ok: false, status: 0, data: null };
  }

  const maxAttempts = 2;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(timeoutMs),
      });

      let parsedBody: Record<string, unknown> | null = null;
      try {
        parsedBody = (await response.json()) as Record<string, unknown>;
      } catch {
        parsedBody = null;
      }

      if (response.ok) {
        return { ok: true, status: response.status, data: parsedBody };
      }

      if (attempt < maxAttempts && TRANSIENT_HTTP_STATUSES.has(response.status)) {
        await delayMs(350 * attempt);
        continue;
      }

      return { ok: false, status: response.status, data: parsedBody };
    } catch {
      if (attempt < maxAttempts) {
        await delayMs(350 * attempt);
        continue;
      }
      return { ok: false, status: 0, data: null };
    }
  }

  return { ok: false, status: 0, data: null };
}

export async function extractOrderWithAi(params: {
  prompt: string;
  currency: CurrencyCode;
  todayIso: string;
}): Promise<{
  draft: ParsedOrderDraft | null;
  source: 'gemini' | 'fallback';
  notice?: string;
  error?: string;
}> {
  const res = await postAiEndpoint('/api/ai/parse-order', params, 8500);
  if (res.ok && res.data?.parsed) {
    const validated = validateParsedOrderDraft(res.data.parsed, params.todayIso, params.prompt);
    if (validated && isUsableOrderDraft(validated)) {
      return {
        draft: validated,
        source: 'gemini',
        notice: 'Order details extracted. Please review before saving.',
      };
    }
  }

  const fallback = parseOrderLocally(params.prompt, params.todayIso);
  if (isUsableOrderDraft(fallback)) {
    return {
      draft: fallback,
      source: 'fallback',
      notice: 'Order details extracted. Please review before saving.',
    };
  }

  return {
    draft: null,
    source: 'fallback',
    error: 'SoloDesk couldn’t confidently understand this order. Please review the details manually.',
  };
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
  // Deterministic workspace queries always use exact local calculations first
  if (isDeterministicAssistantQuery(params.question) || !auth.currentUser) {
    const local = answerAssistantLocally(
      params.question,
      params.orders,
      params.payments,
      params.expenses,
      params.tasks,
      params.currency,
      params.todayIso
    );
    return { response: local };
  }

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

  const res = await postAiEndpoint(
    '/api/ai/assistant',
    {
      question: params.question,
      businessContext,
    },
    8500
  );

  const d = res.data?.data as Record<string, unknown> | undefined;
  if (res.ok && d && typeof d.headline === 'string' && d.headline.trim()) {
    return {
      response: {
        headline: String(d.headline),
        summary: String(d.summary || ''),
        visualType:
          d.visualType === 'list' || d.visualType === 'metrics' ? d.visualType : 'none',
        items: Array.isArray(d.items) ? (d.items.slice(0, 12) as AssistantResponse['items']) : [],
        footerLabel: d.footerLabel ? String(d.footerLabel) : undefined,
        footerValue: d.footerValue ? String(d.footerValue) : undefined,
        followUpSuggestions: Array.isArray(d.followUpSuggestions)
          ? d.followUpSuggestions.slice(0, 3).map(String)
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
  };
}

export async function generateCustomerMessage(params: {
  preset: MessagePresetType;
  customPrompt?: string;
  customerName: string;
  businessName: string;
  currency: CurrencyCode;
  order?: Order | null;
}): Promise<{
  subjectLine: string;
  message: string;
  source: 'gemini' | 'fallback';
  warning?: string;
}> {
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

  const res = await postAiEndpoint(
    '/api/ai/write-message',
    {
      preset: params.preset,
      customPrompt: params.customPrompt || '',
      customerName: params.customerName,
      businessName: params.businessName,
      orderSummary,
    },
    8500
  );

  if (res.ok && typeof res.data?.message === 'string' && res.data.message.trim()) {
    return {
      subjectLine: String(res.data.subjectLine || ''),
      message: String(res.data.message),
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

  const safeNotice =
    res.status === 429
      ? sanitizeUserFacingMessage(
          res.data?.error,
          'Drafted locally so you can edit and send right away.'
        )
      : undefined;

  return {
    ...local,
    source: 'fallback',
    warning: safeNotice,
  };
}

export async function fetchAiBusinessInsights(params: {
  businessName: string;
  currency: CurrencyCode;
  todayIso: string;
  orders: Order[];
  payments: PaymentRecord[];
  expenses: ExpenseRecord[];
}): Promise<SmartInsight[] | null> {
  if (!auth.currentUser) {
    return null;
  }

  const summary = computeMoneySummary(
    params.orders,
    params.payments,
    params.expenses,
    'this_month',
    params.todayIso
  );

  const res = await postAiEndpoint(
    '/api/ai/insights',
    {
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
    },
    10000
  );

  const insightsRaw = res.data?.insights;
  if (res.ok && Array.isArray(insightsRaw) && insightsRaw.length > 0) {
    return insightsRaw.slice(0, 3).map((item: Record<string, unknown>, idx: number) => ({
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
}
