import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { onAuthStateChanged, reload, sendEmailVerification, signOut, User } from 'firebase/auth';
import { auth } from '../firebase';
import {
  AppNotification,
  BusinessProfile,
  CurrencyCode,
  Customer,
  ExpenseRecord,
  MessagePresetType,
  NavSection,
  Order,
  OrderStatus,
  PaymentMethod,
  PaymentRecord,
  PlanTier,
  TaskItem,
  UserProfile,
} from '../types';
import {
  buildNotifications,
  calculateOrderBalance,
  clampString,
  createEntityId,
  formatCurrency,
  generateTasksForOrder,
  getTodayIso,
  roundMoney,
} from '../utils/businessLogic';
import { createLunaDemoSeed, WorkspaceSeed } from '../data/demoData';
import {
  createExpenseFirestore,
  createOnboardingWorkspace,
  createOrderAtomicFirestore,
  createPaymentFirestore,
  deleteCustomerFirestore,
  deleteExpenseFirestore,
  deleteOrderFirestore,
  deleteTaskFirestore,
  fetchUserAndBusiness,
  markNotificationReadFirestore,
  recordPaymentAtomicFirestore,
  saveCustomerFirestore,
  saveOrderFirestore,
  saveTaskFirestore,
  subscribeWorkspaceCollections,
  toggleTaskFirestore,
  updateBusinessDoc,
  updateUserDoc,
} from '../services/firestoreService';

const DEMO_STORAGE_KEY = 'solodesk_demo_workspace_v1';
const THEME_STORAGE_KEY = 'solodesk_theme_v1';

export type AppScreenMode = 'landing' | 'auth' | 'onboarding' | 'verify_email' | 'app';

export interface OrderModalState {
  open: boolean;
  initialTab: 'manual' | 'ai';
  editingOrder?: Order | null;
}

export interface MessageModalState {
  open: boolean;
  customerName: string;
  order?: Order | null;
  defaultPreset?: MessagePresetType;
}

export interface ToastMessage {
  id: string;
  text: string;
  tone: 'success' | 'info' | 'error';
}

interface AppContextValue {
  screenMode: AppScreenMode;
  authModeInitial: 'login' | 'signup';
  isDemoMode: boolean;
  loadingAuth: boolean;
  firebaseUser: User | null;
  userProfile: UserProfile | null;
  business: BusinessProfile;
  customers: Customer[];
  orders: Order[];
  payments: PaymentRecord[];
  expenses: ExpenseRecord[];
  tasks: TaskItem[];
  notifications: AppNotification[];
  unreadNotificationCount: number;
  todayIso: string;
  theme: 'light' | 'dark';
  activeSection: NavSection;
  selectedOrderId: string | null;
  selectedCustomerId: string | null;
  ordersStatusFilter: OrderStatus | 'All' | 'Archived';
  orderModal: OrderModalState;
  messageModal: MessageModalState;
  searchOpen: boolean;
  toasts: ToastMessage[];

  // Navigation & UI
  openAuthScreen: (initial?: 'login' | 'signup') => void;
  backToLanding: () => void;
  enterDemoMode: () => void;
  setActiveSection: (sec: NavSection) => void;
  setSelectedOrderId: (id: string | null) => void;
  setSelectedCustomerId: (id: string | null) => void;
  setOrdersStatusFilter: (f: OrderStatus | 'All' | 'Archived') => void;
  openOrderModal: (tab?: 'manual' | 'ai', editingOrder?: Order | null) => void;
  closeOrderModal: () => void;
  openMessageModal: (params: { customerName: string; order?: Order | null; defaultPreset?: MessagePresetType }) => void;
  closeMessageModal: () => void;
  setSearchOpen: (open: boolean) => void;
  toggleTheme: () => void;
  setThemePreference: (t: 'light' | 'dark') => void;
  showToast: (text: string, tone?: 'success' | 'info' | 'error') => void;

  // Auth & Onboarding
  refreshVerificationStatus: () => Promise<void>;
  resendVerificationEmail: () => Promise<void>;
  logout: () => Promise<void>;
  completeOnboarding: (params: {
    ownerName: string;
    businessName: string;
    businessType: string;
    currency: CurrencyCode;
    loadSampleData: boolean;
  }) => Promise<void>;

  // Data Mutations
  saveOrder: (
    draft: Omit<
      Order,
      | 'id'
      | 'orderNumber'
      | 'ownerId'
      | 'businessId'
      | 'remainingBalance'
      | 'depositPaid'
    > & { id?: string; orderNumber?: string },
    options?: { autoCreateTasks?: boolean; customTasks?: string[] }
  ) => Promise<Order>;
  updateOrderStatus: (orderId: string, status: OrderStatus) => Promise<void>;
  archiveOrder: (orderId: string, archived: boolean) => Promise<void>;
  duplicateOrder: (orderId: string) => Promise<Order | null>;
  deleteOrder: (orderId: string) => Promise<void>;
  recordPayment: (
    orderId: string,
    params: { amount: number; date: string; method: PaymentMethod; notes: string }
  ) => Promise<void>;

  saveCustomer: (
    draft: Omit<Customer, 'id' | 'ownerId' | 'businessId' | 'lastInteractionAt'> & {
      id?: string;
      lastInteractionAt?: string;
    }
  ) => Promise<Customer>;
  deleteCustomer: (customerId: string) => Promise<void>;

