export type Language = 'hi' | 'en';

export type StaffRole =
  | 'owner'
  | 'super_admin'
  | 'manager'
  | 'cashier'
  | 'inventory_manager'
  | 'accountant'
  | 'delivery_staff'
  | 'customer';

export type PermissionKey =
  | 'products'
  | 'billing'
  | 'discounts'
  | 'stock_adjustment'
  | 'refund_approval'
  | 'customers'
  | 'suppliers'
  | 'accounting'
  | 'reports'
  | 'staff'
  | 'settings';

export type RolePermissionMatrix = Record<Exclude<StaffRole, 'customer'>, Record<PermissionKey, boolean>>;

export type ProductUnit =
  | 'KG'
  | 'GM'
  | 'LITRE'
  | 'ML'
  | 'PCS'
  | 'PACKET'
  | 'BOX'
  | 'BOTTLE'
  | 'CARTON'
  | 'BUNDLE';

export interface StoreSettings {
  id: string;
  nameHi: string;
  nameEn: string;
  tagline: string;
  phone: string;
  whatsappPhone: string;
  address: string;
  gstin: string;
  state: string;
  email: string;
  openingHours: string;
  isOpen: boolean;
  upiId: string;
  deliveryCharge: number;
  freeDeliveryAbove: number;
  minOrderAmount: number;
  invoicePrefix: string;
  invoiceSequence: number;
  gstInclusive: boolean;
  loyaltyPointsPer100: number;
  loyaltyPointValue: number;
  reserveOnlineStock: boolean;
  demoModeActive: boolean;
  permissionMatrix?: RolePermissionMatrix;
  updatedAt?: string;
}

export interface Product {
  id: string;
  nameHi: string;
  nameEn: string;
  imageUrl: string;
  sku: string;
  barcode: string;
  qrCode?: string;
  category: string;
  subcategory: string;
  brand: string;
  manufacturer: string;
  hsnCode: string;
  gstRate: number;
  unit: ProductUnit;
  packSize: string;
  purchaseRate: number;
  mrp: number;
  sellingPrice: number;
  wholesalePrice: number;
  discountPercent: number;
  openingStock: number;
  currentStock: number;
  reservedStock: number;
  minStock: number;
  maxStock: number;
  reorderLevel: number;
  supplierId?: string;
  supplierName?: string;
  rackNumber: string;
  batchNumber: string;
  mfgDate: string;
  expiryDate: string;
  description: string;
  active: boolean;
  isDemo?: boolean;
  updatedAt?: string;
}

export type MovementType =
  | 'stock_inward'
  | 'stock_outward'
  | 'adjustment'
  | 'transfer'
  | 'customer_return'
  | 'supplier_return'
  | 'damaged'
  | 'pos_sale'
  | 'online_order'
  | 'online_reservation';

export interface InventoryMovement {
  id: string;
  productId: string;
  productName: string;
  type: MovementType;
  previousStock: number;
  stockIn: number;
  stockOut: number;
  newStock: number;
  batchNumber?: string;
  reason: string;
  referenceNo: string;
  staffName: string;
  createdAt: string;
  isDemo?: boolean;
}

export interface Supplier {
  id: string;
  businessName: string;
  contactPerson: string;
  mobile: string;
  whatsapp: string;
  gstin: string;
  address: string;
  openingBalance: number;
  creditTermsDays: number;
  currentBalance: number;
  isDemo?: boolean;
}

export interface PurchaseItem {
  productId: string;
  productName: string;
  qty: number;
  unit: ProductUnit;
  rate: number;
  gstRate: number;
  total: number;
  batchNumber?: string;
  expiryDate?: string;
}

export interface Purchase {
  id: string;
  supplierId: string;
  supplierName: string;
  poNumber: string;
  grnNumber: string;
  invoiceNo: string;
  status: 'po_created' | 'partially_received' | 'received_inward' | 'returned';
  items: PurchaseItem[];
  totalAmount: number;
  paidAmount: number;
  dueAmount: number;
  paymentMode: string;
  notes?: string;
  createdAt: string;
  isDemo?: boolean;
}

