import {
  AttendanceRecord,
  Customer,
  Expense,
  Offer,
  OnlineOrder,
  Product,
  Purchase,
  Sale,
  SaleItem,
  StaffMember,
  Supplier,
} from '../types/erp';

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export interface LineCalcInput {
  product: Product;
  qty: number;
  itemDiscountPct?: number;
  gstInclusive: boolean;
  interState?: boolean;
}

export function calculateLineItemGst(input: LineCalcInput): SaleItem {
  const { product, qty, itemDiscountPct = 0, gstInclusive, interState = false } = input;
  const safeQty = Math.max(0, qty);
  const safeDiscPct = Math.min(100, Math.max(0, itemDiscountPct));
  const unitPrice = product.sellingPrice;
  const grossLine = round2(unitPrice * safeQty);
  const discountAmount = round2((grossLine * safeDiscPct) / 100);
  const discountedLine = round2(Math.max(0, grossLine - discountAmount));
  const rate = Math.max(0, product.gstRate || 0);

  let taxableValue = discountedLine;
  let totalGst = 0;

  if (rate > 0) {
    if (gstInclusive) {
      taxableValue = round2(discountedLine / (1 + rate / 100));
      totalGst = round2(discountedLine - taxableValue);
    } else {
      taxableValue = discountedLine;
      totalGst = round2((taxableValue * rate) / 100);
    }
  }

  const cgst = interState ? 0 : round2(totalGst / 2);
  const sgst = interState ? 0 : round2(totalGst - cgst);
  const igst = interState ? totalGst : 0;
  const lineTotal = gstInclusive ? discountedLine : round2(taxableValue + totalGst);

  return {
    productId: product.id,
    nameHi: product.nameHi,
    nameEn: product.nameEn,
    sku: product.sku,
    unit: product.unit,
    qty: safeQty,
    mrp: product.mrp,
    sellingPrice: product.sellingPrice,
    itemDiscountPct: safeDiscPct,
    gstRate: rate,
    taxableValue,
    cgst,
    sgst,
    igst,
    lineTotal,
    purchaseRate: product.purchaseRate,
  };
}

export interface CartTotals {
  itemTotal: number;
  discountTotal: number;
  taxableValue: number;
  cgstTotal: number;
  sgstTotal: number;
  igstTotal: number;
  totalGst: number;
  roundOff: number;
  grandTotal: number;
  customerSavings: number;
}

export function calculateCartTotals(
  items: SaleItem[],
  extraBillDiscount = 0,
  offerDiscount = 0
): CartTotals {
  const itemTotal = round2(items.reduce((acc, it) => acc + it.sellingPrice * it.qty, 0));
  const mrpTotal = round2(items.reduce((acc, it) => acc + Math.max(it.mrp, it.sellingPrice) * it.qty, 0));
  const lineTotalsSum = round2(items.reduce((acc, it) => acc + it.lineTotal, 0));
  const lineItemDiscounts = round2(Math.max(0, itemTotal - lineTotalsSum));
  const combinedExtraDiscount = round2(Math.min(lineTotalsSum, Math.max(0, extraBillDiscount + offerDiscount)));

  const discountRatio = lineTotalsSum > 0 ? (lineTotalsSum - combinedExtraDiscount) / lineTotalsSum : 1;
  const taxableValue = round2(items.reduce((acc, it) => acc + it.taxableValue * discountRatio, 0));
  const cgstTotal = round2(items.reduce((acc, it) => acc + it.cgst * discountRatio, 0));
  const sgstTotal = round2(items.reduce((acc, it) => acc + it.sgst * discountRatio, 0));
  const igstTotal = round2(items.reduce((acc, it) => acc + it.igst * discountRatio, 0));
  const totalGst = round2(cgstTotal + sgstTotal + igstTotal);

  const rawTotal = round2(Math.max(0, lineTotalsSum - combinedExtraDiscount));
  const grandTotal = Math.round(rawTotal);
  const roundOff = round2(grandTotal - rawTotal);
  const discountTotal = round2(lineItemDiscounts + combinedExtraDiscount);
  const customerSavings = round2(Math.max(0, mrpTotal - grandTotal));

  return {
    itemTotal,
    discountTotal,
    taxableValue,
    cgstTotal,
    sgstTotal,
    igstTotal,
    totalGst,
    roundOff,
    grandTotal,
    customerSavings,
  };
}

export interface OfferValidationResult {
  valid: boolean;
  discountAmount: number;
  reason?: string;
}