  saveTask: (
    draft: Omit<TaskItem, 'id' | 'ownerId' | 'businessId'> & { id?: string }
  ) => Promise<void>;
  toggleTask: (taskId: string) => Promise<void>;
  deleteTask: (taskId: string) => Promise<void>;

  addExpense: (
    draft: Omit<ExpenseRecord, 'id' | 'ownerId' | 'businessId'>
  ) => Promise<void>;
  deleteExpense: (expenseId: string) => Promise<void>;

  markNotificationRead: (notifId: string) => Promise<void>;
  markAllNotificationsRead: () => Promise<void>;

  updateSettings: (params: {
    ownerName?: string;
    businessName?: string;
    businessType?: string;
    currency?: CurrencyCode;
    plan?: PlanTier;
    notificationsEnabled?: boolean;
  }) => Promise<void>;
  seedSampleData: () => Promise<void>;
  resetDemoData: () => void;
}

const AppContext = createContext<AppContextValue | null>(null);

function loadOrCreateDemoWorkspace(todayIso: string): WorkspaceSeed {
  try {
    const raw = localStorage.getItem(DEMO_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as WorkspaceSeed;
      if (parsed?.business && Array.isArray(parsed.orders)) {
        return parsed;
      }
    }
  } catch {
    // ignore corrupt storage
  }
  const fresh = createLunaDemoSeed('demo_luna_owner', todayIso);
  try {
    localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(fresh));
  } catch {
    // ignore quota
  }
  return fresh;
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const todayIso = useMemo(() => getTodayIso(), []);

  const initialUrlParams = useMemo(() => {
    if (typeof window === 'undefined') return { autostart: false };
    const sp = new URLSearchParams(window.location.search);
    return {
      autostart: sp.get('autostart') === '1' || sp.get('demo') === '1',
    };
  }, []);

  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    try {
      const saved = localStorage.getItem(THEME_STORAGE_KEY);
      if (saved === 'dark' || saved === 'light') return saved;
    } catch {
      // ignore
    }
    return 'light';
  });

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      // ignore
    }
  }, [theme]);

  const initialSeed = useMemo(() => loadOrCreateDemoWorkspace(todayIso), [todayIso]);

  const [screenMode, setScreenMode] = useState<AppScreenMode>(() =>
    initialUrlParams.autostart ? 'app' : 'landing'
  );
  const [authModeInitial, setAuthModeInitial] = useState<'login' | 'signup'>('signup');
  const [isDemoMode, setIsDemoMode] = useState<boolean>(() => initialUrlParams.autostart);
  const isDemoModeRef = useRef<boolean>(isDemoMode);
  useEffect(() => {
    isDemoModeRef.current = isDemoMode;
  }, [isDemoMode]);
  const unsubCollectionsRef = useRef<(() => void) | null>(null);
  const [loadingAuth, setLoadingAuth] = useState<boolean>(() => !initialUrlParams.autostart);
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);

  const [userProfile, setUserProfile] = useState<UserProfile | null>(
    initialUrlParams.autostart ? initialSeed.user : null
  );
  const [business, setBusiness] = useState<BusinessProfile>(initialSeed.business);
  const [customers, setCustomers] = useState<Customer[]>(initialSeed.customers);
  const [orders, setOrders] = useState<Order[]>(initialSeed.orders);
  const [payments, setPayments] = useState<PaymentRecord[]>(initialSeed.payments);
  const [expenses, setExpenses] = useState<ExpenseRecord[]>(initialSeed.expenses);
  const [tasks, setTasks] = useState<TaskItem[]>(initialSeed.tasks);
  const [storedNotifications, setStoredNotifications] = useState<AppNotification[]>(
    initialSeed.notifications
  );

  const [activeSection, setActiveSection] = useState<NavSection>('dashboard');
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [ordersStatusFilter, setOrdersStatusFilter] = useState<OrderStatus | 'All' | 'Archived'>('All');
  const [orderModal, setOrderModal] = useState<OrderModalState>({
    open: false,
    initialTab: 'manual',
    editingOrder: null,
  });
  const [messageModal, setMessageModal] = useState<MessageModalState>({
    open: false,
    customerName: '',
    order: null,
    defaultPreset: 'payment_reminder',
  });
  const [searchOpen, setSearchOpen] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const showToast = useCallback((text: string, tone: 'success' | 'info' | 'error' = 'success') => {
    const id = createEntityId('toast');
    setToasts((prev) => [...prev.slice(-2), { id, text, tone }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3500);
  }, []);

  // Persist demo workspace whenever demo data changes
  useEffect(() => {
    if (!isDemoMode) return;
    const payload: WorkspaceSeed = {
      user: userProfile || initialSeed.user,
      business,
      customers,
      orders,
      payments,
      expenses,
      tasks,
      notifications: storedNotifications,
    };
    try {
      localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // ignore
    }
  }, [
    isDemoMode,
    userProfile,
    business,
    customers,
    orders,
    payments,
    expenses,
    tasks,
    storedNotifications,
    initialSeed.user,
  ]);

  // Global Cmd/Ctrl + K search shortcut
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        if (screenMode === 'app') {
          e.preventDefault();
          setSearchOpen((prev) => !prev);
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [screenMode]);

  // Firebase Auth listener
  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, async (u) => {
      if (unsubCollectionsRef.current) {
        unsubCollectionsRef.current();
        unsubCollectionsRef.current = null;
      }

      setFirebaseUser(u);

      if (!u) {
        setLoadingAuth(false);
        if (!isDemoModeRef.current) {
          setScreenMode((prev) => (prev === 'auth' ? 'auth' : 'landing'));
        }
        return;
      }

      setIsDemoMode(false);

      if (!u.emailVerified) {
        setLoadingAuth(false);
        setScreenMode('verify_email');
        return;
      }

      setLoadingAuth(true);
      try {
        const { userProfile: up, businessProfile: bp } = await fetchUserAndBusiness(u.uid);
        if (!up || !bp || !up.onboardingCompleted) {
          setCustomers([]);
          setOrders([]);
          setPayments([]);
          setExpenses([]);
          setTasks([]);
          setStoredNotifications([]);
          setScreenMode('onboarding');
          setLoadingAuth(false);
          return;
        }

        setUserProfile(up);
        setBusiness(bp);
        if (up.theme) {
          setTheme(up.theme);
        }
        setScreenMode('app');

        unsubCollectionsRef.current = subscribeWorkspaceCollections(u.uid, {
          onCustomers: setCustomers,
          onOrders: setOrders,
          onPayments: setPayments,
          onExpenses: setExpenses,
          onTasks: setTasks,
          onNotifications: setStoredNotifications,
        });
      } catch (err) {
        console.error(err);
        showToast('Unable to load workspace from Firestore.', 'error');
      } finally {
        setLoadingAuth(false);
      }
    });

    return () => {
      unsubAuth();
      if (unsubCollectionsRef.current) {
        unsubCollectionsRef.current();
        unsubCollectionsRef.current = null;
      }
    };
  }, [showToast]);

  const notifications = useMemo(() => {
    if (userProfile && !userProfile.notificationsEnabled) return [];
    const readMap: Record<string, boolean> = {};
    for (const n of storedNotifications) {
      if (n.read) readMap[n.id] = true;
    }
    return buildNotifications(
      orders,
      tasks,
      readMap,
      business.ownerId,
      business.id,
      business.currency,
      todayIso
    );
  }, [orders, tasks, storedNotifications, business, userProfile, todayIso]);

  const unreadNotificationCount = useMemo(
    () => notifications.filter((n) => !n.read).length,
    [notifications]
  );

  const openAuthScreen = useCallback((initial: 'login' | 'signup' = 'signup') => {
    setAuthModeInitial(initial);
    setScreenMode('auth');
  }, []);

  const backToLanding = useCallback(() => {
    setIsDemoMode(false);
    setScreenMode('landing');
  }, []);

  const enterDemoMode = useCallback(() => {
    const demo = loadOrCreateDemoWorkspace(todayIso);
    setIsDemoMode(true);
    setUserProfile(demo.user);
    setBusiness(demo.business);
    setCustomers(demo.customers);
    setOrders(demo.orders);
    setPayments(demo.payments);
    setExpenses(demo.expenses);
    setTasks(demo.tasks);
    setStoredNotifications(demo.notifications);
    setActiveSection('dashboard');
    setScreenMode('app');
    showToast('Viewing Luna Creative Studio interactive demo workspace.', 'info');
  }, [todayIso, showToast]);

  const refreshVerificationStatus = useCallback(async () => {
    if (!auth.currentUser) return;
    await reload(auth.currentUser);
    if (auth.currentUser.emailVerified) {
      const uid = auth.currentUser.uid;
      setFirebaseUser({ ...auth.currentUser } as User);
      const { userProfile: up, businessProfile: bp } = await fetchUserAndBusiness(uid);
      if (!up || !bp || !up.onboardingCompleted) {
        setScreenMode('onboarding');
      } else {
        setUserProfile(up);
        setBusiness(bp);
        setScreenMode('app');
        if (unsubCollectionsRef.current) {
          unsubCollectionsRef.current();
        }
        unsubCollectionsRef.current = subscribeWorkspaceCollections(uid, {
          onCustomers: setCustomers,
          onOrders: setOrders,
          onPayments: setPayments,
          onExpenses: setExpenses,
          onTasks: setTasks,
          onNotifications: setStoredNotifications,
        });
      }
    } else {
      showToast('Email is not marked verified yet — please click the link in your inbox.', 'info');
    }
  }, [showToast]);

  const resendVerificationEmail = useCallback(async () => {
    if (!auth.currentUser) return;
    await sendEmailVerification(auth.currentUser);
    showToast('Verification link sent to your email.', 'success');
  }, [showToast]);

  const logout = useCallback(async () => {
    if (unsubCollectionsRef.current) {
      unsubCollectionsRef.current();
      unsubCollectionsRef.current = null;
    }
    if (isDemoMode) {
      setIsDemoMode(false);
      setScreenMode('landing');
      setSelectedOrderId(null);
      setSelectedCustomerId(null);
      return;
    }
    await signOut(auth);
    setUserProfile(null);
    setSelectedOrderId(null);
    setSelectedCustomerId(null);
    setScreenMode('landing');
  }, [isDemoMode]);

  const seedSampleData = useCallback(async () => {
    const uid = isDemoMode ? 'demo_luna_owner' : firebaseUser?.uid;
    if (!uid) return;
    const sample = createLunaDemoSeed(uid, todayIso);

    if (isDemoMode) {
      setCustomers(sample.customers);
      setOrders(sample.orders);
      setPayments(sample.payments);
      setExpenses(sample.expenses);
      setTasks(sample.tasks);
      setStoredNotifications(sample.notifications);
      showToast('Sample studio orders loaded.', 'success');
      return;
    }

    const existingCustIds = new Set(customers.map((x) => x.id));
    const existingOrderIds = new Set(orders.map((x) => x.id));
    const existingPayIds = new Set(payments.map((x) => x.id));
    const existingExpIds = new Set(expenses.map((x) => x.id));
    const existingTaskIds = new Set(tasks.map((x) => x.id));

    for (const c of sample.customers) {
      await saveCustomerFirestore(c, !existingCustIds.has(c.id));
    }
    for (const o of sample.orders) {
      await saveOrderFirestore(o, !existingOrderIds.has(o.id));
    }
    for (const p of sample.payments) {
      if (!existingPayIds.has(p.id)) {
        await createPaymentFirestore(p);
      }
    }
    for (const e of sample.expenses) {
      if (!existingExpIds.has(e.id)) {
        await createExpenseFirestore(e);
      }
    }
    for (const t of sample.tasks) {
      await saveTaskFirestore(t, !existingTaskIds.has(t.id));
    }
    showToast('Sample orders and customers added to your workspace.', 'success');
  }, [isDemoMode, firebaseUser, todayIso, customers, orders, payments, expenses, tasks, showToast]);

  const completeOnboarding = useCallback(
    async (params: {
      ownerName: string;
      businessName: string;
      businessType: string;
      currency: CurrencyCode;
      loadSampleData: boolean;
    }) => {
      if (!firebaseUser) return;
      const { userProfile: up, businessProfile: bp } = await createOnboardingWorkspace({
        uid: firebaseUser.uid,
        email: firebaseUser.email || 'owner@example.com',
        ownerName: params.ownerName,
        businessName: params.businessName,
        businessType: params.businessType,
        currency: params.currency,
        theme,
      });

      setUserProfile(up);
      setBusiness(bp);
      setScreenMode('app');
      setActiveSection('dashboard');

      if (unsubCollectionsRef.current) {
        unsubCollectionsRef.current();
      }
      unsubCollectionsRef.current = subscribeWorkspaceCollections(firebaseUser.uid, {
        onCustomers: setCustomers,
        onOrders: setOrders,
        onPayments: setPayments,
        onExpenses: setExpenses,
        onTasks: setTasks,
        onNotifications: setStoredNotifications,
      });

      if (params.loadSampleData) {
        const sample = createLunaDemoSeed(firebaseUser.uid, todayIso);
        for (const c of sample.customers) await saveCustomerFirestore(c, true);
        for (const o of sample.orders) await saveOrderFirestore(o, true);
        for (const p of sample.payments) await createPaymentFirestore(p);
        for (const e of sample.expenses) await createExpenseFirestore(e);
        for (const t of sample.tasks) await saveTaskFirestore(t, true);
      }
      showToast(`Welcome to SoloDesk, ${params.ownerName.split(' ')[0]}!`, 'success');
    },
    [firebaseUser, theme, todayIso, showToast]
  );

  const toggleTheme = useCallback(() => {
    setTheme((prev) => {
      const next = prev === 'light' ? 'dark' : 'light';
      if (!isDemoMode && firebaseUser?.emailVerified && userProfile) {
        void updateUserDoc(firebaseUser.uid, { theme: next });
      }
      return next;
    });
  }, [isDemoMode, firebaseUser, userProfile]);

  const setThemePreference = useCallback(
    (next: 'light' | 'dark') => {
      setTheme(next);
      if (!isDemoMode && firebaseUser?.emailVerified && userProfile) {
        void updateUserDoc(firebaseUser.uid, { theme: next });
      }
    },
    [isDemoMode, firebaseUser, userProfile]
  );

  const openOrderModal = useCallback(
    (initialTab: 'manual' | 'ai' = 'manual', editingOrder: Order | null = null) => {
      setOrderModal({ open: true, initialTab, editingOrder });
    },
    []
  );

  const closeOrderModal = useCallback(() => {
    setOrderModal((prev) => ({ ...prev, open: false, editingOrder: null }));
  }, []);

  const openMessageModal = useCallback(
    (params: { customerName: string; order?: Order | null; defaultPreset?: MessagePresetType }) => {
      setMessageModal({
        open: true,
        customerName: params.customerName,
        order: params.order || null,
        defaultPreset: params.defaultPreset || 'payment_reminder',
      });
    },
    []
  );

  const closeMessageModal = useCallback(() => {
    setMessageModal((prev) => ({ ...prev, open: false }));
  }, []);

  // Save Customer
  const saveCustomer = useCallback(
    async (
      draft: Omit<Customer, 'id' | 'ownerId' | 'businessId' | 'lastInteractionAt'> & {
        id?: string;
        lastInteractionAt?: string;
      }
    ): Promise<Customer> => {
      const isNew = !draft.id;
      const ownerId = business.ownerId;
      const businessId = business.id;
      const customerObj: Customer = {
        id: draft.id || createEntityId('cust'),
        ownerId,
        businessId,
        name: clampString(draft.name, 140) || 'Customer',
        email: clampString(draft.email, 254),
        phone: clampString(draft.phone, 50),
        instagram: clampString(draft.instagram, 80),
        facebook: clampString(draft.facebook, 120),
        address: clampString(draft.address, 400),
        notes: clampString(draft.notes, 2000),
        lastInteractionAt: draft.lastInteractionAt || todayIso,
      };

      if (isDemoMode) {
        setCustomers((prev) =>
          isNew
            ? [...prev, customerObj].sort((a, b) => a.name.localeCompare(b.name))
            : prev.map((c) => (c.id === customerObj.id ? customerObj : c))
        );
      } else {
        await saveCustomerFirestore(customerObj, isNew);
      }
      showToast(isNew ? `Added ${customerObj.name}.` : `Updated ${customerObj.name}.`, 'success');
      return customerObj;
    },
    [business, isDemoMode, todayIso, showToast]
  );

  const deleteCustomer = useCallback(
    async (customerId: string) => {
      if (isDemoMode) {
        setCustomers((prev) => prev.filter((c) => c.id !== customerId));
      } else {
        await deleteCustomerFirestore(customerId);
      }
      if (selectedCustomerId === customerId) setSelectedCustomerId(null);
      showToast('Customer deleted.', 'info');
    },
    [isDemoMode, selectedCustomerId, showToast]
  );

  // Save Order
  const saveOrder = useCallback(
    async (
      draft: Omit<
        Order,
        | 'id'
        | 'orderNumber'
        | 'ownerId'
        | 'businessId'
        | 'remainingBalance'
        | 'depositPaid'
      > & { id?: string; orderNumber?: string },
      options?: { autoCreateTasks?: boolean; customTasks?: string[] }
    ): Promise<Order> => {
      const isNew = !draft.id;
      const ownerId = business.ownerId;
      const businessId = business.id;

      const trimmedCustName = clampString(draft.customerName, 140);
      const trimmedProduct = clampString(draft.product, 200);
      if (!trimmedCustName || !trimmedProduct) {
        throw new Error('Please enter both a customer name and product or service.');
      }

      const rawTotal = roundMoney(draft.totalPrice);
      const rawPaid = roundMoney(draft.amountPaid);
      if (rawTotal < 0 || rawPaid < 0) {
        throw new Error('Order amounts cannot be negative.');
      }
      if (rawPaid > rawTotal + 0.005) {
        throw new Error('Amount paid cannot exceed the total order price.');
      }

      // Ensure customer exists or create new customer atomically
      let customerId = draft.customerId;
      let newCustomerObj: Customer | null = null;
      const existingCust = customers.find(
        (c) =>
          (customerId && c.id === customerId) ||
          c.name.toLowerCase() === trimmedCustName.toLowerCase()
      );

      if (existingCust) {
        customerId = existingCust.id;
      } else if (isNew) {
        customerId = createEntityId('cust');
        newCustomerObj = {
          id: customerId,
          ownerId,
          businessId,
          name: trimmedCustName,
          email: '',
          phone: '',
          instagram: '',
          facebook: '',
          address: '',
          notes: 'Created automatically from order.',
          lastInteractionAt: todayIso,
        };
      } else {
        const createdCust = await saveCustomer({
          name: trimmedCustName,
          email: '',
          phone: '',
          instagram: '',
          facebook: '',
          address: '',
          notes: 'Created automatically from order.',
        });
        customerId = createdCust.id;
      }

      const bal = calculateOrderBalance(
        draft.totalPrice,
        draft.amountPaid,
        draft.depositRequired
      );

      const nextNum = 1041 + orders.length + Math.floor(Math.random() * 6 + 1);
      const orderObj: Order = {
        id: draft.id || createEntityId('ord'),
        orderNumber: draft.orderNumber || `SD-${nextNum}`,
        ownerId,
        businessId,
        customerId,
        customerName: trimmedCustName,
        product: trimmedProduct,
        description: clampString(draft.description, 2000),
        quantity: Math.max(1, Math.round(draft.quantity || 1)),
        totalPrice: bal.totalPrice,
        depositRequired: bal.depositRequired,
        depositPaid: bal.depositPaid,
        amountPaid: bal.amountPaid,
        remainingBalance: bal.remainingBalance,
        orderDate: draft.orderDate || todayIso,
        dueDate: draft.dueDate || '',
        deliveryMethod: clampString(draft.deliveryMethod, 60) || 'Royal Mail / Post',
        trackingNumber: clampString(draft.trackingNumber, 100),
        status: draft.status,
        archived: Boolean(draft.archived),
        customerNotes: clampString(draft.customerNotes, 2000),
        internalNotes: clampString(draft.internalNotes, 2000),
      };

      const initialPay: PaymentRecord | null =
        isNew && orderObj.amountPaid > 0
          ? {
              id: createEntityId('pay'),
              ownerId,
              businessId,
              orderId: orderObj.id,
              customerId: orderObj.customerId,
              customerName: orderObj.customerName,
              amount: orderObj.amountPaid,
              date: orderObj.orderDate,
              method: 'Bank transfer',
              notes:
                orderObj.remainingBalance === 0
                  ? 'Paid in full on order creation'
                  : 'Initial deposit paid',
            }
          : null;

      const generatedTasks: TaskItem[] =
        isNew && options?.autoCreateTasks !== false
          ? options?.customTasks && options.customTasks.length > 0
            ? options.customTasks.map((title) => ({
                id: createEntityId('tsk'),
                ownerId,
                businessId,
                title: clampString(title, 240),
                customerId: orderObj.customerId,
                customerName: orderObj.customerName,
                orderId: orderObj.id,
                orderNumber: orderObj.orderNumber,
                dueDate: orderObj.dueDate || todayIso,
                priority: 'Medium' as const,
                completed: false,
                autoGenerated: true,
              }))
            : generateTasksForOrder(orderObj, ownerId, businessId, todayIso)
          : [];

      if (isDemoMode) {
        if (newCustomerObj) {
          setCustomers((prev) =>
            [...prev, newCustomerObj!].sort((a, b) => a.name.localeCompare(b.name))
          );
        }
        setOrders((prev) =>
          isNew ? [orderObj, ...prev] : prev.map((o) => (o.id === orderObj.id ? orderObj : o))
        );
        if (initialPay) {
          setPayments((prev) => [initialPay, ...prev]);
        }
        if (generatedTasks.length > 0) {
          setTasks((prev) => [...generatedTasks, ...prev]);
        }
      } else if (isNew) {
        await createOrderAtomicFirestore({
          order: orderObj,
          newCustomer: newCustomerObj,
          initialPayment: initialPay,
          initialTasks: generatedTasks,
        });
      } else {
        await saveOrderFirestore(orderObj, false);
      }

      showToast(
        isNew
          ? `Order ${orderObj.orderNumber} created for ${orderObj.customerName}.`
          : `Order ${orderObj.orderNumber} updated.`,
        'success'
      );
      return orderObj;
    },
    [business, customers, orders.length, todayIso, isDemoMode, saveCustomer, showToast]
  );

  const updateOrderStatus = useCallback(
    async (orderId: string, status: OrderStatus) => {
      const target = orders.find((o) => o.id === orderId);
      if (!target) return;
      if (target.status === 'Cancelled' && !isDemoMode) {
        showToast('Cancelled orders are locked. Duplicate the order to re-open it.', 'info');
        return;
      }
      const updated: Order = { ...target, status };
      if (isDemoMode) {
        setOrders((prev) => prev.map((o) => (o.id === orderId ? updated : o)));
      } else {
        await saveOrderFirestore(updated, false);
      }
      showToast(`${target.orderNumber} marked as ${status}.`, 'success');
    },
    [orders, isDemoMode, showToast]
  );

  const archiveOrder = useCallback(
    async (orderId: string, archived: boolean) => {
      const target = orders.find((o) => o.id === orderId);
      if (!target) return;
      if (target.status === 'Cancelled' && !isDemoMode) {
        showToast('Cancelled orders cannot be modified — delete or duplicate instead.', 'info');
        return;
      }
      const updated: Order = { ...target, archived };
      if (isDemoMode) {
        setOrders((prev) => prev.map((o) => (o.id === orderId ? updated : o)));
      } else {
        await saveOrderFirestore(updated, false);
      }
      showToast(archived ? `${target.orderNumber} archived.` : `${target.orderNumber} restored.`, 'info');
    },
    [orders, isDemoMode, showToast]
  );

  const duplicateOrder = useCallback(
    async (orderId: string): Promise<Order | null> => {
      const src = orders.find((o) => o.id === orderId);
      if (!src) return null;
      const copy = await saveOrder(
        {
          customerId: src.customerId,
          customerName: src.customerName,
          product: src.product,
          description: src.description,
          quantity: src.quantity,
          totalPrice: src.totalPrice,
          depositRequired: src.depositRequired,
          amountPaid: 0,
          orderDate: todayIso,
          dueDate: src.dueDate >= todayIso ? src.dueDate : '',
          deliveryMethod: src.deliveryMethod,
          trackingNumber: '',
          status: 'New',
          archived: false,
          customerNotes: src.customerNotes,
          internalNotes: src.internalNotes,
        },
        { autoCreateTasks: true }
      );
      return copy;
    },
    [orders, saveOrder, todayIso]
  );

  const deleteOrder = useCallback(
    async (orderId: string) => {
      const target = orders.find((o) => o.id === orderId);
      const hasPayments =
        (target && target.amountPaid > 0) || payments.some((p) => p.orderId === orderId);

      if (hasPayments) {
        const msg =
          'Orders with recorded payments cannot be permanently deleted. Archive this order instead to keep your revenue history accurate.';
        showToast(msg, 'error');
        throw new Error(msg);
      }

      const relatedTasks = tasks.filter((t) => t.orderId === orderId);
      if (isDemoMode) {
        setOrders((prev) => prev.filter((o) => o.id !== orderId));
        setTasks((prev) => prev.filter((t) => t.orderId !== orderId));
      } else {
        await deleteOrderFirestore(orderId);
        for (const t of relatedTasks) {
          await deleteTaskFirestore(t.id);
        }
      }
      if (selectedOrderId === orderId) setSelectedOrderId(null);
      showToast('Order deleted.', 'info');
    },
    [orders, payments, isDemoMode, tasks, selectedOrderId, showToast]
  );

  const recordPayment = useCallback(
    async (
      orderId: string,
      params: { amount: number; date: string; method: PaymentMethod; notes: string }
    ) => {
      const order = orders.find((o) => o.id === orderId);
      if (!order) {
        throw new Error('Order could not be found.');
      }
      if (order.status === 'Cancelled') {
        throw new Error('Payments cannot be recorded on cancelled orders.');
      }

      const cleanAmount = roundMoney(params.amount);
      if (!Number.isFinite(cleanAmount) || cleanAmount <= 0) {
        throw new Error('Enter a payment amount greater than zero.');
      }

      const remaining = roundMoney(order.remainingBalance);
      if (cleanAmount > remaining + 0.005) {
        throw new Error(`Only ${formatCurrency(remaining, business.currency)} remains on this order.`);
      }

      const newPaid = roundMoney(order.amountPaid + cleanAmount);
      const bal = calculateOrderBalance(order.totalPrice, newPaid, order.depositRequired);
      const updatedOrder: Order = {
        ...order,
        amountPaid: bal.amountPaid,
        remainingBalance: bal.remainingBalance,
        depositPaid: bal.depositPaid,
      };

      const paymentRec: PaymentRecord = {
        id: createEntityId('pay'),
        ownerId: business.ownerId,
        businessId: business.id,
        orderId: order.id,
        customerId: order.customerId,
        customerName: order.customerName,
        amount: cleanAmount,
        date: params.date || todayIso,
        method: params.method,
        notes: clampString(params.notes, 500),
      };

      if (isDemoMode) {
        setPayments((prev) => [paymentRec, ...prev]);
        setOrders((prev) => prev.map((o) => (o.id === orderId ? updatedOrder : o)));
        if (bal.remainingBalance === 0) {
          setTasks((prev) =>
            prev.map((t) =>
              t.orderId === orderId && t.title.toLowerCase().includes('payment due')
                ? { ...t, completed: true }
                : t
            )
          );
        }
      } else {
        const txResult = await recordPaymentAtomicFirestore({
          orderId: order.id,
          payment: paymentRec,
          currency: business.currency,
        });
        if (txResult.remainingBalance === 0) {
          const payTasks = tasks.filter(
            (t) =>
              t.orderId === orderId &&
              !t.completed &&
              t.title.toLowerCase().includes('payment due')
          );
          for (const pt of payTasks) {
            await toggleTaskFirestore(pt.id, true);
          }
        }
      }
      showToast('Payment recorded and balance updated.', 'success');
    },
    [orders, business, todayIso, isDemoMode, tasks, showToast]
  );

  // Tasks CRUD
  const saveTask = useCallback(
    async (draft: Omit<TaskItem, 'id' | 'ownerId' | 'businessId'> & { id?: string }) => {
      const isNew = !draft.id;
      const taskObj: TaskItem = {
        id: draft.id || createEntityId('tsk'),
        ownerId: business.ownerId,
        businessId: business.id,
        title: clampString(draft.title, 240) || 'Task',
        customerId: draft.customerId || '',
        customerName: clampString(draft.customerName, 140),
        orderId: draft.orderId || '',
        orderNumber: clampString(draft.orderNumber, 32),
        dueDate: draft.dueDate || todayIso,
        priority: draft.priority || 'Medium',
        completed: Boolean(draft.completed),
        autoGenerated: Boolean(draft.autoGenerated),
      };

      if (isDemoMode) {
        setTasks((prev) =>
          isNew ? [taskObj, ...prev] : prev.map((t) => (t.id === taskObj.id ? taskObj : t))
        );
      } else {
        await saveTaskFirestore(taskObj, isNew);
      }
      showToast(isNew ? 'Task added.' : 'Task updated.', 'success');
    },
    [business, todayIso, isDemoMode, showToast]
  );

  const toggleTask = useCallback(
    async (taskId: string) => {
      const target = tasks.find((t) => t.id === taskId);
      if (!target) return;
      const next = !target.completed;
      if (isDemoMode) {
        setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, completed: next } : t)));
      } else {
        await toggleTaskFirestore(taskId, next);
      }
    },
    [tasks, isDemoMode]
  );

  const deleteTask = useCallback(
    async (taskId: string) => {
      if (isDemoMode) {
        setTasks((prev) => prev.filter((t) => t.id !== taskId));
      } else {
        await deleteTaskFirestore(taskId);
      }
      showToast('Task removed.', 'info');
    },
    [isDemoMode, showToast]
  );

  // Expenses CRUD
  const addExpense = useCallback(
    async (draft: Omit<ExpenseRecord, 'id' | 'ownerId' | 'businessId'>) => {
      const exp: ExpenseRecord = {
        id: createEntityId('exp'),
        ownerId: business.ownerId,
        businessId: business.id,
        description: clampString(draft.description, 200) || 'Expense',
        category: draft.category,
        amount: roundMoney(draft.amount),
        date: draft.date || todayIso,
        notes: clampString(draft.notes, 1000),
      };
      if (isDemoMode) {
        setExpenses((prev) => [exp, ...prev]);
      } else {
        await createExpenseFirestore(exp);
      }
      showToast('Expense logged.', 'success');
    },
    [business, todayIso, isDemoMode, showToast]
  );

  const deleteExpense = useCallback(
    async (expenseId: string) => {
      if (isDemoMode) {
        setExpenses((prev) => prev.filter((e) => e.id !== expenseId));
      } else {
        await deleteExpenseFirestore(expenseId);
      }
      showToast('Expense deleted.', 'info');
    },
    [isDemoMode, showToast]
  );

  // Notifications
  const markNotificationRead = useCallback(
    async (notifId: string) => {
      const target = notifications.find((n) => n.id === notifId);
      if (!target) return;
      if (isDemoMode) {
        setStoredNotifications((prev) => {
          const exists = prev.some((p) => p.id === notifId);
          return exists
            ? prev.map((p) => (p.id === notifId ? { ...p, read: true } : p))
            : [...prev, { ...target, read: true }];
        });
      } else {
        const existsInDb = storedNotifications.some((p) => p.id === notifId);
        await markNotificationReadFirestore(target, existsInDb);
      }
    },
    [notifications, storedNotifications, isDemoMode]
  );

  const markAllNotificationsRead = useCallback(async () => {
    const unread = notifications.filter((n) => !n.read);
    if (unread.length === 0) return;
    if (isDemoMode) {
      setStoredNotifications((prev) => {
        const map = new Map(prev.map((p) => [p.id, p]));
        for (const u of unread) {
          map.set(u.id, { ...u, read: true });
        }
        return [...map.values()];
      });
    } else {
      for (const u of unread) {
        const existsInDb = storedNotifications.some((p) => p.id === u.id);
        await markNotificationReadFirestore(u, existsInDb);
      }
    }
  }, [notifications, storedNotifications, isDemoMode]);

  // Settings
  const updateSettings = useCallback(
    async (params: {
      ownerName?: string;
      businessName?: string;
      businessType?: string;
      currency?: CurrencyCode;
      plan?: PlanTier;
      notificationsEnabled?: boolean;
    }) => {
      const nextBiz: BusinessProfile = {
        ...business,
        ownerName: params.ownerName !== undefined ? clampString(params.ownerName, 120) || business.ownerName : business.ownerName,
        name: params.businessName !== undefined ? clampString(params.businessName, 140) || business.name : business.name,
        businessType: params.businessType !== undefined ? clampString(params.businessType, 120) || business.businessType : business.businessType,
        currency: params.currency ?? business.currency,
        plan: params.plan ?? business.plan,
      };
      setBusiness(nextBiz);

      if (userProfile) {
        const nextUser: UserProfile = {
          ...userProfile,
          name: params.ownerName !== undefined ? clampString(params.ownerName, 120) || userProfile.name : userProfile.name,
          plan: params.plan ?? userProfile.plan,
          notificationsEnabled:
            params.notificationsEnabled !== undefined
              ? params.notificationsEnabled
              : userProfile.notificationsEnabled,
        };
        setUserProfile(nextUser);
      }

      if (!isDemoMode && firebaseUser?.emailVerified) {
        await updateBusinessDoc(firebaseUser.uid, {
          ownerName: nextBiz.ownerName,
          name: nextBiz.name,
          businessType: nextBiz.businessType,
          currency: nextBiz.currency,
          plan: nextBiz.plan,
        });
        await updateUserDoc(firebaseUser.uid, {
          name: nextBiz.ownerName,
          plan: nextBiz.plan,
          notificationsEnabled: params.notificationsEnabled,
        });
      }
      showToast('Settings saved.', 'success');
    },
    [business, userProfile, isDemoMode, firebaseUser, showToast]
  );

  const resetDemoData = useCallback(() => {
    const fresh = createLunaDemoSeed('demo_luna_owner', todayIso);
    try {
      localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(fresh));
    } catch {
      // ignore
    }
    setUserProfile(fresh.user);
    setBusiness(fresh.business);
    setCustomers(fresh.customers);
    setOrders(fresh.orders);
    setPayments(fresh.payments);
    setExpenses(fresh.expenses);
    setTasks(fresh.tasks);
    setStoredNotifications(fresh.notifications);
    showToast('Demo workspace reset to defaults.', 'info');
  }, [todayIso, showToast]);

  const value: AppContextValue = {
    screenMode,
    authModeInitial,
    isDemoMode,
    loadingAuth,
    firebaseUser,
    userProfile,
    business,
    customers,
    orders,
    payments,
    expenses,
    tasks,
    notifications,
    unreadNotificationCount,
    todayIso,
    theme,
    activeSection,
    selectedOrderId,
    selectedCustomerId,
    ordersStatusFilter,
    orderModal,
    messageModal,
    searchOpen,
    toasts,
    openAuthScreen,
    backToLanding,
    enterDemoMode,
    setActiveSection,
    setSelectedOrderId,
    setSelectedCustomerId,
    setOrdersStatusFilter,
    openOrderModal,
    closeOrderModal,
    openMessageModal,
    closeMessageModal,
    setSearchOpen,
    toggleTheme,
    setThemePreference,
    showToast,
    refreshVerificationStatus,
    resendVerificationEmail,
    logout,
    completeOnboarding,
    saveOrder,
    updateOrderStatus,
    archiveOrder,
    duplicateOrder,
    deleteOrder,
    recordPayment,
    saveCustomer,
    deleteCustomer,
    saveTask,
    toggleTask,
    deleteTask,
    addExpense,
    deleteExpense,
    markNotificationRead,
    markAllNotificationsRead,
    updateSettings,
    seedSampleData,
    resetDemoData,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside AppProvider');
  return ctx;
}