export interface SupplierLedgerEntry {
  id: string;
  supplierId: string;
  supplierName: string;
  entryType: 'purchase_invoice' | 'payment' | 'purchase_return' | 'reversal';
  referenceNo: string;
  previousBalance: number;
  debitAmount: number;
  creditAmount: number;
  remainingDue: number;
  paymentMode?: string;
  notes?: string;
  createdAt: string;
  isDemo?: boolean;
}

export interface Customer {
  id: string;
  name: string;
  mobile: string;
  whatsapp: string;
  email: string;
  address: string;
  area: string;
  birthday?: string;
  anniversary?: string;
  registrationDate: string;
  membershipTier: 'Standard' | 'Silver' | 'Gold' | 'Platinum';
  loyaltyPoints: number;
  totalPurchase: number;
  totalOrders: number;
  lastPurchase?: string;
  outstandingDue: number;
  creditLimit: number;
  marketingConsent: boolean;
  status: 'active' | 'archived';
  isDemo?: boolean;
}

export interface CustomerLedgerEntry {
  id: string;
  customerId: string;
  customerName: string;
  invoiceNo: string;
  entryType: 'credit_sale' | 'payment_received' | 'reversal';
  previousBalance: number;
  creditAdded: number;
  paymentReceived: number;
  remainingDue: number;
  paymentMode: string;
  dueDate?: string;
  notes: string;
  createdAt: string;
  isDemo?: boolean;
}

export type OfferType =
  | 'flat_discount'
  | 'percentage_discount'
  | 'bogo'
  | 'buy2_get1'
  | 'combo'
  | 'category_offer'
  | 'product_offer'
  | 'brand_offer'
  | 'membership_discount'
  | 'weekend_deal'
  | 'festival_deal'
  | 'min_cart_discount';

export interface Offer {
  id: string;
  name: string;
  couponCode: string;
  description: string;
  offerType: OfferType;
  discountValue: number;
  maxDiscount: number;
  minPurchase: number;
  eligibleCategories?: string[];
  eligibleProductIds?: string[];
  startDate: string;
  endDate: string;
  usageLimit: number;
  usedCount: number;
  stackable: boolean;
  active: boolean;
  isDemo?: boolean;
}

export type PaymentMode =
  | 'cash'
  | 'upi'
  | 'qr'
  | 'debit_card'
  | 'credit_card'
  | 'split'
  | 'credit_khata';

export interface SaleItem {
  productId: string;
  nameHi: string;
  nameEn: string;
  sku: string;
  unit: ProductUnit;
  qty: number;
  mrp: number;
  sellingPrice: number;
  itemDiscountPct: number;
  gstRate: number;
  taxableValue: number;
  cgst: number;
  sgst: number;
  igst: number;
  lineTotal: number;
  purchaseRate: number;
}

export interface PaymentSplit {
  cash: number;
  upi: number;
  card: number;
  bank: number;
  creditKhata: number;
}

export interface Sale {
  id: string;
  invoiceNo: string;
  idempotencyKey: string;
  customerId: string;
  customerName: string;
  customerMobile?: string;
  cashierId: string;
  cashierName: string;
  items: SaleItem[];
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
  status: 'completed' | 'refunded' | 'partial_return';
  refundedAmount?: number;
  source: 'pos' | 'online_converted';
  syncedFromOffline?: boolean;
  createdAt: string;
  isDemo?: boolean;
}

export type OrderStatus =
  | 'new'
  | 'confirmed'
  | 'packing'
  | 'ready_for_pickup'
  | 'out_for_delivery'
  | 'delivered'
  | 'cancelled'
  | 'returned';