export function validateAndApplyOffer(
  offer: Offer | undefined,
  items: { product: Product; qty: number }[],
  subtotal: number,
  nowDate = new Date()
): OfferValidationResult {
  if (!offer) return { valid: false, discountAmount: 0, reason: 'Coupon code not found.' };
  if (!offer.active) return { valid: false, discountAmount: 0, reason: 'Offer is currently inactive.' };

  const todayStr = nowDate.toISOString().slice(0, 10);
  if (offer.startDate && todayStr < offer.startDate) {
    return { valid: false, discountAmount: 0, reason: 'Offer has not started yet.' };
  }
  if (offer.endDate && todayStr > offer.endDate) {
    return { valid: false, discountAmount: 0, reason: 'Coupon has expired.' };
  }
  if (offer.usageLimit > 0 && offer.usedCount >= offer.usageLimit) {
    return { valid: false, discountAmount: 0, reason: 'Coupon usage limit reached.' };
  }
  if (subtotal < offer.minPurchase) {
    return {
      valid: false,
      discountAmount: 0,
      reason: `Minimum purchase of ₹${offer.minPurchase} required.`,
    };
  }

  let eligibleItems = items;
  if (offer.eligibleCategories && offer.eligibleCategories.length > 0) {
    eligibleItems = eligibleItems.filter((it) => offer.eligibleCategories!.includes(it.product.category));
  }
  if (offer.eligibleProductIds && offer.eligibleProductIds.length > 0) {
    eligibleItems = eligibleItems.filter((it) => offer.eligibleProductIds!.includes(it.product.id));
  }
  if (eligibleItems.length === 0) {
    return { valid: false, discountAmount: 0, reason: 'No cart items qualify for this offer.' };
  }

  const eligibleSubtotal = round2(
    eligibleItems.reduce((acc, it) => acc + it.product.sellingPrice * it.qty, 0)
  );

  let discount = 0;
  if (offer.offerType === 'bogo') {
    for (const it of eligibleItems) {
      const freeUnits = Math.floor(it.qty / 2);
      discount += freeUnits * it.product.sellingPrice;
    }
  } else if (offer.offerType === 'buy2_get1') {
    for (const it of eligibleItems) {
      const freeUnits = Math.floor(it.qty / 3);
      discount += freeUnits * it.product.sellingPrice;
    }
  } else if (
    offer.offerType === 'percentage_discount' ||
    offer.offerType === 'category_offer' ||
    offer.offerType === 'membership_discount' ||
    offer.offerType === 'festival_deal'
  ) {
    discount = (eligibleSubtotal * offer.discountValue) / 100;
  } else {
    discount = offer.discountValue;
  }

  if (offer.maxDiscount > 0) {
    discount = Math.min(discount, offer.maxDiscount);
  }
  discount = round2(Math.min(eligibleSubtotal, Math.max(0, discount)));

  return { valid: discount > 0, discountAmount: discount };
}

export function computeWeightedAverageCost(
  currentStock: number,
  currentRate: number,
  incomingQty: number,
  incomingRate: number
): number {
  const safeCurrentQty = Math.max(0, currentStock);
  const safeIncomingQty = Math.max(0, incomingQty);
  const totalQty = safeCurrentQty + safeIncomingQty;
  if (totalQty <= 0) return round2(incomingRate || currentRate);
  return round2((safeCurrentQty * currentRate + safeIncomingQty * incomingRate) / totalQty);
}

export function computeStockClosing(
  opening: number,
  received: number,
  customerReturns: number,
  sales: number,
  damaged: number,
  supplierReturns: number
): number {
  return round2(opening + received + customerReturns - sales - damaged - supplierReturns);
}

export type StockAlertType =
  | 'out_of_stock'
  | 'critical_stock'
  | 'low_stock'
  | 'expired'
  | 'near_expiry';

export function classifyProductAlerts(product: Product, refDate = new Date()): StockAlertType[] {
  const alerts: StockAlertType[] = [];
  if (product.currentStock <= 0) {
    alerts.push('out_of_stock');
  } else if (product.currentStock <= Math.max(1, Math.floor(product.minStock / 2))) {
    alerts.push('critical_stock');
  } else if (product.currentStock <= product.reorderLevel || product.currentStock <= product.minStock) {
    alerts.push('low_stock');
  }

  if (product.expiryDate) {
    const exp = new Date(product.expiryDate);
    if (!Number.isNaN(exp.getTime())) {
      const diffDays = Math.ceil((exp.getTime() - refDate.getTime()) / (1000 * 60 * 60 * 24));
      if (diffDays < 0) {
        alerts.push('expired');
      } else if (diffDays <= 45) {
        alerts.push('near_expiry');
      }
    }
  }
  return alerts;
}

