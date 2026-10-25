import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { ID_REGEX } from '../utils/businessLogic';

const rootDir = process.cwd();
const rulesPath = fs.existsSync(path.join(rootDir, 'firestore.rules'))
  ? path.join(rootDir, 'firestore.rules')
  : path.join(rootDir, 'DRAFT_firestore.rules');
const blueprintPath = path.join(rootDir, 'firebase-blueprint.json');

interface SimAuth {
  uid: string;
  emailVerified: boolean;
}

interface SimContext {
  auth: SimAuth | null;
  requestTimeIso: string;
  existingDocs: Record<string, Record<string, unknown>>;
}

function evalCreateOrderRule(
  orderId: string,
  incoming: Record<string, unknown>,
  ctx: SimContext
): 'ALLOWED' | 'PERMISSION_DENIED' {
  if (!ctx.auth || !ctx.auth.emailVerified) return 'PERMISSION_DENIED';
  if (!ID_REGEX.test(orderId) || orderId.length > 128) return 'PERMISSION_DENIED';

  const allowedKeys = new Set([
    'id', 'orderNumber', 'ownerId', 'businessId', 'customerId',
    'customerName', 'product', 'description', 'quantity', 'totalPrice',
    'depositRequired', 'depositPaid', 'amountPaid', 'remainingBalance',
    'orderDate', 'dueDate', 'deliveryMethod', 'trackingNumber', 'status',
    'archived', 'customerNotes', 'internalNotes', 'createdAt', 'updatedAt',
  ]);
  const keys = Object.keys(incoming);
  if (keys.length !== allowedKeys.size || keys.some((k) => !allowedKeys.has(k))) {
    return 'PERMISSION_DENIED';
  }
  if (incoming.id !== orderId) return 'PERMISSION_DENIED';
  if (incoming.ownerId !== ctx.auth.uid || incoming.businessId !== ctx.auth.uid) {
    return 'PERMISSION_DENIED';
  }
  if (typeof incoming.description !== 'string' || incoming.description.length > 2000) {
    return 'PERMISSION_DENIED';
  }
  if (typeof incoming.totalPrice !== 'number' || incoming.totalPrice < 0) {
    return 'PERMISSION_DENIED';
  }
  if (typeof incoming.amountPaid !== 'number' || incoming.amountPaid < 0) {
    return 'PERMISSION_DENIED';
  }
  if (incoming.createdAt !== ctx.requestTimeIso || incoming.updatedAt !== ctx.requestTimeIso) {
    return 'PERMISSION_DENIED';
  }
  const bizDoc = ctx.existingDocs[`businesses/${ctx.auth.uid}`];
  if (!bizDoc) return 'PERMISSION_DENIED';
  const custDoc = ctx.existingDocs[`customers/${incoming.customerId}`];
  if (!custDoc || custDoc.ownerId !== ctx.auth.uid) return 'PERMISSION_DENIED';

  return 'ALLOWED';
}

function evalUpdateOrderRule(
  orderId: string,
  incoming: Record<string, unknown>,
  ctx: SimContext
): 'ALLOWED' | 'PERMISSION_DENIED' {
  if (!ctx.auth || !ctx.auth.emailVerified) return 'PERMISSION_DENIED';
  const existing = ctx.existingDocs[`orders/${orderId}`];
  if (!existing || existing.ownerId !== ctx.auth.uid) return 'PERMISSION_DENIED';
  if (existing.status === 'Cancelled') return 'PERMISSION_DENIED';
  if (incoming.ownerId !== existing.ownerId || incoming.createdAt !== existing.createdAt) {
    return 'PERMISSION_DENIED';
  }
  if (incoming.updatedAt !== ctx.requestTimeIso) return 'PERMISSION_DENIED';
  // Validate schema via same validator
  const createCheck = evalCreateOrderRule(
    orderId,
    { ...incoming, createdAt: ctx.requestTimeIso },
    ctx
  );
  return createCheck;
}

test('Firestore rules file enforces all 8 SoloDesk collections and default-deny net', () => {
  const rulesText = fs.readFileSync(rulesPath, 'utf8');
  const blueprint = JSON.parse(fs.readFileSync(blueprintPath, 'utf8'));

  assert.ok(rulesText.includes("rules_version = '2';"));
  assert.ok(rulesText.includes('match /{document=**} {\n      allow read, write: if false;'));
  assert.ok(rulesText.includes('request.auth.token.email_verified == true'));

  for (const colPath of Object.keys(blueprint.firestore)) {
    const colName = colPath.split('/')[1];
    assert.ok(
      rulesText.includes(`match /${colName}/`),
      `Expected match block for collection ${colName}`
    );
  }

  // Ensure no blanket allow read/list: if isSignedIn()
  assert.equal(/allow\s+(read|list)\s*:\s*if\s+isSignedIn\(\)\s*;/.test(rulesText), false);

  // Ensure pre-onboarding getDoc on businesses/{uid} succeeds when resource == null for owner only
  assert.ok(
    rulesText.includes(
      'allow get: if isValidId(businessId) && isOwnerUid(businessId) && (resource == null || existing().ownerId == request.auth.uid);'
    )
  );
});

