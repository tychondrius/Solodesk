import 'dotenv/config';
import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const GEMINI_MODEL = 'gemini-3.8-flash';

function getGeminiClient(): GoogleGenAI | null {
  const key = process.env.GEMINI_API_KEY;
  if (!key || key === 'MY_GEMINI_API_KEY' || key.trim().length < 8) {
    return null;
  }
  return new GoogleGenAI({
    apiKey: key,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

async function startServer() {
  const app = express();
  const httpServer = http.createServer(app);
  app.use(express.json({ limit: '512kb' }));

  app.get('/api/health', (_req, res) => {
    res.json({
      ok: true,
      aiConfigured: Boolean(getGeminiClient()),
    });
  });

  // 1. Natural-language Order Extraction
  app.post('/api/ai/parse-order', async (req, res) => {
    try {
      const { prompt, currency = 'GBP', todayIso } = req.body || {};
      if (!prompt || typeof prompt !== 'string' || prompt.trim().length < 3) {
        res.status(400).json({ error: 'Please describe the order in a few words first.' });
        return;
      }
      if (prompt.length > 2500) {
        res.status(400).json({ error: 'Order description is too long (maximum 2,500 characters).' });
        return;
      }

      const ai = getGeminiClient();
      if (!ai) {
        res.status(503).json({
          error: 'Gemini API key is not configured on the server yet. Used smart local extraction — please review carefully.',
          code: 'AI_UNAVAILABLE',
        });
        return;
      }

      const referenceDate =
        typeof todayIso === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(todayIso)
          ? todayIso
          : new Date().toISOString().slice(0, 10);

      const response = await ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: `Today's date is ${referenceDate}. The business currency is ${currency}.
Extract structured small-business order details from the following natural-language note:
"""
${prompt.trim()}
"""
Rules:
- Calculate totalPrice accurately by summing base item price + any add-on/extra prices mentioned.
- depositPaid is the amount already paid (0 if unpaid).
- remainingBalance = max(0, totalPrice - depositPaid).
- Convert any mentioned due date into YYYY-MM-DD relative to ${referenceDate}, and provide a friendly dueDateDisplay like "14 November".
- Generate 2 to 4 short, practical maker tasks in suggestedTasks (e.g., "Create portrait", "Send preview", "Package & post order").`,
        config: {
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              customerName: { type: Type.STRING, description: 'Full or first name of customer.' },
              product: { type: Type.STRING, description: 'Primary product or service ordered.' },
              extras: { type: Type.STRING, description: 'Any extras or add-ons (empty string if none).' },
              description: { type: Type.STRING, description: 'Concise combined order description.' },
              quantity: { type: Type.NUMBER, description: 'Total units ordered (default 1).' },
              totalPrice: { type: Type.NUMBER, description: 'Total order price including extras.' },
              depositPaid: { type: Type.NUMBER, description: 'Amount already paid by customer.' },
              remainingBalance: { type: Type.NUMBER, description: 'Remaining balance owed.' },
              dueDate: { type: Type.STRING, description: 'Due date in YYYY-MM-DD format.' },
              dueDateDisplay: { type: Type.STRING, description: 'Human-friendly due date e.g. 14 November.' },
              deliveryMethod: {
                type: Type.STRING,
                description: 'Royal Mail / Post, Tracked Courier, Local Collection, Local Delivery, or Digital Download.',
              },
              customerNotes: { type: Type.STRING, description: 'Any special notes or personalisation details.' },
              suggestedTasks: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: 'Short actionable steps to fulfil this order.',
              },
            },
            required: [
              'customerName',
              'product',
              'extras',
              'description',
              'quantity',
              'totalPrice',
              'depositPaid',
              'remainingBalance',
              'dueDate',
              'dueDateDisplay',
              'deliveryMethod',
              'customerNotes',
              'suggestedTasks',
            ],
          },
        },
      });

      const rawText = response.text;
      if (!rawText) {
        res.status(502).json({ error: 'Gemini returned an empty response. Please try again.' });
        return;
      }

      const parsed = JSON.parse(rawText.trim());
      res.json({ ok: true, source: 'gemini', parsed });
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unable to parse order with AI right now.';
      res.status(502).json({ error: msg, code: 'AI_ERROR' });
    }
  });

  // 2. Scoped Business Assistant
  app.post('/api/ai/assistant', async (req, res) => {
    try {
      const { question, businessContext } = req.body || {};
      if (!question || typeof question !== 'string' || question.trim().length < 2) {
        res.status(400).json({ error: 'Please enter a question.' });
        return;
      }
      if (!businessContext || typeof businessContext !== 'object') {
        res.status(400).json({ error: 'Missing business context.' });
        return;
      }

      const ai = getGeminiClient();
      if (!ai) {
        res.status(503).json({
          error: 'Gemini API is unavailable; showing live calculation from your workspace data.',
          code: 'AI_UNAVAILABLE',
        });
        return;
      }

      const response = await ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: `You are SoloDesk Assistant, a warm, concise business helper for "${businessContext.businessName || 'this small business'}".
Today's date: ${businessContext.todayIso}.
Currency: ${businessContext.currency} (symbol: ${businessContext.symbol}).

ONLY use the authenticated user's workspace data provided below. Never invent orders, customers, or numbers.
Workspace Data JSON:
${JSON.stringify({
  orders: businessContext.orders || [],
  customers: businessContext.customers || [],
  expenses: businessContext.expenses || [],
  tasks: businessContext.tasks || [],
  summary: businessContext.summary || {},
})}

User question: "${question.trim()}"

Provide:
- headline: A clear 1-sentence direct answer with exact figures formatted in ${businessContext.currency}.
- summary: A brief, friendly 1-2 sentence context note (no accounting jargon).
- visualType: "list" when listing customers/orders/products/tasks, "metrics" when comparing financial totals, or "none" if purely conversational.
- items: Structured rows so the UI can render crisp cards (include relatedOrderId or relatedCustomerId from the data whenever applicable).
- footerLabel & footerValue: Optional total row (e.g., "Total outstanding" and "£37").
- followUpSuggestions: 2-3 helpful follow-up questions.`,
        config: {
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              headline: { type: Type.STRING },
              summary: { type: Type.STRING },
              visualType: { type: Type.STRING, description: 'list, metrics, or none' },
              items: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    label: { type: Type.STRING },
                    sublabel: { type: Type.STRING },
                    value: { type: Type.STRING },
                    status: { type: Type.STRING },
                    relatedOrderId: { type: Type.STRING },
                    relatedCustomerId: { type: Type.STRING },
                  },
                  required: ['label', 'sublabel', 'value'],
                },
              },
              footerLabel: { type: Type.STRING },
              footerValue: { type: Type.STRING },
              followUpSuggestions: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
            },
            required: ['headline', 'summary', 'visualType', 'items', 'followUpSuggestions'],
          },
        },
      });

      const rawText = response.text;
      if (!rawText) {
        res.status(502).json({ error: 'Empty response from Gemini.' });
        return;
      }

      const data = JSON.parse(rawText.trim());
      res.json({ ok: true, source: 'gemini', data });
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'AI assistant error.';
      res.status(502).json({ error: msg, code: 'AI_ERROR' });
    }
  });

  // 3. Friendly Customer Message Writer
  app.post('/api/ai/write-message', async (req, res) => {
    try {
      const {
        preset = 'payment_reminder',
        customPrompt = '',
        customerName = 'there',
        businessName = 'My Studio',
        orderSummary,
      } = req.body || {};

      const ai = getGeminiClient();
      if (!ai) {
        res.status(503).json({
          error: 'Gemini API is unavailable; drafted a template message you can edit.',
          code: 'AI_UNAVAILABLE',
        });
        return;
      }

      const response = await ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: `Write a warm, friendly, human message from small business "${businessName}" to customer "${customerName}" suitable for WhatsApp, Instagram DM, Etsy message, or email.
Message type: ${preset}
${customPrompt ? `Additional guidance from seller: ${customPrompt}` : ''}
${orderSummary ? `Order details: ${JSON.stringify(orderSummary)}` : ''}

Keep it polite, natural, concise (2-4 short sentences), warm without sounding robotic or pushy. Do not include placeholder brackets if real details are provided.`,
        config: {
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              subjectLine: { type: Type.STRING, description: 'Short email subject line if sent via email.' },
              message: { type: Type.STRING, description: 'Ready-to-copy friendly message body.' },
            },
            required: ['subjectLine', 'message'],
          },
        },
      });

      const rawText = response.text;
      if (!rawText) {
        res.status(502).json({ error: 'Empty response from Gemini.' });
        return;
      }

      const parsed = JSON.parse(rawText.trim());
      res.json({ ok: true, source: 'gemini', ...parsed });
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unable to generate message right now.';
      res.status(502).json({ error: msg, code: 'AI_ERROR' });
    }
  });

  // 4. Smart Business Insights
  app.post('/api/ai/insights', async (req, res) => {
    try {
      const { businessContext } = req.body || {};
      const ai = getGeminiClient();
      if (!ai || !businessContext) {
        res.status(503).json({ error: 'Gemini insights unavailable.', code: 'AI_UNAVAILABLE' });
        return;
      }

      const response = await ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: `Analyse this small business snapshot for "${businessContext.businessName}" (Currency: ${businessContext.currency}, Today: ${businessContext.todayIso}) and return 3 concise, genuinely useful insights (no gimmicks, no accounting jargon).
Snapshot:
${JSON.stringify(businessContext.summary || {})}
Top products & orders sample:
${JSON.stringify((businessContext.orders || []).slice(0, 15))}`,
        config: {
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              insights: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    title: { type: Type.STRING },
                    detail: { type: Type.STRING },
                    category: {
                      type: Type.STRING,
                      description: 'revenue, product, payments, or schedule',
                    },
                  },
                  required: ['title', 'detail', 'category'],
                },
              },
            },
            required: ['insights'],
          },
        },
      });

      const rawText = response.text;
      if (!rawText) {
        res.status(502).json({ error: 'Empty response from Gemini.' });
        return;
      }
      const parsed = JSON.parse(rawText.trim());
      res.json({ ok: true, source: 'gemini', insights: parsed.insights || [] });
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unable to refresh AI insights.';
      res.status(502).json({ error: msg, code: 'AI_ERROR' });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR === 'true' ? false : { server: httpServer },
        watch: process.env.DISABLE_HMR === 'true' ? null : {},
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`SoloDesk server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