export interface OnlineOrder {
  id: string;
  orderNo: string;
  customerUid?: string;
  customerId?: string;
  customerName: string;
  customerMobile: string;
  deliveryAddress: string;
  area?: string;
  fulfillmentType: 'delivery' | 'pickup';
  scheduleSlot?: string;
  items: SaleItem[];
  subtotal: number;
  discountTotal: number;
  deliveryCharge: number;
  grandTotal: number;
  couponCode?: string;
  paymentMethod: 'cod' | 'upi_on_delivery' | 'store_pickup_pay';
  status: OrderStatus;
  stockReserved?: boolean;
  convertedInvoiceNo?: string;
  assignedDeliveryStaffId?: string;
  assignedDeliveryStaffName?: string;
  proofOfDelivery?: string;
  failedReason?: string;
  notes?: string;
  createdAt: string;
  updatedAt?: string;
  deliveredAt?: string;
  isDemo?: boolean;
}

export interface StaffMember {
  id: string;
  fullName: string;
  mobile: string;
  email: string;
  address: string;
  joiningDate: string;
  designation: string;
  department: string;
  salary: number;
  status: 'active' | 'on_leave' | 'inactive';
  emergencyContact: string;
  role: Exclude<StaffRole, 'customer'>;
  isDemo?: boolean;
}

export interface AttendanceRecord {
  id: string;
  staffId: string;
  staffName: string;
  date: string;
  shift: 'Morning' | 'Evening' | 'Full Day';
  checkIn?: string;
  checkOut?: string;
  lateEntry: boolean;
  overtimeHours: number;
  status: 'full_day' | 'half_day' | 'absent' | 'leave';
  isDemo?: boolean;
}

export interface PayrollRecord {
  id: string;
  staffId: string;
  staffName: string;
  month: string;
  basicSalary: number;
  allowances: number;
  overtimePay: number;
  advanceDeduction: number;
  otherDeductions: number;
  netPay: number;
  paymentDate: string;
  paymentMode: 'bank' | 'cash' | 'upi';
  status: 'paid' | 'pending';
  isDemo?: boolean;
}

export type ExpenseCategory =
  | 'Electricity'
  | 'Rent'
  | 'Salary'
  | 'Transport'
  | 'Packaging'
  | 'Repair'
  | 'Internet'
  | 'Marketing'
  | 'Maintenance'
  | 'Miscellaneous';

export interface Expense {
  id: string;
  date: string;
  category: ExpenseCategory;
  description: string;
  amount: number;
  paymentMode: 'cash' | 'upi' | 'bank';
  receiptNo?: string;
  authorizedBy: string;
  isDemo?: boolean;
}

export interface CashRegister {
  id: string;
  date: string;
  openingCash: number;
  cashSales: number;
  cashReceipts: number;
  cashRefunds: number;
  cashExpenses: number;
  cashDeposits: number;
  expectedClosingCash: number;
  countedClosingCash: number;
  difference: number;
  status: 'open' | 'closed';
  closedBy?: string;
  isDemo?: boolean;
}

export interface MessageTemplate {
  id: string;
  trigger: string;
  titleHi: string;
  titleEn: string;
  bodyHi: string;
  bodyEn: string;
  channel: 'whatsapp' | 'sms' | 'email';
}

export interface MessageLog {
  id: string;
  channel: 'whatsapp' | 'sms' | 'email';
  recipient: string;
  trigger: string;
  body: string;
  status: 'queued' | 'sent' | 'failed' | 'failed_not_configured';
  providerResponse: string;
  createdAt: string;
  isDemo?: boolean;
}

export interface AuditLog {
  id: string;
  actorUid: string;
  actorEmail: string;
  action: string;
  entityType: string;
  entityId: string;
  summary: string;
  createdAt: string;
  isDemo?: boolean;
}

export interface OfflineQueuedSale {
  idempotencyKey: string;
  queuedAt: string;
  status: 'pending_sync' | 'conflict_review' | 'synced';
  conflictReason?: string;
  saleDraft: Omit<Sale, 'id' | 'invoiceNo'>;
}