export function reconcileCashRegister(params: {
  openingCash: number;
  cashSales: number;
  cashReceipts: number;
  cashRefunds: number;
  cashExpenses: number;
  cashDeposits: number;
  countedClosingCash: number;
}) {
  const expectedClosingCash = round2(
    params.openingCash +
      params.cashSales +
      params.cashReceipts -
      params.cashRefunds -
      params.cashExpenses -
      params.cashDeposits
  );
  const difference = round2(params.countedClosingCash - expectedClosingCash);
  return { expectedClosingCash, difference };
}

export interface DashboardMetrics {
  todaySales: number;
  yesterdaySales: number;
  weeklySales: number;
  monthlySales: number;
  yearlySales: number;
  todayBills: number;
  averageBillValue: number;
  grossProfit: number;
  estimatedNetProfit: number;
  purchaseCost: number;
  totalExpenses: number;
  cashInHand: number;
  upiCollection: number;
  cardCollection: number;
  bankCollection: number;
  customerOutstanding: number;
  supplierOutstanding: number;
  totalProducts: number;
  totalAvailableStock: number;
  inventoryPurchaseValue: number;
  inventorySellingValue: number;
  lowStockProducts: number;
  outOfStockProducts: number;
  nearExpiryProducts: number;
  expiredProducts: number;
  totalCustomers: number;
  newCustomers: number;
  repeatCustomers: number;
  pendingOnlineOrders: number;
  ordersInPacking: number;
  ordersOutForDelivery: number;
  deliveredOrders: number;
  totalEmployees: number;
  presentStaff: number;
  absentStaff: number;
  staffOnLeave: number;
}

