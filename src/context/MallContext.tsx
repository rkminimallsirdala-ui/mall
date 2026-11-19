import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  User,
  onAuthStateChanged,
  signInWithPopup,
  signOut as firebaseSignOut,
} from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  runTransaction,
  setDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import {
  BOOTSTRAP_OWNER_EMAIL,
  DEFAULT_PERMISSION_MATRIX,
  DEFAULT_STORE_SETTINGS,
} from '../config/businessConfig';
import {
  DEFAULT_MESSAGE_TEMPLATES,
  DEMO_ATTENDANCE,
  DEMO_AUDIT_LOGS,
  DEMO_CASH_REGISTERS,
  DEMO_CUSTOMERS,
  DEMO_CUSTOMER_LEDGER,
  DEMO_EXPENSES,
  DEMO_MESSAGE_LOGS,
  DEMO_MOVEMENTS,
  DEMO_OFFERS,
  DEMO_ONLINE_ORDERS,
  DEMO_PAYROLL,
  DEMO_PRODUCTS,
  DEMO_PURCHASES,
  DEMO_SALES,
  DEMO_STAFF,
  DEMO_SUPPLIERS,
  DEMO_SUPPLIER_LEDGER,
} from '../data/demoSeed';
import { auth, db, googleAuthProvider, testFirestoreConnection } from '../lib/firebase';
import { OperationType, handleFirestoreError } from '../lib/firestoreError';
import { enqueueOfflineSale, listOfflineSales, removeOfflineSale } from '../lib/offlineQueue';
import {
  AttendanceRecord,
  AuditLog,
  CashRegister,
  Customer,
  CustomerLedgerEntry,
  Expense,
  InventoryMovement,
  Language,
  MessageLog,
  MessageTemplate,
  MovementType,
  Offer,
  OfflineQueuedSale,
  OnlineOrder,
  OrderStatus,
  PaymentMode,
  PaymentSplit,
  PayrollRecord,
  PermissionKey,
  Product,
  Purchase,
  Sale,
  SaleItem,
  StaffMember,
  StaffRole,
  StoreSettings,
  Supplier,
  SupplierLedgerEntry,
} from '../types/erp';
import { computeWeightedAverageCost, round2 } from '../utils/erpLogic';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

function makeId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

interface MallContextValue {
  language: Language;
  setLanguage: (lang: Language) => void;
  darkMode: boolean;
  toggleDarkMode: () => void;
  appMode: 'storefront' | 'erp';
  setAppMode: (mode: 'storefront' | 'erp') => void;
  user: User | null;
  authLoading: boolean;
  isCloudLive: boolean;
  actualRole: StaffRole;
  activeRoleView: Exclude<StaffRole, 'customer'>;
  setActiveRoleView: (role: Exclude<StaffRole, 'customer'>) => void;
  hasPermission: (perm: PermissionKey) => boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  reportFilterMode: 'all' | 'live' | 'demo';
  setReportFilterMode: (mode: 'all' | 'live' | 'demo') => void;
  isOffline: boolean;
  simulatedOffline: boolean;
  setSimulatedOffline: (v: boolean) => void;
  offlineQueue: OfflineQueuedSale[];
  syncOfflineQueue: () => Promise<{ synced: number; conflicts: number }>;

  storeSettings: StoreSettings;
  products: Product[];
  movements: InventoryMovement[];
  suppliers: Supplier[];
  purchases: Purchase[];
  supplierLedger: SupplierLedgerEntry[];
  customers: Customer[];
  customerLedger: CustomerLedgerEntry[];
  offers: Offer[];
  sales: Sale[];
  onlineOrders: OnlineOrder[];
  staff: StaffMember[];
  attendance: AttendanceRecord[];
  payroll: PayrollRecord[];
  expenses: Expense[];
  cashRegisters: CashRegister[];
  messageTemplates: MessageTemplate[];
  setMessageTemplates: React.Dispatch<React.SetStateAction<MessageTemplate[]>>;
  messageLogs: MessageLog[];
  auditLogs: AuditLog[];

  saveStoreSettings: (next: Partial<StoreSettings>) => Promise<void>;
  upsertProduct: (product: Product) => Promise<void>;
  archiveProduct: (productId: string) => Promise<void>;
  bulkImportProducts: (items: Product[]) => Promise<void>;
  adjustStock: (params: {
    productId: string;
    type: MovementType;
    qty: number;
    reason: string;
    referenceNo: string;
    overrideNegative?: boolean;
  }) => Promise<void>;
  recordPurchase: (purchase: Purchase) => Promise<void>;
  recordSupplierPayment: (supplierId: string, amount: number, paymentMode: string, notes: string) => Promise<void>;
  upsertCustomer: (customer: Customer) => Promise<void>;
  recordCustomerKhataPayment: (params: {
    customerId: string;
    amount: number;
    paymentMode: string;
    notes: string;
    isReversal?: boolean;
  }) => Promise<void>;
  upsertOffer: (offer: Offer) => Promise<void>;
  completePosSale: (params: {
    items: SaleItem[];
    customerId: string;
    customerName: string;
    customerMobile?: string;
    itemTotal: number;
    discountTotal: number;
    couponCode?: string;
    taxableValue: number;
    cgstTotal: number;
    sgstTotal: number;
    igstTotal: number;
    totalGst: number;
    roundOff: number;
    grandTotal: number;
    customerSavings: number;
    paymentMode: PaymentMode;
    paymentSplit: PaymentSplit;
    amountPaid: number;
    balanceDue: number;
    idempotencyKey: string;
    sourceOrderId?: string;
  }) => Promise<{ sale: Sale; queuedOffline?: boolean }>;
  refundSale: (saleId: string, reason: string) => Promise<void>;
  createOnlineOrder: (order: Omit<OnlineOrder, 'id' | 'orderNo' | 'status' | 'createdAt'>) => Promise<OnlineOrder>;
  updateOnlineOrderStatus: (
    orderId: string,
    status: OrderStatus,
    extra?: {
      assignedDeliveryStaffId?: string;
      assignedDeliveryStaffName?: string;
      proofOfDelivery?: string;
      failedReason?: string;
      convertedInvoiceNo?: string;
    }
  ) => Promise<void>;
  upsertStaff: (member: StaffMember) => Promise<void>;
  assignStaffAuthRole: (uid: string, email: string, role: Exclude<StaffRole, 'customer'>, staffId: string) => Promise<void>;
  recordAttendance: (record: AttendanceRecord) => Promise<void>;
  createPayroll: (record: PayrollRecord) => Promise<void>;
  recordExpense: (expense: Expense) => Promise<void>;
  saveCashRegister: (reg: CashRegister) => Promise<void>;
  dispatchNotification: (params: {
    channel: 'whatsapp' | 'sms' | 'email';
    recipient: string;
    trigger: string;
    body: string;
  }) => Promise<MessageLog>;
  seedDemoDataToCloud: () => Promise<void>;
  purgeDemoDataFromCloud: () => Promise<number>;
  exportBackupJson: () => string;
  toast: { type: 'success' | 'error' | 'info'; message: string } | null;
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

const MallContext = createContext<MallContextValue | null>(null);

export const MallProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const browserOnline = useOnlineStatus();
  const [simulatedOffline, setSimulatedOffline] = useState(false);
  const isOffline = !browserOnline || simulatedOffline;