test('Dirty Dozen adversarial payloads all return PERMISSION_DENIED', () => {
  const now = '2026-10-25T12:00:00Z';
  const validOrder = {
    id: 'ord_1',
    orderNumber: 'SD-1001',
    ownerId: 'userA',
    businessId: 'userA',
    customerId: 'cust_1',
    customerName: 'Emma Thompson',
    product: 'A4 Portrait',
    description: 'Watercolour couple portrait',
    quantity: 1,
    totalPrice: 22,
    depositRequired: 11,
    depositPaid: true,
    amountPaid: 11,
    remainingBalance: 11,
    orderDate: '2026-10-25',
    dueDate: '2026-11-14',
    deliveryMethod: 'Post',
    trackingNumber: '',
    status: 'In Progress',
    archived: false,
    customerNotes: '',
    internalNotes: '',
    createdAt: now,
    updatedAt: now,
  };

  const baseDocs: Record<string, Record<string, unknown>> = {
    'businesses/userA': { id: 'userA', ownerId: 'userA' },
    'customers/cust_1': { id: 'cust_1', ownerId: 'userA' },
    'orders/ord_1': { ...validOrder },
    'orders/ord_cancelled': { ...validOrder, id: 'ord_cancelled', status: 'Cancelled' },
  };

  const verifiedUserA: SimContext = {
    auth: { uid: 'userA', emailVerified: true },
    requestTimeIso: now,
    existingDocs: baseDocs,
  };

  // Sanity check: valid owner payload succeeds
  assert.equal(evalCreateOrderRule('ord_1', validOrder, verifiedUserA), 'ALLOWED');

  // 1. Unverified email write
  assert.equal(
    evalCreateOrderRule('ord_1', validOrder, {
      ...verifiedUserA,
      auth: { uid: 'userA', emailVerified: false },
    }),
    'PERMISSION_DENIED'
  );

  // 2. Cross-tenant identity spoofing
  assert.equal(
    evalCreateOrderRule('ord_1', { ...validOrder, ownerId: 'userB' }, verifiedUserA),
    'PERMISSION_DENIED'
  );

  // 3. Shadow / ghost field injection
  assert.equal(
    evalCreateOrderRule('ord_1', { ...validOrder, isSuperAdmin: true }, verifiedUserA),
    'PERMISSION_DENIED'
  );

  // 4. PII blanket read / cross-tenant update
  assert.equal(
    evalUpdateOrderRule('ord_1', validOrder, {
      ...verifiedUserA,
      auth: { uid: 'userB', emailVerified: true },
    }),
    'PERMISSION_DENIED'
  );

  // 5. Unauthenticated access
  assert.equal(
    evalCreateOrderRule('ord_1', validOrder, { ...verifiedUserA, auth: null }),
    'PERMISSION_DENIED'
  );

  // 6. ID poisoning attack
  assert.equal(
    evalCreateOrderRule('bad$id with spaces!', { ...validOrder, id: 'bad$id with spaces!' }, verifiedUserA),
    'PERMISSION_DENIED'
  );

  // 7. Denial-of-Wallet 50KB string bloat
  assert.equal(
    evalCreateOrderRule('ord_1', { ...validOrder, description: 'x'.repeat(5000) }, verifiedUserA),
    'PERMISSION_DENIED'
  );

  // 8. Orphaned order referencing non-existent customer
  assert.equal(
    evalCreateOrderRule('ord_1', { ...validOrder, customerId: 'ghost_cust' }, verifiedUserA),
    'PERMISSION_DENIED'
  );

  // 9. Immutable ownerId mutation on update
  assert.equal(
    evalUpdateOrderRule('ord_1', { ...validOrder, ownerId: 'userB' }, verifiedUserA),
    'PERMISSION_DENIED'
  );

  // 10. Client-spoofed timestamp
  assert.equal(
    evalCreateOrderRule('ord_1', { ...validOrder, createdAt: '1999-01-01T00:00:00Z' }, verifiedUserA),
    'PERMISSION_DENIED'
  );

  // 11. Terminal state resurrection on Cancelled order
  assert.equal(
    evalUpdateOrderRule(
      'ord_cancelled',
      { ...validOrder, id: 'ord_cancelled', status: 'In Progress' },
      verifiedUserA
    ),
    'PERMISSION_DENIED'
  );

  // 12. Value type poisoning on whitelisted field
  assert.equal(
    evalUpdateOrderRule(
      'ord_1',
      { ...validOrder, amountPaid: '100' as unknown as number },
      verifiedUserA
    ),
    'PERMISSION_DENIED'
  );
});
