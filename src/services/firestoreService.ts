import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  Unsubscribe,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import {
  AppNotification,
  BusinessProfile,
  Customer,
  ExpenseRecord,
  Order,
  PaymentRecord,
  TaskItem,
  UserProfile,
} from '../types';
import { clampString, roundMoney, sanitizeId } from '../utils/businessLogic';

function serializeTimestamp(val: unknown): string | undefined {
  if (!val) return undefined;
  if (val instanceof Timestamp) return val.toDate().toISOString();
  if (typeof val === 'string') return val;
  return undefined;
}

export async function fetchUserAndBusiness(uid: string): Promise<{
  userProfile: UserProfile | null;
  businessProfile: BusinessProfile | null;
}> {
  const safeUid = sanitizeId(uid);
  const userPath = `users/${safeUid}`;
  const bizPath = `businesses/${safeUid}`;

  let userProfile: UserProfile | null = null;
  let businessProfile: BusinessProfile | null = null;

  try {
    const userSnap = await getDoc(doc(db, 'users', safeUid));
    if (userSnap.exists()) {
      const d = userSnap.data();
      userProfile = {
        uid: d.uid,
        name: d.name,
        email: d.email,
        businessId: d.businessId,
        onboardingCompleted: Boolean(d.onboardingCompleted),
        plan: d.plan === 'solo' ? 'solo' : 'free',
        theme: d.theme === 'dark' ? 'dark' : 'light',
        notificationsEnabled: d.notificationsEnabled !== false,
        createdAt: serializeTimestamp(d.createdAt),
        updatedAt: serializeTimestamp(d.updatedAt),
      };
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, userPath);
  }

  try {
    const bizSnap = await getDoc(doc(db, 'businesses', safeUid));
    if (bizSnap.exists()) {
      const d = bizSnap.data();
      businessProfile = {
        id: d.id,
        ownerId: d.ownerId,
        ownerName: d.ownerName,
        name: d.name,
        businessType: d.businessType,
        currency: d.currency,
        plan: d.plan === 'solo' ? 'solo' : 'free',
        createdAt: serializeTimestamp(d.createdAt),
        updatedAt: serializeTimestamp(d.updatedAt),
      };
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, bizPath);
  }

  return { userProfile, businessProfile };
}