export function computeDashboardMetrics(input: {
  sales: Sale[];
  purchases: Purchase[];
  expenses: Expense[];
  products: Product[];
  customers: Customer[];
  suppliers: Supplier[];
  onlineOrders: OnlineOrder[];
  staff: StaffMember[];
  attendance: AttendanceRecord[];
  referenceDate?: Date;
  filterMode?: 'all' | 'live' | 'demo';
  dateFrom?: string;
  dateTo?: string;
}): DashboardMetrics {
  const now = input.referenceDate || new Date();
  const todayStr = now.toISOString().slice(0, 10);
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().slice(0, 10);
  const weekAgo = new Date(now);
  weekAgo.setDate(now.getDate() - 7);
  const monthPrefix = todayStr.slice(0, 7);
  const yearPrefix = todayStr.slice(0, 4);

  const byMode = <T extends { isDemo?: boolean }>(arr: T[]) => {
    if (input.filterMode === 'live') return arr.filter((x) => !x.isDemo);
    if (input.filterMode === 'demo') return arr.filter((x) => Boolean(x.isDemo));
    return arr;
  };

  const inRange = (isoDate: string) => {
    const d = isoDate.slice(0, 10);
    if (input.dateFrom && d < input.dateFrom) return false;
    if (input.dateTo && d > input.dateTo) return false;
    return true;
  };

  const sales = byMode(input.sales).filter((s) => s.status !== 'refunded' && inRange(s.createdAt));
  const purchases = byMode(input.purchases).filter((p) => inRange(p.createdAt));
  const expenses = byMode(input.expenses).filter((e) => inRange(e.date));
  const products = byMode(input.products).filter((p) => p.active);
  const customers = byMode(input.customers).filter((c) => c.status === 'active');
  const suppliers = byMode(input.suppliers);
  const orders = byMode(input.onlineOrders);
  const staff = byMode(input.staff);
  const attendance = byMode(input.attendance).filter((a) => a.date === todayStr);

  let todaySales = 0;
  let yesterdaySales = 0;
  let weeklySales = 0;
  let monthlySales = 0;
  let yearlySales = 0;
  let todayBills = 0;
  let totalSalesAmount = 0;
  let totalCogs = 0;
  let cashCollection = 0;
  let upiCollection = 0;
  let cardCollection = 0;
  let bankCollection = 0;

  for (const s of sales) {
    const d = s.createdAt.slice(0, 10);
    const netSale = Math.max(0, s.grandTotal - (s.refundedAmount || 0));
    totalSalesAmount += netSale;
    if (d === todayStr) {
      todaySales += netSale;
      todayBills += 1;
    }
    if (d === yesterdayStr) yesterdaySales += netSale;
    if (new Date(s.createdAt) >= weekAgo) weeklySales += netSale;
    if (d.startsWith(monthPrefix)) monthlySales += netSale;
    if (d.startsWith(yearPrefix)) yearlySales += netSale;

    for (const item of s.items) {
      totalCogs += (item.purchaseRate || 0) * item.qty;
    }

    cashCollection += s.paymentSplit?.cash || 0;
    upiCollection += s.paymentSplit?.upi || 0;
    cardCollection += s.paymentSplit?.card || 0;
    bankCollection += s.paymentSplit?.bank || 0;
  }

  const purchaseCost = round2(purchases.reduce((sum, p) => sum + p.totalAmount, 0));
  const totalExpenses = round2(expenses.reduce((sum, e) => sum + e.amount, 0));
  const cashExpenses = round2(
    expenses.filter((e) => e.paymentMode === 'cash').reduce((sum, e) => sum + e.amount, 0)
  );
  const grossProfit = round2(totalSalesAmount - totalCogs);
  const estimatedNetProfit = round2(grossProfit - totalExpenses);

  let totalAvailableStock = 0;
  let inventoryPurchaseValue = 0;
  let inventorySellingValue = 0;
  let lowStockProducts = 0;
  let outOfStockProducts = 0;
  let nearExpiryProducts = 0;
  let expiredProducts = 0;

  for (const p of products) {
    const stock = Math.max(0, p.currentStock);
    totalAvailableStock += stock;
    inventoryPurchaseValue += stock * p.purchaseRate;
    inventorySellingValue += stock * p.sellingPrice;
    const alerts = classifyProductAlerts(p, now);
    if (alerts.includes('out_of_stock')) outOfStockProducts += 1;
    if (alerts.includes('low_stock') || alerts.includes('critical_stock')) lowStockProducts += 1;
    if (alerts.includes('near_expiry')) nearExpiryProducts += 1;
    if (alerts.includes('expired')) expiredProducts += 1;
  }

  const presentStaff = attendance.filter((a) => a.status === 'full_day' || a.status === 'half_day').length;
  const absentStaff = attendance.filter((a) => a.status === 'absent').length;
  const staffOnLeave = attendance.filter((a) => a.status === 'leave').length;

  return {
    todaySales: round2(todaySales),
    yesterdaySales: round2(yesterdaySales),
    weeklySales: round2(weeklySales),
    monthlySales: round2(monthlySales),
    yearlySales: round2(yearlySales),
    todayBills,
    averageBillValue: sales.length > 0 ? round2(totalSalesAmount / sales.length) : 0,
    grossProfit,
    estimatedNetProfit,
    purchaseCost,
    totalExpenses,
    cashInHand: round2(Math.max(0, cashCollection - cashExpenses)),
    upiCollection: round2(upiCollection),
    cardCollection: round2(cardCollection),
    bankCollection: round2(bankCollection),
    customerOutstanding: round2(customers.reduce((sum, c) => sum + Math.max(0, c.outstandingDue), 0)),
    supplierOutstanding: round2(suppliers.reduce((sum, s) => sum + Math.max(0, s.currentBalance), 0)),
    totalProducts: products.length,
    totalAvailableStock: round2(totalAvailableStock),
    inventoryPurchaseValue: round2(inventoryPurchaseValue),
    inventorySellingValue: round2(inventorySellingValue),
    lowStockProducts,
    outOfStockProducts,
    nearExpiryProducts,
    expiredProducts,
    totalCustomers: customers.length,
    newCustomers: customers.filter((c) => c.totalOrders <= 1).length,
    repeatCustomers: customers.filter((c) => c.totalOrders > 1).length,
    pendingOnlineOrders: orders.filter((o) => o.status === 'new' || o.status === 'confirmed').length,
    ordersInPacking: orders.filter((o) => o.status === 'packing').length,
    ordersOutForDelivery: orders.filter((o) => o.status === 'out_for_delivery').length,
    deliveredOrders: orders.filter((o) => o.status === 'delivered').length,
    totalEmployees: staff.filter((s) => s.status === 'active').length,
    presentStaff,
    absentStaff,
    staffOnLeave,
  };
}

export function buildCsvString(headers: string[], rows: Array<Array<string | number | boolean>>): string {
  const escape = (val: string | number | boolean) => {
    const str = String(val ?? '');
    if (/[",\n]/.test(str)) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };
  const lines = [headers.map(escape).join(','), ...rows.map((r) => r.map(escape).join(','))];
  return '\uFEFF' + lines.join('\r\n');
}
