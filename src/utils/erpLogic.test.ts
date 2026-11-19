import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildCsvString,
  calculateCartTotals,
  calculateLineItemGst,
  classifyProductAlerts,
  computeDashboardMetrics,
  computeStockClosing,
  computeWeightedAverageCost,
  reconcileCashRegister,
  validateAndApplyOffer,
} from './erpLogic';
import { Offer, Product, Sale } from '../types/erp';

const sampleProduct: Product = {
  id: 'prod_atta',
  nameHi: 'आशीर्वाद आटा 5kg',
  nameEn: 'Aashirvaad Atta 5kg',
  imageUrl: '',
  sku: 'ATTA-5KG',
  barcode: '8901725123456',
  category: 'Staples',
  subcategory: 'Flour',
  brand: 'Aashirvaad',
  manufacturer: 'ITC',
  hsnCode: '1101',
  gstRate: 5,
  unit: 'PACKET',
  packSize: '5 KG',
  purchaseRate: 210,
  mrp: 285,
  sellingPrice: 252,
  wholesalePrice: 240,
  discountPercent: 11.5,
  openingStock: 40,
  currentStock: 12,
  reservedStock: 2,
  minStock: 10,
  maxStock: 80,
  reorderLevel: 15,
  rackNumber: 'A-1',
  batchNumber: 'B26-01',
  mfgDate: '2026-08-01',
  expiryDate: '2026-12-10',
  description: 'Whole wheat chakki atta',
  active: true,
  isDemo: false,
};

test('GST inclusive and exclusive line item calculation splits CGST/SGST accurately', () => {
  const incl = calculateLineItemGst({ product: sampleProduct, qty: 2, gstInclusive: true });
  assert.equal(incl.lineTotal, 504);
  assert.equal(incl.taxableValue, 480);
  assert.equal(incl.cgst, 12);
  assert.equal(incl.sgst, 12);
  assert.equal(incl.igst, 0);

  const excl = calculateLineItemGst({
    product: sampleProduct,
    qty: 1,
    gstInclusive: false,
    interState: true,
  });
  assert.equal(excl.taxableValue, 252);
  assert.equal(excl.igst, 12.6);
  assert.equal(excl.lineTotal, 264.6);
});

test('Cart totals compute round-off, savings, and coupon discount cleanly', () => {
  const line = calculateLineItemGst({ product: sampleProduct, qty: 2, gstInclusive: true });
  const totals = calculateCartTotals([line], 0, 50);
  assert.equal(totals.itemTotal, 504);
  assert.equal(totals.discountTotal, 50);
  assert.equal(totals.grandTotal, 454);
  assert.equal(totals.customerSavings, 285 * 2 - 454);
});

test('Offer validation handles BOGO, min purchase, and expiry dates', () => {
  const bogoOffer: Offer = {
    id: 'off1',
    name: 'Atta BOGO',
    couponCode: 'BOGO2',
    description: 'Buy 1 Get 1',
    offerType: 'bogo',
    discountValue: 0,
    maxDiscount: 300,
    minPurchase: 200,
    startDate: '2026-01-01',
    endDate: '2026-12-31',
    usageLimit: 100,
    usedCount: 0,
    stackable: false,
    active: true,
  };
  const res = validateAndApplyOffer(
    bogoOffer,
    [{ product: sampleProduct, qty: 2 }],
    504,
    new Date('2026-11-19')
  );
  assert.equal(res.valid, true);
  assert.equal(res.discountAmount, 252);

  const expiredOffer = { ...bogoOffer, endDate: '2026-10-01' };
  const expiredRes = validateAndApplyOffer(
    expiredOffer,
    [{ product: sampleProduct, qty: 2 }],
    504,
    new Date('2026-11-19')
  );
  assert.equal(expiredRes.valid, false);
});

test('Inventory weighted average cost, closing stock, and alerts classify accurately', () => {
  assert.equal(computeWeightedAverageCost(10, 200, 10, 220), 210);
  assert.equal(computeStockClosing(40, 20, 2, 15, 1, 2), 44);
  const alerts = classifyProductAlerts(sampleProduct, new Date('2026-11-19'));
  assert.ok(alerts.includes('low_stock'));
  assert.ok(alerts.includes('near_expiry'));
});

test('Cash register reconciliation computes expected closing and difference', () => {
  const rec = reconcileCashRegister({
    openingCash: 2000,
    cashSales: 8500,
    cashReceipts: 1500,
    cashRefunds: 200,
    cashExpenses: 300,
    cashDeposits: 5000,
    countedClosingCash: 6500,
  });
  assert.equal(rec.expectedClosingCash, 6500);
  assert.equal(rec.difference, 0);
});

test('Dashboard metrics strictly isolate Demo vs Live records', () => {
  const liveSale: Sale = {
    id: 's1',
    invoiceNo: 'RKMM-1001',
    idempotencyKey: 'k1',
    customerId: 'walkin',
    customerName: 'Walk-in',
    cashierId: 'u1',
    cashierName: 'Cashier',
    items: [calculateLineItemGst({ product: sampleProduct, qty: 1, gstInclusive: true })],
    itemTotal: 252,
    discountTotal: 0,
    taxableValue: 240,
    cgstTotal: 6,
    sgstTotal: 6,
    igstTotal: 0,
    totalGst: 12,
    roundOff: 0,
    grandTotal: 252,
    customerSavings: 33,
    paymentMode: 'cash',
    paymentSplit: { cash: 252, upi: 0, card: 0, bank: 0, creditKhata: 0 },
    amountPaid: 252,
    balanceDue: 0,
    status: 'completed',
    source: 'pos',
    createdAt: '2026-11-19T10:00:00.000Z',
    isDemo: false,
  };
  const demoSale: Sale = { ...liveSale, id: 's2', invoiceNo: 'DEMO-1', grandTotal: 9999, isDemo: true };

  const liveMetrics = computeDashboardMetrics({
    sales: [liveSale, demoSale],
    purchases: [],
    expenses: [],
    products: [sampleProduct],
    customers: [],
    suppliers: [],
    onlineOrders: [],
    staff: [],
    attendance: [],
    referenceDate: new Date('2026-11-19T12:00:00.000Z'),
    filterMode: 'live',
  });
  assert.equal(liveMetrics.todaySales, 252);
  assert.equal(liveMetrics.todayBills, 1);
});

test('CSV builder escapes commas and includes UTF-8 BOM for Hindi compatibility', () => {
  const csv = buildCsvString(['Product', 'Price'], [['आशीर्वाद आटा, 5kg', 252]]);
  assert.ok(csv.startsWith('\uFEFF'));
  assert.ok(csv.includes('"आशीर्वाद आटा, 5kg",252'));
});
