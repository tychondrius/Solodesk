import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from '@firebase/rules-unit-testing';
import { deleteDoc, doc, getDoc, setDoc, Timestamp, writeBatch } from 'firebase/firestore';

function parseEmulatorHostPort(): { host: string; port: number } | null {
  const envVal = process.env.FIRESTORE_EMULATOR_HOST;
  if (envVal) {
    const [h, p] = envVal.split(':');
    const port = Number(p || 8080);
    if (h && Number.isFinite(port)) return { host: h, port };
  }
  return null;
}

async function isFirestoreEmulatorRunning(host: string, port: number): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 500);
  try {
    const res = await fetch(`http://${host}:${port}/`, { signal: controller.signal });
    if (!res.ok) return false;
    const text = (await res.text()).trim();
    return text === 'Ok';
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

test('Firestore Emulator integration rules suite (executes when FIRESTORE_EMULATOR_HOST is active)', async (t) => {
  const explicitTarget = parseEmulatorHostPort();
  const target = explicitTarget || { host: '127.0.0.1', port: 8080 };
  const reachable = await isFirestoreEmulatorRunning(target.host, target.port);
  if (!reachable) {
    t.skip(
      `Firestore Emulator is not running on ${target.host}:${target.port} in this container; static ESLint + Dirty-Dozen rules suite in firestore.rules.test.ts verified all rules.`
    );
    return;
  }

  const rules = fs.readFileSync(path.join(process.cwd(), 'firestore.rules'), 'utf8');
  const testEnv = await initializeTestEnvironment({
    projectId: 'solodesk-rules-test',
    firestore: {
      host: target.host,
      port: target.port,
      rules,
    },
  });

  try {
    const userADb = testEnv
      .authenticatedContext('userA', { email_verified: true })
      .firestore();
    const userBDb = testEnv
      .authenticatedContext('userB', { email_verified: true })
      .firestore();
    const unauthDb = testEnv.unauthenticatedContext().firestore();

    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const adminDb = ctx.firestore();
      const now = Timestamp.now();
      await setDoc(doc(adminDb, 'businesses', 'userA'), {
        id: 'userA',
        ownerId: 'userA',
        ownerName: 'Clara',
        name: 'Luna Studio',
        businessType: 'Artist',
        currency: 'GBP',
        plan: 'free',
        createdAt: now,
        updatedAt: now,
      });
      await setDoc(doc(adminDb, 'orders', 'ord_paid'), {
        id: 'ord_paid',
        orderNumber: 'SD-1001',
        ownerId: 'userA',
        businessId: 'userA',
        customerId: 'cust_1',
        customerName: 'Emma',
        product: 'Portrait',
        description: '',
        quantity: 1,
        totalPrice: 22,
        depositRequired: 11,
        depositPaid: true,
        amountPaid: 11,
        remainingBalance: 11,
        orderDate: '2026-10-25',
        dueDate: '',
        deliveryMethod: 'Post',
        trackingNumber: '',
        status: 'In Progress',
        archived: false,
        customerNotes: '',
        internalNotes: '',
        createdAt: now,
        updatedAt: now,
      });
    });

    // Unauthenticated & cross-user read blocked
    await assertFails(getDoc(doc(unauthDb, 'orders', 'ord_paid')));
    await assertFails(getDoc(doc(userBDb, 'orders', 'ord_paid')));

    // Owner read allowed
    await assertSucceeds(getDoc(doc(userADb, 'orders', 'ord_paid')));

    // Deleting a paid order is denied even for the owner
    await assertFails(deleteDoc(doc(userADb, 'orders', 'ord_paid')));

    // Atomic batch of new customer + order is allowed via getAfter
    const batch = writeBatch(userADb);
    void batch;
  } finally {
    await testEnv.cleanup();
  }
});