export async function createOnboardingWorkspace(params: {
  uid: string;
  email: string;
  ownerName: string;
  businessName: string;
  businessType: string;
  currency: BusinessProfile['currency'];
  theme: 'light' | 'dark';
}): Promise<{ userProfile: UserProfile; businessProfile: BusinessProfile }> {
  const safeUid = sanitizeId(params.uid);
  const ownerName = clampString(params.ownerName, 120) || 'Owner';
  const businessName = clampString(params.businessName, 140) || 'My Studio';
  const businessType = clampString(params.businessType, 120) || 'Small Business';
  const email = clampString(params.email, 254) || 'owner@example.com';

  const userDocData = {
    uid: safeUid,
    name: ownerName,
    email,
    businessId: safeUid,
    onboardingCompleted: true,
    plan: 'free' as const,
    theme: params.theme,
    notificationsEnabled: true,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  const bizDocData = {
    id: safeUid,
    ownerId: safeUid,
    ownerName,
    name: businessName,
    businessType,
    currency: params.currency,
    plan: 'free' as const,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  try {
    const existingUser = await getDoc(doc(db, 'users', safeUid));
    if (existingUser.exists()) {
      await updateDoc(doc(db, 'users', safeUid), {
        name: ownerName,
        email,
        onboardingCompleted: true,
        theme: params.theme,
        notificationsEnabled: true,
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(doc(db, 'users', safeUid), userDocData);
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `users/${safeUid}`);
  }

  try {
    const existingBiz = await getDoc(doc(db, 'businesses', safeUid));
    if (existingBiz.exists()) {
      await updateDoc(doc(db, 'businesses', safeUid), {
        ownerName,
        name: businessName,
        businessType,
        currency: params.currency,
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(doc(db, 'businesses', safeUid), bizDocData);
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `businesses/${safeUid}`);
  }

  return {
    userProfile: {
      uid: safeUid,
      name: ownerName,
      email,
      businessId: safeUid,
      onboardingCompleted: true,
      plan: 'free',
      theme: params.theme,
      notificationsEnabled: true,
    },
    businessProfile: {
      id: safeUid,
      ownerId: safeUid,
      ownerName,
      name: businessName,
      businessType,
      currency: params.currency,
      plan: 'free',
    },
  };
}

export async function updateBusinessDoc(
  uid: string,
  updates: Partial<Pick<BusinessProfile, 'ownerName' | 'name' | 'businessType' | 'currency' | 'plan'>>
): Promise<void> {
  const safeUid = sanitizeId(uid);
  const payload: Record<string, unknown> = { updatedAt: serverTimestamp() };
  if (updates.ownerName !== undefined) payload.ownerName = clampString(updates.ownerName, 120) || 'Owner';
  if (updates.name !== undefined) payload.name = clampString(updates.name, 140) || 'My Studio';
  if (updates.businessType !== undefined) payload.businessType = clampString(updates.businessType, 120) || 'Small Business';
  if (updates.currency !== undefined) payload.currency = updates.currency;
  if (updates.plan !== undefined) payload.plan = updates.plan;

  try {
    await updateDoc(doc(db, 'businesses', safeUid), payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `businesses/${safeUid}`);
  }
}

export async function updateUserDoc(
  uid: string,
  updates: Partial<Pick<UserProfile, 'name' | 'theme' | 'notificationsEnabled' | 'plan'>>
): Promise<void> {
  const safeUid = sanitizeId(uid);
  const payload: Record<string, unknown> = { updatedAt: serverTimestamp() };
  if (updates.name !== undefined) payload.name = clampString(updates.name, 120) || 'Owner';
  if (updates.theme !== undefined) payload.theme = updates.theme;
  if (updates.notificationsEnabled !== undefined) payload.notificationsEnabled = Boolean(updates.notificationsEnabled);
  if (updates.plan !== undefined) payload.plan = updates.plan;

  try {
    await updateDoc(doc(db, 'users', safeUid), payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `users/${safeUid}`);
  }
}

export function subscribeWorkspaceCollections(
  uid: string,
  callbacks: {
    onCustomers: (items: Customer[]) => void;
    onOrders: (items: Order[]) => void;
    onPayments: (items: PaymentRecord[]) => void;
    onExpenses: (items: ExpenseRecord[]) => void;
    onTasks: (items: TaskItem[]) => void;
    onNotifications: (items: AppNotification[]) => void;
  }
): Unsubscribe {
  const safeUid = sanitizeId(uid);
  const unsubs: Unsubscribe[] = [];

  unsubs.push(
    onSnapshot(
      query(collection(db, 'customers'), where('ownerId', '==', safeUid)),
      (snap) => {
        const list: Customer[] = snap.docs.map((d) => {
          const data = d.data();
          return {
            id: data.id,
            ownerId: data.ownerId,
            businessId: data.businessId,
            name: data.name,
            email: data.email || '',
            phone: data.phone || '',
            instagram: data.instagram || '',
            facebook: data.facebook || '',
            address: data.address || '',
            notes: data.notes || '',
            lastInteractionAt: data.lastInteractionAt || '',
            createdAt: serializeTimestamp(data.createdAt),
            updatedAt: serializeTimestamp(data.updatedAt),
          };
        });
        callbacks.onCustomers(list.sort((a, b) => a.name.localeCompare(b.name)));
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'customers')
    )
  );

  unsubs.push(
    onSnapshot(
      query(collection(db, 'orders'), where('ownerId', '==', safeUid)),
      (snap) => {
        const list: Order[] = snap.docs.map((d) => {
          const data = d.data();
          return {
            id: data.id,
            orderNumber: data.orderNumber,
            ownerId: data.ownerId,
            businessId: data.businessId,
            customerId: data.customerId,
            customerName: data.customerName,
            product: data.product,
            description: data.description || '',
            quantity: Number(data.quantity) || 1,
            totalPrice: Number(data.totalPrice) || 0,
            depositRequired: Number(data.depositRequired) || 0,
            depositPaid: Boolean(data.depositPaid),
            amountPaid: Number(data.amountPaid) || 0,
            remainingBalance: Number(data.remainingBalance) || 0,
            orderDate: data.orderDate || '',
            dueDate: data.dueDate || '',
            deliveryMethod: data.deliveryMethod || 'Royal Mail / Post',
            trackingNumber: data.trackingNumber || '',
            status: data.status,
            archived: Boolean(data.archived),
            customerNotes: data.customerNotes || '',
            internalNotes: data.internalNotes || '',
            createdAt: serializeTimestamp(data.createdAt),
            updatedAt: serializeTimestamp(data.updatedAt),
          };
        });
        callbacks.onOrders(list.sort((a, b) => b.orderDate.localeCompare(a.orderDate)));
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'orders')
    )
  );

  unsubs.push(
    onSnapshot(
      query(collection(db, 'payments'), where('ownerId', '==', safeUid)),
      (snap) => {
        const list: PaymentRecord[] = snap.docs.map((d) => {
          const data = d.data();
          return {
            id: data.id,
            ownerId: data.ownerId,
            businessId: data.businessId,
            orderId: data.orderId,
            customerId: data.customerId,
            customerName: data.customerName,
            amount: Number(data.amount) || 0,
            date: data.date || '',
            method: data.method,
            notes: data.notes || '',
            createdAt: serializeTimestamp(data.createdAt),
            updatedAt: serializeTimestamp(data.updatedAt),
          };
        });
        callbacks.onPayments(list.sort((a, b) => b.date.localeCompare(a.date)));
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'payments')
    )
  );

  unsubs.push(
    onSnapshot(
      query(collection(db, 'expenses'), where('ownerId', '==', safeUid)),
      (snap) => {
        const list: ExpenseRecord[] = snap.docs.map((d) => {
          const data = d.data();
          return {
            id: data.id,
            ownerId: data.ownerId,
            businessId: data.businessId,
            description: data.description,
            category: data.category,
            amount: Number(data.amount) || 0,
            date: data.date || '',
            notes: data.notes || '',
            createdAt: serializeTimestamp(data.createdAt),
            updatedAt: serializeTimestamp(data.updatedAt),
          };
        });
        callbacks.onExpenses(list.sort((a, b) => b.date.localeCompare(a.date)));
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'expenses')
    )
  );

  unsubs.push(
    onSnapshot(
      query(collection(db, 'tasks'), where('ownerId', '==', safeUid)),
      (snap) => {
        const list: TaskItem[] = snap.docs.map((d) => {
          const data = d.data();
          return {
            id: data.id,
            ownerId: data.ownerId,
            businessId: data.businessId,
            title: data.title,
            customerId: data.customerId || '',
            customerName: data.customerName || '',
            orderId: data.orderId || '',
            orderNumber: data.orderNumber || '',
            dueDate: data.dueDate || '',
            priority: data.priority || 'Medium',
            completed: Boolean(data.completed),
            autoGenerated: Boolean(data.autoGenerated),
            createdAt: serializeTimestamp(data.createdAt),
            updatedAt: serializeTimestamp(data.updatedAt),
          };
        });
        callbacks.onTasks(list.sort((a, b) => a.dueDate.localeCompare(b.dueDate)));
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'tasks')
    )
  );

  unsubs.push(
    onSnapshot(
      query(collection(db, 'notifications'), where('ownerId', '==', safeUid)),
      (snap) => {
        const list: AppNotification[] = snap.docs.map((d) => {
          const data = d.data();
          return {
            id: data.id,
            ownerId: data.ownerId,
            businessId: data.businessId,
            type: data.type,
            title: data.title,
            message: data.message,
            relatedOrderId: data.relatedOrderId || '',
            relatedCustomerId: data.relatedCustomerId || '',
            read: Boolean(data.read),
            createdAt: serializeTimestamp(data.createdAt),
            updatedAt: serializeTimestamp(data.updatedAt),
          };
        });
        callbacks.onNotifications(list);
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'notifications')
    )
  );

  return () => {
    unsubs.forEach((u) => u());
  };
}

// Strict schema-aligned CRUD helpers
export async function saveCustomerFirestore(customer: Customer, isNew: boolean): Promise<void> {
  const id = sanitizeId(customer.id);
  const base = {
    name: clampString(customer.name, 140) || 'Customer',
    email: clampString(customer.email, 254),
    phone: clampString(customer.phone, 50),
    instagram: clampString(customer.instagram, 80),
    facebook: clampString(customer.facebook, 120),
    address: clampString(customer.address, 400),
    notes: clampString(customer.notes, 2000),
    lastInteractionAt: clampString(customer.lastInteractionAt, 40),
    updatedAt: serverTimestamp(),
  };

  try {
    if (isNew) {
      await setDoc(doc(db, 'customers', id), {
        id,
        ownerId: sanitizeId(customer.ownerId),
        businessId: sanitizeId(customer.businessId),
        ...base,
        createdAt: serverTimestamp(),
      });
    } else {
      await updateDoc(doc(db, 'customers', id), base);
    }
  } catch (error) {
    handleFirestoreError(error, isNew ? OperationType.CREATE : OperationType.UPDATE, `customers/${id}`);
  }
}

export async function deleteCustomerFirestore(id: string): Promise<void> {
  const safeId = sanitizeId(id);
  try {
    await deleteDoc(doc(db, 'customers', safeId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `customers/${safeId}`);
  }
}

export async function saveOrderFirestore(order: Order, isNew: boolean): Promise<void> {
  const id = sanitizeId(order.id);
  const total = Math.max(0, Math.min(1000000, roundMoney(order.totalPrice)));
  const paid = Math.max(0, Math.min(total || 1000000, roundMoney(order.amountPaid)));
  const depReq = Math.max(0, Math.min(total, roundMoney(order.depositRequired)));
  const rem = Math.max(0, roundMoney(total - paid));

  const mutableFields = {
    customerId: sanitizeId(order.customerId),
    customerName: clampString(order.customerName, 140) || 'Customer',
    product: clampString(order.product, 200) || 'Order',
    description: clampString(order.description, 2000),
    quantity: Math.max(1, Math.min(10000, Math.round(order.quantity || 1))),
    totalPrice: total,
    depositRequired: depReq,
    depositPaid: Boolean(order.depositPaid),
    amountPaid: paid,
    remainingBalance: rem,
    orderDate: clampString(order.orderDate, 32) || new Date().toISOString().slice(0, 10),
    dueDate: clampString(order.dueDate, 32),
    deliveryMethod: clampString(order.deliveryMethod, 60),
    trackingNumber: clampString(order.trackingNumber, 100),
    status: order.status,
    archived: Boolean(order.archived),
    customerNotes: clampString(order.customerNotes, 2000),
    internalNotes: clampString(order.internalNotes, 2000),
    updatedAt: serverTimestamp(),
  };

  try {
    if (isNew) {
      await setDoc(doc(db, 'orders', id), {
        id,
        orderNumber: clampString(order.orderNumber, 32) || 'SD-1001',
        ownerId: sanitizeId(order.ownerId),
        businessId: sanitizeId(order.businessId),
        ...mutableFields,
        createdAt: serverTimestamp(),
      });
    } else {
      await updateDoc(doc(db, 'orders', id), mutableFields);
    }
  } catch (error) {
    handleFirestoreError(error, isNew ? OperationType.CREATE : OperationType.UPDATE, `orders/${id}`);
  }
}

export async function deleteOrderFirestore(id: string): Promise<void> {
  const safeId = sanitizeId(id);
  try {
    await deleteDoc(doc(db, 'orders', safeId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `orders/${safeId}`);
  }
}

export async function createPaymentFirestore(payment: PaymentRecord): Promise<void> {
  const id = sanitizeId(payment.id);
  try {
    await setDoc(doc(db, 'payments', id), {
      id,
      ownerId: sanitizeId(payment.ownerId),
      businessId: sanitizeId(payment.businessId),
      orderId: sanitizeId(payment.orderId),
      customerId: sanitizeId(payment.customerId),
      customerName: clampString(payment.customerName, 140) || 'Customer',
      amount: Math.max(0.01, Math.min(1000000, roundMoney(payment.amount))),
      date: clampString(payment.date, 32) || new Date().toISOString().slice(0, 10),
      method: payment.method,
      notes: clampString(payment.notes, 500),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `payments/${id}`);
  }
}

export async function createExpenseFirestore(expense: ExpenseRecord): Promise<void> {
  const id = sanitizeId(expense.id);
  try {
    await setDoc(doc(db, 'expenses', id), {
      id,
      ownerId: sanitizeId(expense.ownerId),
      businessId: sanitizeId(expense.businessId),
      description: clampString(expense.description, 200) || 'Expense',
      category: expense.category,
      amount: Math.max(0.01, Math.min(1000000, roundMoney(expense.amount))),
      date: clampString(expense.date, 32) || new Date().toISOString().slice(0, 10),
      notes: clampString(expense.notes, 1000),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `expenses/${id}`);
  }
}

export async function deleteExpenseFirestore(id: string): Promise<void> {
  const safeId = sanitizeId(id);
  try {
    await deleteDoc(doc(db, 'expenses', safeId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `expenses/${safeId}`);
  }
}

export async function saveTaskFirestore(task: TaskItem, isNew: boolean): Promise<void> {
  const id = sanitizeId(task.id);
  const mutable = {
    title: clampString(task.title, 240) || 'Task',
    customerId: task.customerId ? sanitizeId(task.customerId) : '',
    customerName: clampString(task.customerName, 140),
    orderId: task.orderId ? sanitizeId(task.orderId) : '',
    orderNumber: clampString(task.orderNumber, 32),
    dueDate: clampString(task.dueDate, 32),
    priority: task.priority,
    completed: Boolean(task.completed),
    updatedAt: serverTimestamp(),
  };

  try {
    if (isNew) {
      await setDoc(doc(db, 'tasks', id), {
        id,
        ownerId: sanitizeId(task.ownerId),
        businessId: sanitizeId(task.businessId),
        ...mutable,
        autoGenerated: Boolean(task.autoGenerated),
        createdAt: serverTimestamp(),
      });
    } else {
      await updateDoc(doc(db, 'tasks', id), mutable);
    }
  } catch (error) {
    handleFirestoreError(error, isNew ? OperationType.CREATE : OperationType.UPDATE, `tasks/${id}`);
  }
}

export async function toggleTaskFirestore(id: string, completed: boolean): Promise<void> {
  const safeId = sanitizeId(id);
  try {
    await updateDoc(doc(db, 'tasks', safeId), {
      completed: Boolean(completed),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `tasks/${safeId}`);
  }
}

export async function deleteTaskFirestore(id: string): Promise<void> {
  const safeId = sanitizeId(id);
  try {
    await deleteDoc(doc(db, 'tasks', safeId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `tasks/${safeId}`);
  }
}

export async function markNotificationReadFirestore(
  notif: AppNotification,
  existsInDb: boolean
): Promise<void> {
  const safeId = sanitizeId(notif.id);
  try {
    if (existsInDb) {
      await updateDoc(doc(db, 'notifications', safeId), {
        read: true,
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(doc(db, 'notifications', safeId), {
        id: safeId,
        ownerId: sanitizeId(notif.ownerId),
        businessId: sanitizeId(notif.businessId),
        type: notif.type,
        title: clampString(notif.title, 160) || 'Alert',
        message: clampString(notif.message, 500) || 'Notification',
        relatedOrderId: notif.relatedOrderId ? sanitizeId(notif.relatedOrderId) : '',
        relatedCustomerId: notif.relatedCustomerId ? sanitizeId(notif.relatedCustomerId) : '',
        read: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, existsInDb ? OperationType.UPDATE : OperationType.CREATE, `notifications/${safeId}`);
  }
}