  const [language, setLanguage] = useState<Language>('hi');
  const [darkMode, setDarkMode] = useState(false);
  const [appMode, setAppMode] = useState<'storefront' | 'erp'>('storefront');
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [actualRole, setActualRole] = useState<StaffRole>('owner');
  const [activeRoleView, setActiveRoleView] = useState<Exclude<StaffRole, 'customer'>>('owner');
  const [reportFilterMode, setReportFilterMode] = useState<'all' | 'live' | 'demo'>('all');
  const [toast, setToast] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);

  const [storeSettings, setStoreSettings] = useState<StoreSettings>(DEFAULT_STORE_SETTINGS);
  const [products, setProducts] = useState<Product[]>(DEMO_PRODUCTS);
  const [movements, setMovements] = useState<InventoryMovement[]>(DEMO_MOVEMENTS);
  const [suppliers, setSuppliers] = useState<Supplier[]>(DEMO_SUPPLIERS);
  const [purchases, setPurchases] = useState<Purchase[]>(DEMO_PURCHASES);
  const [supplierLedger, setSupplierLedger] = useState<SupplierLedgerEntry[]>(DEMO_SUPPLIER_LEDGER);
  const [customers, setCustomers] = useState<Customer[]>(DEMO_CUSTOMERS);
  const [customerLedger, setCustomerLedger] = useState<CustomerLedgerEntry[]>(DEMO_CUSTOMER_LEDGER);
  const [offers, setOffers] = useState<Offer[]>(DEMO_OFFERS);
  const [sales, setSales] = useState<Sale[]>(DEMO_SALES);
  const [onlineOrders, setOnlineOrders] = useState<OnlineOrder[]>(DEMO_ONLINE_ORDERS);
  const [staff, setStaff] = useState<StaffMember[]>(DEMO_STAFF);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>(DEMO_ATTENDANCE);
  const [payroll, setPayroll] = useState<PayrollRecord[]>(DEMO_PAYROLL);
  const [expenses, setExpenses] = useState<Expense[]>(DEMO_EXPENSES);
  const [cashRegisters, setCashRegisters] = useState<CashRegister[]>(DEMO_CASH_REGISTERS);
  const [messageTemplates, setMessageTemplates] = useState<MessageTemplate[]>(DEFAULT_MESSAGE_TEMPLATES);
  const [messageLogs, setMessageLogs] = useState<MessageLog[]>(DEMO_MESSAGE_LOGS);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>(DEMO_AUDIT_LOGS);
  const [offlineQueue, setOfflineQueue] = useState<OfflineQueuedSale[]>([]);

  const isCloudLive = Boolean(user && user.emailVerified);
  const isStaff = isCloudLive && actualRole !== 'customer';

  const showToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast((prev) => (prev?.message === message ? null : prev));
    }, 4500);
  }, []);

  const toggleDarkMode = useCallback(() => {
    setDarkMode((prev) => {
      const next = !prev;
      if (typeof document !== 'undefined') {
        document.documentElement.classList.toggle('dark', next);
      }
      return next;
    });
  }, []);

  useEffect(() => {
    testFirestoreConnection();
    listOfflineSales().then(setOfflineQueue);
  }, []);

  // Firebase Auth listener & role resolution
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (!firebaseUser) {
        setActualRole('owner'); // Demo sandbox defaults to owner preview
        setAuthLoading(false);
        return;
      }

      try {
        const isBootstrapOwner = firebaseUser.email === BOOTSTRAP_OWNER_EMAIL;
        let resolvedRole: StaffRole = isBootstrapOwner ? 'owner' : 'customer';

        if (!isBootstrapOwner) {
          const roleSnap = await getDoc(doc(db, 'staff_roles', firebaseUser.uid));
          if (roleSnap.exists() && roleSnap.data().active) {
            resolvedRole = roleSnap.data().role as StaffRole;
          }
        }

        await setDoc(
          doc(db, 'users', firebaseUser.uid),
          {
            uid: firebaseUser.uid,
            email: firebaseUser.email || '',
            displayName: firebaseUser.displayName || 'User',
            role: resolvedRole,
            active: true,
            updatedAt: new Date().toISOString(),
            createdAt: new Date().toISOString(),
          },
          { merge: true }
        );

        setActualRole(resolvedRole);
        if (resolvedRole !== 'customer') {
          setActiveRoleView(resolvedRole);
        }
      } catch (err) {
        console.error('Auth role sync warning:', err);
      } finally {
        setAuthLoading(false);
      }
    });
    return () => unsub();
  }, []);

  // Public storefront listeners (store_settings/main, products, offers)
  useEffect(() => {
    const unsubSettings = onSnapshot(
      doc(db, 'store_settings', 'main'),
      (snap) => {
        if (snap.exists()) {
          setStoreSettings({ ...DEFAULT_STORE_SETTINGS, ...(snap.data() as StoreSettings) });
        }
      },
      (err) => console.warn('Public settings listener:', err.message)
    );

    const unsubProducts = onSnapshot(
      collection(db, 'products'),
      (snap) => {
        if (!snap.empty) {
          setProducts(snap.docs.map((d) => d.data() as Product));
        } else if (isCloudLive) {
          setProducts([]);
        }
      },
      (err) => console.warn('Public products listener:', err.message)
    );

    const unsubOffers = onSnapshot(
      collection(db, 'offers'),
      (snap) => {
        if (!snap.empty) {
          setOffers(snap.docs.map((d) => d.data() as Offer));
        } else if (isCloudLive) {
          setOffers([]);
        }
      },
      (err) => console.warn('Public offers listener:', err.message)
    );

    return () => {
      unsubSettings();
      unsubProducts();
      unsubOffers();
    };
  }, [isCloudLive]);

  // Staff ERP live Firestore listeners (only attached when authenticated & verified staff)
  useEffect(() => {
    if (!isStaff) {
      if (!isCloudLive) {
        setMovements(DEMO_MOVEMENTS);
        setSuppliers(DEMO_SUPPLIERS);
        setPurchases(DEMO_PURCHASES);
        setSupplierLedger(DEMO_SUPPLIER_LEDGER);
        setCustomers(DEMO_CUSTOMERS);
        setCustomerLedger(DEMO_CUSTOMER_LEDGER);
        setSales(DEMO_SALES);
        setOnlineOrders(DEMO_ONLINE_ORDERS);
        setStaff(DEMO_STAFF);
        setAttendance(DEMO_ATTENDANCE);
        setPayroll(DEMO_PAYROLL);
        setExpenses(DEMO_EXPENSES);
        setCashRegisters(DEMO_CASH_REGISTERS);
        setMessageLogs(DEMO_MESSAGE_LOGS);
        setAuditLogs(DEMO_AUDIT_LOGS);
      }
      return;
    }

    const unsubs: Array<() => void> = [];
    const bindCol = <T,>(path: string, setter: (items: T[]) => void, allowed: boolean) => {
      if (!allowed) return;
      const u = onSnapshot(
        collection(db, path),
        (snap) => setter(snap.docs.map((d) => d.data() as T)),
        (err) => handleFirestoreError(err, OperationType.LIST, path)
      );
      unsubs.push(u);
    };

    const isMgrOrOwner = ['owner', 'super_admin', 'manager'].includes(actualRole);
    const isAcct = ['owner', 'super_admin', 'accountant'].includes(actualRole);
    const isInv = ['owner', 'super_admin', 'manager', 'inventory_manager'].includes(actualRole);
    const isPos = ['owner', 'super_admin', 'manager', 'cashier'].includes(actualRole);

    bindCol<InventoryMovement>('inventory_movements', setMovements, true);
    bindCol<Supplier>('suppliers', setSuppliers, isInv || isAcct);
    bindCol<Purchase>('purchases', setPurchases, isInv || isAcct);
    bindCol<SupplierLedgerEntry>('supplier_ledger', setSupplierLedger, isMgrOrOwner || isAcct);
    bindCol<Customer>('customers', setCustomers, isPos || isAcct);
    bindCol<CustomerLedgerEntry>('customer_ledger', setCustomerLedger, isPos || isAcct);
    bindCol<Sale>('sales', setSales, isPos || isAcct);
    bindCol<OnlineOrder>('online_orders', setOnlineOrders, true);
    bindCol<StaffMember>('staff', setStaff, isMgrOrOwner || isAcct);
    bindCol<AttendanceRecord>('attendance', setAttendance, isMgrOrOwner || isAcct);
    bindCol<PayrollRecord>('payroll', setPayroll, isAcct);
    bindCol<Expense>('expenses', setExpenses, isMgrOrOwner || isAcct);
    bindCol<CashRegister>('cash_registers', setCashRegisters, isPos || isAcct);
    bindCol<MessageLog>('message_logs', setMessageLogs, isMgrOrOwner || isAcct);
    bindCol<AuditLog>('audit_logs', setAuditLogs, ['owner', 'super_admin'].includes(actualRole));

    return () => unsubs.forEach((u) => u());
  }, [isStaff, isCloudLive, actualRole]);

  const hasPermission = useCallback(
    (perm: PermissionKey) => {
      const matrix = storeSettings.permissionMatrix || DEFAULT_PERMISSION_MATRIX;
      return Boolean(matrix[activeRoleView]?.[perm]);
    },
    [storeSettings.permissionMatrix, activeRoleView]
  );

  const appendAudit = useCallback(
    async (action: string, entityType: string, entityId: string, summary: string, isDemo = false) => {
      const entry: AuditLog = {
        id: makeId('aud'),
        actorUid: user?.uid || 'demo_actor',
        actorEmail: user?.email || 'demo@rkminimall.local',
        action,
        entityType,
        entityId,
        summary,
        createdAt: new Date().toISOString(),
        isDemo,
      };
      if (isStaff) {
        await setDoc(doc(db, 'audit_logs', entry.id), entry).catch((err) =>
          console.warn('Audit log skipped:', err.message)
        );
      } else {
        setAuditLogs((prev) => [entry, ...prev]);
      }
    },
    [user, isStaff]
  );

  const signInWithGoogle = useCallback(async () => {
    try {
      await signInWithPopup(auth, googleAuthProvider);
      showToast('Google Sign-In successful! Live Cloud Sync enabled.', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Google Sign-In failed.', 'error');
    }
  }, [showToast]);

  const signOut = useCallback(async () => {
    await firebaseSignOut(auth);
    showToast('Signed out from cloud account.', 'info');
  }, [showToast]);

  const saveStoreSettings = useCallback(
    async (next: Partial<StoreSettings>) => {
      const merged: StoreSettings = {
        ...storeSettings,
        ...next,
        id: 'main',
        updatedAt: new Date().toISOString(),
      };
      if (isStaff && ['owner', 'super_admin'].includes(actualRole)) {
        try {
          await setDoc(doc(db, 'store_settings', 'main'), merged, { merge: true });
        } catch (err) {
          handleFirestoreError(err, OperationType.WRITE, 'store_settings/main');
        }
      }
      setStoreSettings(merged);
      await appendAudit('UPDATE_SETTINGS', 'store_settings', 'main', 'Updated central business configuration');
      showToast('Store settings saved.', 'success');
    },
    [storeSettings, isStaff, actualRole, appendAudit, showToast]
  );

  const upsertProduct = useCallback(
    async (product: Product) => {
      const clean: Product = { ...product, updatedAt: new Date().toISOString() };
      if (isStaff) {
        try {
          await setDoc(doc(db, 'products', clean.id), clean, { merge: true });
        } catch (err) {
          handleFirestoreError(err, OperationType.WRITE, `products/${clean.id}`);
        }
      } else {
        setProducts((prev) => {
          const exists = prev.some((p) => p.id === clean.id);
          return exists ? prev.map((p) => (p.id === clean.id ? clean : p)) : [clean, ...prev];
        });
      }
      await appendAudit('UPSERT_PRODUCT', 'products', clean.id, `Saved product ${clean.nameEn} (${clean.sku})`);
      showToast(`Product ${clean.nameEn} saved.`, 'success');
    },
    [isStaff, appendAudit, showToast]
  );

  const archiveProduct = useCallback(
    async (productId: string) => {
      const existingProd = products.find((p) => p.id === productId);
      if (!existingProd) return;
      const updated = { ...existingProd, active: false, updatedAt: new Date().toISOString() };
      if (isStaff) {
        try {
          await setDoc(doc(db, 'products', productId), updated, { merge: true });
        } catch (err) {
          handleFirestoreError(err, OperationType.UPDATE, `products/${productId}`);
        }
      } else {
        setProducts((prev) => prev.map((p) => (p.id === productId ? updated : p)));
      }
      await appendAudit('ARCHIVE_PRODUCT', 'products', productId, `Archived ${existingProd.nameEn} safely`);
      showToast(`${existingProd.nameEn} archived (historical sales preserved).`, 'info');
    },
    [products, isStaff, appendAudit, showToast]
  );

  const bulkImportProducts = useCallback(
    async (items: Product[]) => {
      if (isStaff) {
        const batch = writeBatch(db);
        for (const item of items) {
          batch.set(doc(db, 'products', item.id), { ...item, updatedAt: new Date().toISOString() }, { merge: true });
        }
        await batch.commit();
      } else {
        setProducts((prev) => {
          const map = new Map(prev.map((p) => [p.id, p]));
          items.forEach((it) => map.set(it.id, it));
          return Array.from(map.values());
        });
      }
      await appendAudit('BULK_IMPORT_PRODUCTS', 'products', 'bulk', `Imported/updated ${items.length} products`);
      showToast(`Processed ${items.length} products.`, 'success');
    },
    [isStaff, appendAudit, showToast]
  );

  const adjustStock = useCallback(
    async (params: {
      productId: string;
      type: MovementType;
      qty: number;
      reason: string;
      referenceNo: string;
      overrideNegative?: boolean;
    }) => {
      const prod = products.find((p) => p.id === params.productId);
      if (!prod) throw new Error('Product not found');
      const isInward = params.type === 'stock_inward' || params.type === 'customer_return';
      const delta = isInward ? Math.abs(params.qty) : -Math.abs(params.qty);
      const newStock = round2(prod.currentStock + delta);

      if (newStock < 0 && !params.overrideNegative) {
        throw new Error('Negative stock blocked. Authorized override is required.');
      }

      const mov: InventoryMovement = {
        id: makeId('mov'),
        productId: prod.id,
        productName: prod.nameEn,
        type: params.type,
        previousStock: prod.currentStock,
        stockIn: isInward ? Math.abs(params.qty) : 0,
        stockOut: isInward ? 0 : Math.abs(params.qty),
        newStock,
        batchNumber: prod.batchNumber,
        reason: params.reason,
        referenceNo: params.referenceNo,
        staffName: user?.displayName || activeRoleView,
        createdAt: new Date().toISOString(),
        isDemo: !isStaff || Boolean(prod.isDemo),
      };

      if (isStaff) {
        await runTransaction(db, async (tx) => {
          const pRef = doc(db, 'products', prod.id);
          const pSnap = await tx.get(pRef);
          if (!pSnap.exists()) throw new Error('Product missing in database');
          const cur = (pSnap.data() as Product).currentStock;
          const computedNew = round2(cur + delta);
          if (computedNew < 0 && !params.overrideNegative) {
            throw new Error('Insufficient stock for outward adjustment.');
          }
          tx.update(pRef, { currentStock: computedNew, updatedAt: new Date().toISOString() });
          tx.set(doc(db, 'inventory_movements', mov.id), {
            ...mov,
            previousStock: cur,
            newStock: computedNew,
          });
        });
      } else {
        setProducts((prev) => prev.map((p) => (p.id === prod.id ? { ...p, currentStock: newStock } : p)));
        setMovements((prev) => [mov, ...prev]);
      }

      await appendAudit(
        'STOCK_ADJUSTMENT',
        'products',
        prod.id,
        `${params.type}: ${prod.nameEn} (${prod.currentStock} -> ${newStock}) - ${params.reason}`
      );
      showToast(`Stock updated for ${prod.nameEn}: ${newStock} ${prod.unit}`, 'success');
    },
    [products, user, activeRoleView, isStaff, appendAudit, showToast]
  );

  const recordPurchase = useCallback(
    async (purchase: Purchase) => {
      const sup = suppliers.find((s) => s.id === purchase.supplierId);
      const prevBal = sup?.currentBalance || 0;
      const newBal = round2(prevBal + purchase.dueAmount);
      const ledEntry: SupplierLedgerEntry = {
        id: makeId('sled'),
        supplierId: purchase.supplierId,
        supplierName: purchase.supplierName,
        entryType: 'purchase_invoice',
        referenceNo: purchase.invoiceNo,
        previousBalance: prevBal,
        debitAmount: purchase.totalAmount,
        creditAmount: purchase.paidAmount,
        remainingDue: newBal,
        paymentMode: purchase.paymentMode,
        notes: purchase.notes,
        createdAt: new Date().toISOString(),
        isDemo: purchase.isDemo,
      };

      if (isStaff) {
        await runTransaction(db, async (tx) => {
          tx.set(doc(db, 'purchases', purchase.id), purchase);
          if (sup) {
            tx.update(doc(db, 'suppliers', sup.id), { currentBalance: newBal });
          }
          tx.set(doc(db, 'supplier_ledger', ledEntry.id), ledEntry);

          if (purchase.status === 'received_inward' || purchase.status === 'partially_received') {
            for (const item of purchase.items) {
              const pRef = doc(db, 'products', item.productId);
              const pSnap = await tx.get(pRef);
              if (pSnap.exists()) {
                const pData = pSnap.data() as Product;
                const nextStock = round2(pData.currentStock + item.qty);
                const nextRate = computeWeightedAverageCost(
                  pData.currentStock,
                  pData.purchaseRate,
                  item.qty,
                  item.rate
                );
                tx.update(pRef, {
                  currentStock: nextStock,
                  purchaseRate: nextRate,
                  batchNumber: item.batchNumber || pData.batchNumber,
                  expiryDate: item.expiryDate || pData.expiryDate,
                  updatedAt: new Date().toISOString(),
                });
                const movId = makeId('mov');
                tx.set(doc(db, 'inventory_movements', movId), {
                  id: movId,
                  productId: item.productId,
                  productName: item.productName,
                  type: 'stock_inward',
                  previousStock: pData.currentStock,
                  stockIn: item.qty,
                  stockOut: 0,
                  newStock: nextStock,
                  batchNumber: item.batchNumber || pData.batchNumber,
                  reason: `Purchase GRN ${purchase.grnNumber}`,
                  referenceNo: purchase.invoiceNo,
                  staffName: user?.displayName || activeRoleView,
                  createdAt: new Date().toISOString(),
                  isDemo: purchase.isDemo,
                } satisfies InventoryMovement);
              }
            }
          }
        });
      } else {
        setPurchases((prev) => [purchase, ...prev]);
        setSuppliers((prev) => prev.map((s) => (s.id === purchase.supplierId ? { ...s, currentBalance: newBal } : s)));
        setSupplierLedger((prev) => [ledEntry, ...prev]);
        if (purchase.status === 'received_inward' || purchase.status === 'partially_received') {
          const newMovs: InventoryMovement[] = [];
          setProducts((prev) =>
            prev.map((p) => {
              const item = purchase.items.find((it) => it.productId === p.id);
              if (!item) return p;
              const nextStock = round2(p.currentStock + item.qty);
              const nextRate = computeWeightedAverageCost(p.currentStock, p.purchaseRate, item.qty, item.rate);
              newMovs.push({
                id: makeId('mov'),
                productId: p.id,
                productName: p.nameEn,
                type: 'stock_inward',
                previousStock: p.currentStock,
                stockIn: item.qty,
                stockOut: 0,
                newStock: nextStock,
                reason: `Purchase GRN ${purchase.grnNumber}`,
                referenceNo: purchase.invoiceNo,
                staffName: activeRoleView,
                createdAt: new Date().toISOString(),
                isDemo: true,
              });
              return { ...p, currentStock: nextStock, purchaseRate: nextRate };
            })
          );
          setMovements((prev) => [...newMovs, ...prev]);
        }
      }

      await appendAudit('RECORD_PURCHASE', 'purchases', purchase.id, `Purchase ${purchase.invoiceNo} ₹${purchase.totalAmount}`);
      showToast(`Purchase ${purchase.invoiceNo} saved & stock updated.`, 'success');
    },
    [suppliers, isStaff, user, activeRoleView, appendAudit, showToast]
  );

  const recordSupplierPayment = useCallback(
    async (supplierId: string, amount: number, paymentMode: string, notes: string) => {
      const sup = suppliers.find((s) => s.id === supplierId);
      if (!sup) return;
      const newBal = round2(sup.currentBalance - amount);
      const entry: SupplierLedgerEntry = {
        id: makeId('sled'),
        supplierId,
        supplierName: sup.businessName,
        entryType: 'payment',
        referenceNo: `PAY-${Date.now().toString().slice(-6)}`,
        previousBalance: sup.currentBalance,
        debitAmount: 0,
        creditAmount: amount,
        remainingDue: newBal,
        paymentMode,
        notes,
        createdAt: new Date().toISOString(),
        isDemo: !isStaff,
      };
      if (isStaff) {
        await runTransaction(db, async (tx) => {
          tx.update(doc(db, 'suppliers', supplierId), { currentBalance: newBal });
          tx.set(doc(db, 'supplier_ledger', entry.id), entry);
        });
      } else {
        setSuppliers((prev) => prev.map((s) => (s.id === supplierId ? { ...s, currentBalance: newBal } : s)));
        setSupplierLedger((prev) => [entry, ...prev]);
      }
      await appendAudit('SUPPLIER_PAYMENT', 'suppliers', supplierId, `Paid ₹${amount} to ${sup.businessName}`);
      showToast(`Recorded ₹${amount} payment to ${sup.businessName}.`, 'success');
    },
    [suppliers, isStaff, appendAudit, showToast]
  );

  const upsertCustomer = useCallback(
    async (customer: Customer) => {
      if (isStaff) {
        await setDoc(doc(db, 'customers', customer.id), customer, { merge: true });
      } else {
        setCustomers((prev) => {
          const exists = prev.some((c) => c.id === customer.id);
          return exists ? prev.map((c) => (c.id === customer.id ? customer : c)) : [customer, ...prev];
        });
      }
      showToast(`Customer ${customer.name} saved.`, 'success');
    },
    [isStaff, showToast]
  );

  const recordCustomerKhataPayment = useCallback(
    async (params: {
      customerId: string;
      amount: number;
      paymentMode: string;
      notes: string;
      isReversal?: boolean;
    }) => {
      const cust = customers.find((c) => c.id === params.customerId);
      if (!cust) return;
      const delta = params.isReversal ? params.amount : -params.amount;
      const remainingDue = round2(Math.max(0, cust.outstandingDue + delta));
      const entry: CustomerLedgerEntry = {
        id: makeId('cled'),
        customerId: cust.id,
        customerName: cust.name,
        invoiceNo: `KHATA-${Date.now().toString().slice(-6)}`,
        entryType: params.isReversal ? 'reversal' : 'payment_received',
        previousBalance: cust.outstandingDue,
        creditAdded: params.isReversal ? params.amount : 0,
        paymentReceived: params.isReversal ? 0 : params.amount,
        remainingDue,
        paymentMode: params.paymentMode,
        notes: params.notes,
        createdAt: new Date().toISOString(),
        isDemo: !isStaff,
      };
      if (isStaff) {
        await runTransaction(db, async (tx) => {
          tx.update(doc(db, 'customers', cust.id), { outstandingDue: remainingDue });
          tx.set(doc(db, 'customer_ledger', entry.id), entry);
        });
      } else {
        setCustomers((prev) => prev.map((c) => (c.id === cust.id ? { ...c, outstandingDue: remainingDue } : c)));
        setCustomerLedger((prev) => [entry, ...prev]);
      }
      await appendAudit(
        params.isReversal ? 'KHATA_REVERSAL' : 'KHATA_PAYMENT',
        'customers',
        cust.id,
        `${params.isReversal ? 'Reversed' : 'Received'} ₹${params.amount} for ${cust.name}`
      );
      showToast(`Khata updated for ${cust.name}. Balance: ₹${remainingDue}`, 'success');
    },
    [customers, isStaff, appendAudit, showToast]
  );

  const upsertOffer = useCallback(
    async (offer: Offer) => {
      if (isStaff) {
        await setDoc(doc(db, 'offers', offer.id), offer, { merge: true });
      } else {
        setOffers((prev) => {
          const exists = prev.some((o) => o.id === offer.id);
          return exists ? prev.map((o) => (o.id === offer.id ? offer : o)) : [offer, ...prev];
        });
      }
      showToast(`Offer ${offer.name} saved.`, 'success');
    },
    [isStaff, showToast]
  );

  const completePosSale = useCallback(
    async (params: {
      items: SaleItem[];
      customerId: string;
      customerName: string;
      customerMobile?: string;
      itemTotal: number;
      discountTotal: number;
      couponCode?: string;
      taxableValue: number;
      cgstTotal: number;
      sgstTotal: number;
      igstTotal: number;
      totalGst: number;
      roundOff: number;
      grandTotal: number;
      customerSavings: number;
      paymentMode: PaymentMode;
      paymentSplit: PaymentSplit;
      amountPaid: number;
      balanceDue: number;
      idempotencyKey: string;
      sourceOrderId?: string;
    }) => {
      // Idempotency check in memory
      const existingLocal = sales.find((s) => s.idempotencyKey === params.idempotencyKey);
      if (existingLocal) {
        return { sale: existingLocal };
      }

      // If offline, queue safely in IndexedDB with idempotency key
      if (isOffline) {
        const queued: OfflineQueuedSale = {
          idempotencyKey: params.idempotencyKey,
          queuedAt: new Date().toISOString(),
          status: 'pending_sync',
          saleDraft: {
            idempotencyKey: params.idempotencyKey,
            customerId: params.customerId,
            customerName: params.customerName,
            customerMobile: params.customerMobile,
            cashierId: user?.uid || 'offline_cashier',
            cashierName: user?.displayName || activeRoleView,
            items: params.items,
            itemTotal: params.itemTotal,
            discountTotal: params.discountTotal,
            couponCode: params.couponCode,
            taxableValue: params.taxableValue,
            cgstTotal: params.cgstTotal,
            sgstTotal: params.sgstTotal,
            igstTotal: params.igstTotal,
            totalGst: params.totalGst,
            roundOff: params.roundOff,
            grandTotal: params.grandTotal,
            customerSavings: params.customerSavings,
            paymentMode: params.paymentMode,
            paymentSplit: params.paymentSplit,
            amountPaid: params.amountPaid,
            balanceDue: params.balanceDue,
            status: 'completed',
            source: params.sourceOrderId ? 'online_converted' : 'pos',
            syncedFromOffline: true,
            createdAt: new Date().toISOString(),
            isDemo: !isStaff,
          },
        };
        await enqueueOfflineSale(queued);
        const list = await listOfflineSales();
        setOfflineQueue(list);
        const tempSale: Sale = {
          ...queued.saleDraft,
          id: makeId('offline_sale'),
          invoiceNo: `OFFLINE-${params.idempotencyKey.slice(-6).toUpperCase()}`,
        };
        showToast('Offline Mode: Bill queued as Pending Sync in IndexedDB.', 'info');
        return { sale: tempSale, queuedOffline: true };
      }

      const saleId = makeId('sale');
      const nowIso = new Date().toISOString();

      if (isStaff) {
        // Check idempotency in Firestore
        const dupSnap = await getDocs(
          query(collection(db, 'sales'), where('idempotencyKey', '==', params.idempotencyKey))
        );
        if (!dupSnap.empty) {
          return { sale: dupSnap.docs[0].data() as Sale };
        }

        let createdSale!: Sale;
        await runTransaction(db, async (tx) => {
          const settingsRef = doc(db, 'store_settings', 'main');
          const settingsSnap = await tx.get(settingsRef);
          const currentSeq = settingsSnap.exists()
            ? (settingsSnap.data() as StoreSettings).invoiceSequence || 1001
            : storeSettings.invoiceSequence;
          const prefix = settingsSnap.exists()
            ? (settingsSnap.data() as StoreSettings).invoicePrefix || 'RKMM'
            : storeSettings.invoicePrefix;
          const invoiceNo = `${prefix}-${currentSeq}`;

          let sourceOrderAlreadyReserved = false;
          if (params.sourceOrderId) {
            const ordRef = doc(db, 'online_orders', params.sourceOrderId);
            const ordSnap = await tx.get(ordRef);
            if (ordSnap.exists()) {
              const ord = ordSnap.data() as OnlineOrder;
              if (ord.convertedInvoiceNo) {
                throw new Error(`Order ${ord.orderNo} already converted to invoice ${ord.convertedInvoiceNo}`);
              }
              sourceOrderAlreadyReserved = Boolean(ord.stockReserved);
              tx.update(ordRef, {
                convertedInvoiceNo: invoiceNo,
                status: ord.status === 'new' ? 'confirmed' : ord.status,
                updatedAt: nowIso,
              });
            }
          }

          for (const item of params.items) {
            const pRef = doc(db, 'products', item.productId);
            const pSnap = await tx.get(pRef);
            if (!pSnap.exists()) throw new Error(`Product ${item.nameEn} not found`);
            const pData = pSnap.data() as Product;
            if (!sourceOrderAlreadyReserved) {
              if (pData.currentStock < item.qty) {
                throw new Error(`Insufficient stock for ${pData.nameEn}. Available: ${pData.currentStock}`);
              }
              const nextStock = round2(pData.currentStock - item.qty);
              tx.update(pRef, { currentStock: nextStock, updatedAt: nowIso });
              const movId = makeId('mov');
              tx.set(doc(db, 'inventory_movements', movId), {
                id: movId,
                productId: item.productId,
                productName: item.nameEn,
                type: params.sourceOrderId ? 'online_order' : 'pos_sale',
                previousStock: pData.currentStock,
                stockIn: 0,
                stockOut: item.qty,
                newStock: nextStock,
                reason: `Invoice ${invoiceNo}`,
                referenceNo: invoiceNo,
                staffName: user?.displayName || activeRoleView,
                createdAt: nowIso,
                isDemo: false,
              } satisfies InventoryMovement);
            } else {
              // Stock was already deducted/reserved on confirmation: release reservation only (never double-deduct!)
              tx.update(pRef, {
                reservedStock: Math.max(0, round2((pData.reservedStock || 0) - item.qty)),
                updatedAt: nowIso,
              });
            }
          }

          if (params.customerId !== 'walkin') {
            const cRef = doc(db, 'customers', params.customerId);
            const cSnap = await tx.get(cRef);
            if (cSnap.exists()) {
              const cust = cSnap.data() as Customer;
              const earnedPoints = Math.floor(
                (params.grandTotal / 100) * (storeSettings.loyaltyPointsPer100 || 2)
              );
              const nextDue = round2(cust.outstandingDue + (params.paymentSplit.creditKhata || 0));
              if (params.paymentSplit.creditKhata > 0 && nextDue > cust.creditLimit) {
                throw new Error(`Credit limit ₹${cust.creditLimit} exceeded for ${cust.name}`);
              }
              tx.update(cRef, {
                totalPurchase: round2(cust.totalPurchase + params.grandTotal),
                totalOrders: cust.totalOrders + 1,
                loyaltyPoints: cust.loyaltyPoints + earnedPoints,
                lastPurchase: nowIso.slice(0, 10),
                outstandingDue: nextDue,
              });
              if (params.paymentSplit.creditKhata > 0) {
                const cledId = makeId('cled');
                tx.set(doc(db, 'customer_ledger', cledId), {
                  id: cledId,
                  customerId: cust.id,
                  customerName: cust.name,
                  invoiceNo,
                  entryType: 'credit_sale',
                  previousBalance: cust.outstandingDue,
                  creditAdded: params.paymentSplit.creditKhata,
                  paymentReceived: 0,
                  remainingDue: nextDue,
                  paymentMode: 'credit_khata',
                  notes: `POS Credit Bill ${invoiceNo}`,
                  createdAt: nowIso,
                  isDemo: false,
                } satisfies CustomerLedgerEntry);
              }
            }
          }

          createdSale = {
            id: saleId,
            invoiceNo,
            idempotencyKey: params.idempotencyKey,
            customerId: params.customerId,
            customerName: params.customerName,
            customerMobile: params.customerMobile,
            cashierId: user?.uid || 'staff',
            cashierName: user?.displayName || activeRoleView,
            items: params.items,
            itemTotal: params.itemTotal,
            discountTotal: params.discountTotal,
            couponCode: params.couponCode,
            taxableValue: params.taxableValue,
            cgstTotal: params.cgstTotal,
            sgstTotal: params.sgstTotal,
            igstTotal: params.igstTotal,
            totalGst: params.totalGst,
            roundOff: params.roundOff,
            grandTotal: params.grandTotal,
            customerSavings: params.customerSavings,
            paymentMode: params.paymentMode,
            paymentSplit: params.paymentSplit,
            amountPaid: params.amountPaid,
            balanceDue: params.balanceDue,
            status: 'completed',
            source: params.sourceOrderId ? 'online_converted' : 'pos',
            createdAt: nowIso,
            isDemo: false,
          };
          tx.set(doc(db, 'sales', saleId), createdSale);
          if (settingsSnap.exists()) {
            tx.update(settingsRef, { invoiceSequence: currentSeq + 1 });
          } else {
            tx.set(settingsRef, { ...storeSettings, invoiceSequence: currentSeq + 1 });
          }
        });

        await appendAudit('POS_SALE', 'sales', createdSale.id, `Invoice ${createdSale.invoiceNo} ₹${createdSale.grandTotal}`);
        showToast(`Invoice ${createdSale.invoiceNo} generated!`, 'success');
        return { sale: createdSale };
      }

      // Demo sandbox atomic transaction
      const sourceOrder = params.sourceOrderId
        ? onlineOrders.find((o) => o.id === params.sourceOrderId)
        : undefined;
      if (sourceOrder?.convertedInvoiceNo) {
        throw new Error(`Order already converted to ${sourceOrder.convertedInvoiceNo}`);
      }
      const alreadyReserved = Boolean(sourceOrder?.stockReserved);

      if (!alreadyReserved) {
        for (const item of params.items) {
          const p = products.find((x) => x.id === item.productId);
          if (!p || p.currentStock < item.qty) {
            throw new Error(`Insufficient stock for ${item.nameEn}`);
          }
        }
      }

      const invoiceNo = `${storeSettings.invoicePrefix}-${storeSettings.invoiceSequence}`;
      const createdSale: Sale = {
        id: saleId,
        invoiceNo,
        idempotencyKey: params.idempotencyKey,
        customerId: params.customerId,
        customerName: params.customerName,
        customerMobile: params.customerMobile,
        cashierId: 'demo_cashier',
        cashierName: activeRoleView,
        items: params.items,
        itemTotal: params.itemTotal,
        discountTotal: params.discountTotal,
        couponCode: params.couponCode,
        taxableValue: params.taxableValue,
        cgstTotal: params.cgstTotal,
        sgstTotal: params.sgstTotal,
        igstTotal: params.igstTotal,
        totalGst: params.totalGst,
        roundOff: params.roundOff,
        grandTotal: params.grandTotal,
        customerSavings: params.customerSavings,
        paymentMode: params.paymentMode,
        paymentSplit: params.paymentSplit,
        amountPaid: params.amountPaid,
        balanceDue: params.balanceDue,
        status: 'completed',
        source: params.sourceOrderId ? 'online_converted' : 'pos',
        createdAt: nowIso,
        isDemo: true,
      };

      const newMovs: InventoryMovement[] = [];
      setProducts((prev) =>
        prev.map((p) => {
          const it = params.items.find((x) => x.productId === p.id);
          if (!it) return p;
          if (alreadyReserved) {
            return { ...p, reservedStock: Math.max(0, round2((p.reservedStock || 0) - it.qty)) };
          }
          const nextStock = round2(p.currentStock - it.qty);
          newMovs.push({
            id: makeId('mov'),
            productId: p.id,
            productName: p.nameEn,
            type: params.sourceOrderId ? 'online_order' : 'pos_sale',
            previousStock: p.currentStock,
            stockIn: 0,
            stockOut: it.qty,
            newStock: nextStock,
            reason: `Invoice ${invoiceNo}`,
            referenceNo: invoiceNo,
            staffName: activeRoleView,
            createdAt: nowIso,
            isDemo: true,
          });
          return { ...p, currentStock: nextStock };
        })
      );
      if (newMovs.length > 0) {
        setMovements((prev) => [...newMovs, ...prev]);
      }

      if (params.customerId !== 'walkin') {
        const cust = customers.find((c) => c.id === params.customerId);
        if (cust) {
          const nextDue = round2(cust.outstandingDue + (params.paymentSplit.creditKhata || 0));
          const earned = Math.floor((params.grandTotal / 100) * storeSettings.loyaltyPointsPer100);
          setCustomers((prev) =>
            prev.map((c) =>
              c.id === cust.id
                ? {
                    ...c,
                    totalPurchase: round2(c.totalPurchase + params.grandTotal),
                    totalOrders: c.totalOrders + 1,
                    loyaltyPoints: c.loyaltyPoints + earned,
                    lastPurchase: nowIso.slice(0, 10),
                    outstandingDue: nextDue,
                  }
                : c
            )
          );
          if (params.paymentSplit.creditKhata > 0) {
            setCustomerLedger((prev) => [
              {
                id: makeId('cled'),
                customerId: cust.id,
                customerName: cust.name,
                invoiceNo,
                entryType: 'credit_sale',
                previousBalance: cust.outstandingDue,
                creditAdded: params.paymentSplit.creditKhata,
                paymentReceived: 0,
                remainingDue: nextDue,
                paymentMode: 'credit_khata',
                notes: `POS Credit Bill ${invoiceNo}`,
                createdAt: nowIso,
                isDemo: true,
              },
              ...prev,
            ]);
          }
        }
      }

      if (params.sourceOrderId) {
        setOnlineOrders((prev) =>
          prev.map((o) => (o.id === params.sourceOrderId ? { ...o, convertedInvoiceNo: invoiceNo } : o))
        );
      }

      setStoreSettings((prev) => ({ ...prev, invoiceSequence: prev.invoiceSequence + 1 }));
      setSales((prev) => [createdSale, ...prev]);
      await appendAudit('POS_SALE', 'sales', createdSale.id, `Invoice ${invoiceNo} ₹${createdSale.grandTotal}`, true);
      showToast(`Invoice ${invoiceNo} generated!`, 'success');
      return { sale: createdSale };
    },
    [
      sales,
      isOffline,
      user,
      activeRoleView,
      isStaff,
      storeSettings,
      onlineOrders,
      products,
      customers,
      appendAudit,
      showToast,
    ]
  );

  const syncOfflineQueue = useCallback(async () => {
    const pending = await listOfflineSales();
    let synced = 0;
    let conflicts = 0;
    for (const entry of pending) {
      if (entry.status === 'synced') continue;
      // Check stock conflicts before replay
      let conflictMsg = '';
      for (const item of entry.saleDraft.items) {
        const prod = products.find((p) => p.id === item.productId);
        if (!prod || prod.currentStock < item.qty) {
          conflictMsg = `Stock conflict on ${item.nameEn} (Available: ${prod?.currentStock ?? 0}, Needed: ${item.qty})`;
          break;
        }
      }
      if (conflictMsg) {
        await enqueueOfflineSale({ ...entry, status: 'conflict_review', conflictReason: conflictMsg });
        conflicts += 1;
        continue;
      }
      try {
        await completePosSale({
          ...entry.saleDraft,
          idempotencyKey: entry.idempotencyKey,
        });
        await removeOfflineSale(entry.idempotencyKey);
        synced += 1;
      } catch (err) {
        await enqueueOfflineSale({
          ...entry,
          status: 'conflict_review',
          conflictReason: err instanceof Error ? err.message : 'Sync failed',
        });
        conflicts += 1;
      }
    }
    setOfflineQueue(await listOfflineSales());
    showToast(`Synced ${synced} bill(s), ${conflicts} conflict(s) flagged.`, conflicts > 0 ? 'error' : 'success');
    return { synced, conflicts };
  }, [products, completePosSale, showToast]);

  const refundSale = useCallback(
    async (saleId: string, reason: string) => {
      const target = sales.find((s) => s.id === saleId);
      if (!target || target.status === 'refunded') return;
      const nowIso = new Date().toISOString();

      if (isStaff) {
        await runTransaction(db, async (tx) => {
          tx.update(doc(db, 'sales', saleId), {
            status: 'refunded',
            refundedAmount: target.grandTotal,
            updatedAt: nowIso,
          });
          for (const item of target.items) {
            const pRef = doc(db, 'products', item.productId);
            const pSnap = await tx.get(pRef);
            if (pSnap.exists()) {
              const cur = (pSnap.data() as Product).currentStock;
              const next = round2(cur + item.qty);
              tx.update(pRef, { currentStock: next, updatedAt: nowIso });
              const movId = makeId('mov');
              tx.set(doc(db, 'inventory_movements', movId), {
                id: movId,
                productId: item.productId,
                productName: item.nameEn,
                type: 'customer_return',
                previousStock: cur,
                stockIn: item.qty,
                stockOut: 0,
                newStock: next,
                reason: `Refund for ${target.invoiceNo}: ${reason}`,
                referenceNo: target.invoiceNo,
                staffName: user?.displayName || activeRoleView,
                createdAt: nowIso,
                isDemo: false,
              } satisfies InventoryMovement);
            }
          }
          if (target.customerId !== 'walkin' && (target.paymentSplit?.creditKhata || 0) > 0) {
            const cRef = doc(db, 'customers', target.customerId);
            const cSnap = await tx.get(cRef);
            if (cSnap.exists()) {
              const cust = cSnap.data() as Customer;
              const nextDue = round2(Math.max(0, cust.outstandingDue - target.paymentSplit.creditKhata));
              tx.update(cRef, { outstandingDue: nextDue });
              const cledId = makeId('cled');
              tx.set(doc(db, 'customer_ledger', cledId), {
                id: cledId,
                customerId: cust.id,
                customerName: cust.name,
                invoiceNo: target.invoiceNo,
                entryType: 'reversal',
                previousBalance: cust.outstandingDue,
                creditAdded: 0,
                paymentReceived: target.paymentSplit.creditKhata,
                remainingDue: nextDue,
                paymentMode: 'reversal',
                notes: `Invoice ${target.invoiceNo} refunded: ${reason}`,
                createdAt: nowIso,
                isDemo: false,
              } satisfies CustomerLedgerEntry);
            }
          }
        });
      } else {
        setSales((prev) =>
          prev.map((s) => (s.id === saleId ? { ...s, status: 'refunded', refundedAmount: s.grandTotal } : s))
        );
        const newMovs: InventoryMovement[] = [];
        setProducts((prev) =>
          prev.map((p) => {
            const it = target.items.find((x) => x.productId === p.id);
            if (!it) return p;
            const next = round2(p.currentStock + it.qty);
            newMovs.push({
              id: makeId('mov'),
              productId: p.id,
              productName: p.nameEn,
              type: 'customer_return',
              previousStock: p.currentStock,
              stockIn: it.qty,
              stockOut: 0,
              newStock: next,
              reason: `Refund for ${target.invoiceNo}: ${reason}`,
              referenceNo: target.invoiceNo,
              staffName: activeRoleView,
              createdAt: nowIso,
              isDemo: true,
            });
            return { ...p, currentStock: next };
          })
        );
        setMovements((prev) => [...newMovs, ...prev]);
      }

      await appendAudit('SALE_REFUND', 'sales', saleId, `Refunded ${target.invoiceNo} (₹${target.grandTotal}): ${reason}`);
      showToast(`Invoice ${target.invoiceNo} refunded via reversal transaction.`, 'info');
    },
    [sales, isStaff, user, activeRoleView, appendAudit, showToast]
  );

  const createOnlineOrder = useCallback(
    async (draft: Omit<OnlineOrder, 'id' | 'orderNo' | 'status' | 'createdAt'>) => {
      // Server/client stock check to prevent overselling
      for (const item of draft.items) {
        const prod = products.find((p) => p.id === item.productId);
        const available = (prod?.currentStock || 0) - (prod?.reservedStock || 0);
        if (!prod || available < item.qty) {
          throw new Error(`Insufficient stock for ${item.nameEn}. Available: ${Math.max(0, available)}`);
        }
      }

      const order: OnlineOrder = {
        ...draft,
        id: makeId('ord'),
        orderNo: `ORD-${Date.now().toString().slice(-6)}`,
        status: 'new',
        customerUid: user?.uid,
        stockReserved: false,
        createdAt: new Date().toISOString(),
        isDemo: !isCloudLive,
      };

      if (isCloudLive && user?.emailVerified) {
        await setDoc(doc(db, 'online_orders', order.id), order);
      } else {
        setOnlineOrders((prev) => [order, ...prev]);
      }
      showToast(`Order ${order.orderNo} placed successfully!`, 'success');
      return order;
    },
    [products, user, isCloudLive, showToast]
  );

  const updateOnlineOrderStatus = useCallback(
    async (
      orderId: string,
      nextStatus: OrderStatus,
      extra?: {
        assignedDeliveryStaffId?: string;
        assignedDeliveryStaffName?: string;
        proofOfDelivery?: string;
        failedReason?: string;
        convertedInvoiceNo?: string;
      }
    ) => {
      const ord = onlineOrders.find((o) => o.id === orderId);
      if (!ord) return;
      const nowIso = new Date().toISOString();

      // Handle stock reservation when confirming, and release when cancelling!
      const shouldReserve = nextStatus === 'confirmed' && storeSettings.reserveOnlineStock && !ord.stockReserved;
      const shouldRelease = (nextStatus === 'cancelled' || nextStatus === 'returned') && ord.stockReserved;

      if (isStaff) {
        await runTransaction(db, async (tx) => {
          if (shouldReserve || shouldRelease) {
            for (const item of ord.items) {
              const pRef = doc(db, 'products', item.productId);
              const pSnap = await tx.get(pRef);
              if (pSnap.exists()) {
                const pData = pSnap.data() as Product;
                if (shouldReserve) {
                  if (pData.currentStock < item.qty) {
                    throw new Error(`Cannot confirm: ${pData.nameEn} has only ${pData.currentStock} left.`);
                  }
                  const nextStock = round2(pData.currentStock - item.qty);
                  tx.update(pRef, {
                    currentStock: nextStock,
                    reservedStock: round2((pData.reservedStock || 0) + item.qty),
                    updatedAt: nowIso,
                  });
                } else if (shouldRelease) {
                  tx.update(pRef, {
                    currentStock: round2(pData.currentStock + item.qty),
                    reservedStock: Math.max(0, round2((pData.reservedStock || 0) - item.qty)),
                    updatedAt: nowIso,
                  });
                }
              }
            }
          }
          tx.update(doc(db, 'online_orders', orderId), {
            status: nextStatus,
            stockReserved: shouldReserve ? true : shouldRelease ? false : ord.stockReserved,
            ...(extra || {}),
            ...(nextStatus === 'delivered' ? { deliveredAt: nowIso } : {}),
            updatedAt: nowIso,
          });
        });
      } else {
        if (shouldReserve || shouldRelease) {
          setProducts((prev) =>
            prev.map((p) => {
              const it = ord.items.find((x) => x.productId === p.id);
              if (!it) return p;
              if (shouldReserve) {
                return {
                  ...p,
                  currentStock: round2(p.currentStock - it.qty),
                  reservedStock: round2((p.reservedStock || 0) + it.qty),
                };
              }
              return {
                ...p,
                currentStock: round2(p.currentStock + it.qty),
                reservedStock: Math.max(0, round2((p.reservedStock || 0) - it.qty)),
              };
            })
          );
        }
        setOnlineOrders((prev) =>
          prev.map((o) =>
            o.id === orderId
              ? {
                  ...o,
                  status: nextStatus,
                  stockReserved: shouldReserve ? true : shouldRelease ? false : o.stockReserved,
                  ...(extra || {}),
                  ...(nextStatus === 'delivered' ? { deliveredAt: nowIso } : {}),
                  updatedAt: nowIso,
                }
              : o
          )
        );
      }

      await appendAudit('ONLINE_ORDER_STATUS', 'online_orders', orderId, `Order ${ord.orderNo} -> ${nextStatus}`);
      showToast(`Order ${ord.orderNo} updated to ${nextStatus}.`, 'success');
    },
    [onlineOrders, storeSettings.reserveOnlineStock, isStaff, appendAudit, showToast]
  );

  const upsertStaff = useCallback(
    async (member: StaffMember) => {
      if (isStaff) {
        await setDoc(doc(db, 'staff', member.id), member, { merge: true });
      } else {
        setStaff((prev) => {
          const exists = prev.some((s) => s.id === member.id);
          return exists ? prev.map((s) => (s.id === member.id ? member : s)) : [member, ...prev];
        });
      }
      showToast(`Staff profile ${member.fullName} saved.`, 'success');
    },
    [isStaff, showToast]
  );

  const assignStaffAuthRole = useCallback(
    async (uid: string, email: string, role: Exclude<StaffRole, 'customer'>, staffId: string) => {
      if (!isStaff || !['owner', 'super_admin'].includes(actualRole)) {
        showToast('Only Owner can assign live Firebase Auth roles.', 'error');
        return;
      }
      await setDoc(doc(db, 'staff_roles', uid), { uid, email, role, staffId, active: true });
      await appendAudit('ASSIGN_ROLE', 'staff_roles', uid, `Assigned ${role} to ${email}`);
      showToast(`Assigned ${role} to ${email}.`, 'success');
    },
    [isStaff, actualRole, appendAudit, showToast]
  );

  const recordAttendance = useCallback(
    async (record: AttendanceRecord) => {
      if (isStaff) {
        await setDoc(doc(db, 'attendance', record.id), record, { merge: true });
      } else {
        setAttendance((prev) => {
          const exists = prev.some((a) => a.id === record.id);
          return exists ? prev.map((a) => (a.id === record.id ? record : a)) : [record, ...prev];
        });
      }
      showToast(`Attendance marked for ${record.staffName}.`, 'success');
    },
    [isStaff, showToast]
  );

  const createPayroll = useCallback(
    async (record: PayrollRecord) => {
      if (isStaff) {
        await setDoc(doc(db, 'payroll', record.id), record, { merge: true });
      } else {
        setPayroll((prev) => [record, ...prev]);
      }
      showToast(`Salary slip generated for ${record.staffName}.`, 'success');
    },
    [isStaff, showToast]
  );

  const recordExpense = useCallback(
    async (expense: Expense) => {
      if (isStaff) {
        await setDoc(doc(db, 'expenses', expense.id), expense, { merge: true });
      } else {
        setExpenses((prev) => [expense, ...prev]);
      }
      await appendAudit('RECORD_EXPENSE', 'expenses', expense.id, `${expense.category}: ₹${expense.amount}`);
      showToast(`Expense ₹${expense.amount} recorded.`, 'success');
    },
    [isStaff, appendAudit, showToast]
  );

  const saveCashRegister = useCallback(
    async (reg: CashRegister) => {
      if (isStaff) {
        await setDoc(doc(db, 'cash_registers', reg.id), reg, { merge: true });
      } else {
        setCashRegisters((prev) => {
          const exists = prev.some((r) => r.id === reg.id);
          return exists ? prev.map((r) => (r.id === reg.id ? reg : r)) : [reg, ...prev];
        });
      }
      await appendAudit('CASH_CLOSING', 'cash_registers', reg.id, `Closing cash ₹${reg.countedClosingCash}`);
      showToast(`Daily cash register ${reg.date} saved.`, 'success');
    },
    [isStaff, appendAudit, showToast]
  );

  const dispatchNotification = useCallback(
    async (params: { channel: 'whatsapp' | 'sms' | 'email'; recipient: string; trigger: string; body: string }) => {
      let status: MessageLog['status'] = 'failed_not_configured';
      let providerResponse = 'Not signed in — live Cloud API dispatch requires authentication.';

      if (user) {
        try {
          const token = await user.getIdToken();
          const res = await fetch('/api/notifications/dispatch', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              channel: params.channel,
              recipient: params.recipient,
              message: params.body,
              templateName: params.trigger,
            }),
          });
          const data = await res.json();
          status = data.status || (res.ok ? 'sent' : 'failed');
          providerResponse = data.providerResponse || data.error || `HTTP ${res.status}`;
        } catch (err) {
          status = 'failed';
          providerResponse = err instanceof Error ? err.message : 'Network error';
        }
      }

      const log: MessageLog = {
        id: makeId('msg'),
        channel: params.channel,
        recipient: params.recipient,
        trigger: params.trigger,
        body: params.body,
        status,
        providerResponse,
        createdAt: new Date().toISOString(),
        isDemo: !isStaff,
      };
      if (isStaff) {
        await setDoc(doc(db, 'message_logs', log.id), log);
      } else {
        setMessageLogs((prev) => [log, ...prev]);
      }
      showToast(
        status === 'sent' ? 'Message dispatched via provider.' : `Provider response: ${status}`,
        status === 'sent' ? 'success' : 'info'
      );
      return log;
    },
    [user, isStaff, showToast]
  );

  const seedDemoDataToCloud = useCallback(async () => {
    if (!isStaff || !['owner', 'super_admin'].includes(actualRole)) {
      showToast('Sign in as Owner to seed demo data into Firestore.', 'error');
      return;
    }
    const batch = writeBatch(db);
    batch.set(doc(db, 'store_settings', 'main'), storeSettings, { merge: true });
    DEMO_PRODUCTS.forEach((x) => batch.set(doc(db, 'products', x.id), x));
    DEMO_SUPPLIERS.forEach((x) => batch.set(doc(db, 'suppliers', x.id), x));
    DEMO_PURCHASES.forEach((x) => batch.set(doc(db, 'purchases', x.id), x));
    DEMO_SUPPLIER_LEDGER.forEach((x) => batch.set(doc(db, 'supplier_ledger', x.id), x));
    DEMO_CUSTOMERS.forEach((x) => batch.set(doc(db, 'customers', x.id), x));
    DEMO_CUSTOMER_LEDGER.forEach((x) => batch.set(doc(db, 'customer_ledger', x.id), x));
    DEMO_OFFERS.forEach((x) => batch.set(doc(db, 'offers', x.id), x));
    DEMO_SALES.forEach((x) => batch.set(doc(db, 'sales', x.id), x));
    DEMO_ONLINE_ORDERS.forEach((x) => batch.set(doc(db, 'online_orders', x.id), x));
    DEMO_STAFF.forEach((x) => batch.set(doc(db, 'staff', x.id), x));
    DEMO_ATTENDANCE.forEach((x) => batch.set(doc(db, 'attendance', x.id), x));
    DEMO_PAYROLL.forEach((x) => batch.set(doc(db, 'payroll', x.id), x));
    DEMO_EXPENSES.forEach((x) => batch.set(doc(db, 'expenses', x.id), x));
    DEMO_CASH_REGISTERS.forEach((x) => batch.set(doc(db, 'cash_registers', x.id), x));
    DEMO_MOVEMENTS.forEach((x) => batch.set(doc(db, 'inventory_movements', x.id), x));
    DEMO_MESSAGE_LOGS.forEach((x) => batch.set(doc(db, 'message_logs', x.id), x));
    await batch.commit();
    await appendAudit('SEED_DEMO_CLOUD', 'system', 'demo_seed', 'Owner seeded 20 demo products & sample ERP data to Firestore', true);
    showToast('All 20 demo products & sample ERP records seeded to Cloud Firestore!', 'success');
  }, [isStaff, actualRole, storeSettings, appendAudit, showToast]);

  const purgeDemoDataFromCloud = useCallback(async () => {
    const collections = [
      'products',
      'suppliers',
      'purchases',
      'supplier_ledger',
      'customers',
      'customer_ledger',
      'offers',
      'sales',
      'online_orders',
      'staff',
      'attendance',
      'payroll',
      'expenses',
      'cash_registers',
      'inventory_movements',
      'message_logs',
    ];
    let removed = 0;

    if (isStaff && ['owner', 'super_admin'].includes(actualRole)) {
      for (const colName of collections) {
        const snap = await getDocs(query(collection(db, colName), where('isDemo', '==', true)));
        if (!snap.empty) {
          const batch = writeBatch(db);
          snap.docs.forEach((d) => {
            batch.delete(d.ref);
            removed += 1;
          });
          await batch.commit();
        }
      }
      await setDoc(doc(db, 'store_settings', 'main'), { ...storeSettings, demoModeActive: false }, { merge: true });
      await appendAudit('PURGE_DEMO_DATA', 'system', 'demo_purge', `Safely removed ${removed} DEMO records without touching live records`);
    } else {
      removed += products.filter((x) => x.isDemo).length;
      setProducts((prev) => prev.filter((x) => !x.isDemo));
      setMovements((prev) => prev.filter((x) => !x.isDemo));
      setSuppliers((prev) => prev.filter((x) => !x.isDemo));
      setPurchases((prev) => prev.filter((x) => !x.isDemo));
      setSupplierLedger((prev) => prev.filter((x) => !x.isDemo));
      setCustomers((prev) => prev.filter((x) => !x.isDemo));
      setCustomerLedger((prev) => prev.filter((x) => !x.isDemo));
      setOffers((prev) => prev.filter((x) => !x.isDemo));
      setSales((prev) => prev.filter((x) => !x.isDemo));
      setOnlineOrders((prev) => prev.filter((x) => !x.isDemo));
      setStaff((prev) => prev.filter((x) => !x.isDemo));
      setAttendance((prev) => prev.filter((x) => !x.isDemo));
      setPayroll((prev) => prev.filter((x) => !x.isDemo));
      setExpenses((prev) => prev.filter((x) => !x.isDemo));
      setCashRegisters((prev) => prev.filter((x) => !x.isDemo));
      setMessageLogs((prev) => prev.filter((x) => !x.isDemo));
      setStoreSettings((prev) => ({ ...prev, demoModeActive: false }));
    }

    showToast(`Removed ${removed} DEMO entries. All live business records are untouched.`, 'success');
    return removed;
  }, [isStaff, actualRole, storeSettings, products, appendAudit, showToast]);

  const exportBackupJson = useCallback(() => {
    return JSON.stringify(
      {
        exportedAt: new Date().toISOString(),
        business: storeSettings.nameEn,
        storeSettings,
        products,
        movements,
        suppliers,
        purchases,
        supplierLedger,
        customers,
        customerLedger,
        offers,
        sales,
        onlineOrders,
        staff,
        attendance,
        payroll,
        expenses,
        cashRegisters,
        auditLogs,
      },
      null,
      2
    );
  }, [
    storeSettings,
    products,
    movements,
    suppliers,
    purchases,
    supplierLedger,
    customers,
    customerLedger,
    offers,
    sales,
    onlineOrders,
    staff,
    attendance,
    payroll,
    expenses,
    cashRegisters,
    auditLogs,
  ]);

  const value = useMemo<MallContextValue>(
    () => ({
      language,
      setLanguage,
      darkMode,
      toggleDarkMode,
      appMode,
      setAppMode,
      user,
      authLoading,
      isCloudLive,
      actualRole,
      activeRoleView,
      setActiveRoleView,
      hasPermission,
      signInWithGoogle,
      signOut,
      reportFilterMode,
      setReportFilterMode,
      isOffline,
      simulatedOffline,
      setSimulatedOffline,
      offlineQueue,
      syncOfflineQueue,
      storeSettings,
      products,
      movements,
      suppliers,
      purchases,
      supplierLedger,
      customers,
      customerLedger,
      offers,
      sales,
      onlineOrders,
      staff,
      attendance,
      payroll,
      expenses,
      cashRegisters,
      messageTemplates,
      setMessageTemplates,
      messageLogs,
      auditLogs,
      saveStoreSettings,
      upsertProduct,
      archiveProduct,
      bulkImportProducts,
      adjustStock,
      recordPurchase,
      recordSupplierPayment,
      upsertCustomer,
      recordCustomerKhataPayment,
      upsertOffer,
      completePosSale,
      refundSale,
      createOnlineOrder,
      updateOnlineOrderStatus,
      upsertStaff,
      assignStaffAuthRole,
      recordAttendance,
      createPayroll,
      recordExpense,
      saveCashRegister,
      dispatchNotification,
      seedDemoDataToCloud,
      purgeDemoDataFromCloud,
      exportBackupJson,
      toast,
      showToast,
    }),
    [
      language,
      darkMode,
      toggleDarkMode,
      appMode,
      user,
      authLoading,
      isCloudLive,
      actualRole,
      activeRoleView,
      hasPermission,
      signInWithGoogle,
      signOut,
      reportFilterMode,
      isOffline,
      simulatedOffline,
      offlineQueue,
      syncOfflineQueue,
      storeSettings,
      products,
      movements,
      suppliers,
      purchases,
      supplierLedger,
      customers,
      customerLedger,
      offers,
      sales,
      onlineOrders,
      staff,
      attendance,
      payroll,
      expenses,
      cashRegisters,
      messageTemplates,
      messageLogs,
      auditLogs,
      saveStoreSettings,
      upsertProduct,
      archiveProduct,
      bulkImportProducts,
      adjustStock,
      recordPurchase,
      recordSupplierPayment,
      upsertCustomer,
      recordCustomerKhataPayment,
      upsertOffer,
      completePosSale,
      refundSale,
      createOnlineOrder,
      updateOnlineOrderStatus,
      upsertStaff,
      assignStaffAuthRole,
      recordAttendance,
      createPayroll,
      recordExpense,
      saveCashRegister,
      dispatchNotification,
      seedDemoDataToCloud,
      purgeDemoDataFromCloud,
      exportBackupJson,
      toast,
      showToast,
    ]
  );

  return <MallContext.Provider value={value}>{children}</MallContext.Provider>;
};

export function useMall(): MallContextValue {
  const ctx = useContext(MallContext);
  if (!ctx) throw new Error('useMall must be used inside MallProvider');
  return ctx;
}
