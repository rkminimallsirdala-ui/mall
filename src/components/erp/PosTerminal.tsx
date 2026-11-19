import React, { useMemo, useState } from 'react';
import {
  PauseCircle,
  PlayCircle,
  Printer,
  RefreshCw,
  RotateCcw,
  Search,
  Trash2,
  WifiOff,
} from 'lucide-react';
import { formatINR } from '../../config/businessConfig';
import { useMall } from '../../context/MallContext';
import { UI_LABELS } from '../../i18n/translations';
import { PaymentMode, Product, Sale } from '../../types/erp';
import { calculateCartTotals, calculateLineItemGst, validateAndApplyOffer } from '../../utils/erpLogic';
import { InvoicePrintModal } from '../common/InvoicePrintModal';

interface PosLine {
  product: Product;
  qty: number;
  itemDiscountPct: number;
}

interface HeldBill {
  id: string;
  label: string;
  customerId: string;
  lines: PosLine[];
  heldAt: string;
}

export const PosTerminal: React.FC = () => {
  const {
    language,
    storeSettings,
    products,
    customers,
    offers,
    sales,
    completePosSale,
    refundSale,
    isOffline,
    simulatedOffline,
    setSimulatedOffline,
    offlineQueue,
    syncOfflineQueue,
    hasPermission,
    showToast,
  } = useMall();

  const t = UI_LABELS[language];

  const [scanInput, setScanInput] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [lines, setLines] = useState<PosLine[]>([]);
  const [customerId, setCustomerId] = useState('walkin');
  const [billDiscount, setBillDiscount] = useState(0);
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState('');
  const [interState, setInterState] = useState(false);
  const [paymentMode, setPaymentMode] = useState<PaymentMode>('cash');
  const [splitCash, setSplitCash] = useState(0);
  const [splitUpi, setSplitUpi] = useState(0);
  const [splitCard, setSplitCard] = useState(0);
  const [splitKhata, setSplitKhata] = useState(0);
  const [heldBills, setHeldBills] = useState<HeldBill[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [idempotencyKey, setIdempotencyKey] = useState(() => `idem_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`);
  const [printSale, setPrintSale] = useState<Sale | null>(null);

  const categories = useMemo(() => {
    const set = new Set(products.filter((p) => p.active).map((p) => p.category));
    return ['ALL', ...Array.from(set)];
  }, [products]);

  const filteredProducts = useMemo(() => {
    const q = scanInput.trim().toLowerCase();
    return products.filter((p) => {
      if (!p.active) return false;
      const catOk = selectedCategory === 'ALL' || p.category === selectedCategory;
      const qOk =
        !q ||
        p.barcode.toLowerCase() === q ||
        p.sku.toLowerCase().includes(q) ||
        p.nameEn.toLowerCase().includes(q) ||
        p.nameHi.toLowerCase().includes(q);
      return catOk && qOk;
    });
  }, [products, selectedCategory, scanInput]);

  const addProductToBill = (product: Product) => {
    const avail = Math.max(0, product.currentStock - (product.reservedStock || 0));
    if (avail <= 0) {
      showToast(`${product.nameEn} is out of stock.`, 'error');
      return;
    }
    setLines((prev) => {
      const idx = prev.findIndex((l) => l.product.id === product.id);
      if (idx >= 0) {
        const nextQty = Math.min(avail, prev[idx].qty + 1);
        return prev.map((l, i) => (i === idx ? { ...l, qty: nextQty } : l));
      }
      return [...prev, { product, qty: 1, itemDiscountPct: 0 }];
    });
  };

  const handleScanEnter = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const q = scanInput.trim().toLowerCase();
    if (!q) return;
    const exact = products.find(
      (p) => p.active && (p.barcode.toLowerCase() === q || p.sku.toLowerCase() === q)
    );
    const match = exact || filteredProducts[0];
    if (match) {
      addProductToBill(match);
      setScanInput('');
    } else {
      showToast(`No product found for barcode/SKU "${scanInput}"`, 'error');
    }
  };

  const computedItems = useMemo(
    () =>
      lines.map((l) =>
        calculateLineItemGst({
          product: l.product,
          qty: l.qty,
          itemDiscountPct: l.itemDiscountPct,
          gstInclusive: storeSettings.gstInclusive,
          interState,
        })
      ),
    [lines, storeSettings.gstInclusive, interState]
  );

  const subtotalBeforeCoupon = useMemo(
    () => computedItems.reduce((s, it) => s + it.lineTotal, 0),
    [computedItems]
  );

  const offerEval = useMemo(() => {
    if (!appliedCoupon) return { valid: false, discountAmount: 0 };
    const off = offers.find((o) => o.couponCode.toUpperCase() === appliedCoupon.toUpperCase());
    return validateAndApplyOffer(off, lines, subtotalBeforeCoupon);
  }, [appliedCoupon, offers, lines, subtotalBeforeCoupon]);

  const totals = useMemo(
    () => calculateCartTotals(computedItems, billDiscount, offerEval.discountAmount),
    [computedItems, billDiscount, offerEval.discountAmount]
  );

  const selectedCustomer = useMemo(
    () => customers.find((c) => c.id === customerId),
    [customers, customerId]
  );

  const handleHoldBill = () => {
    if (lines.length === 0) return;
    setHeldBills((prev) => [
      {
        id: `hold_${Date.now()}`,
        label: selectedCustomer ? selectedCustomer.name : `Walk-in (${lines.length} items)`,
        customerId,
        lines,
        heldAt: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
      },
      ...prev,
    ]);
    setLines([]);
    setCustomerId('walkin');
    setBillDiscount(0);
    setAppliedCoupon('');
    showToast('Bill put on hold.', 'info');
  };

  const handleResumeBill = (held: HeldBill) => {
    setLines(held.lines);
    setCustomerId(held.customerId);
    setHeldBills((prev) => prev.filter((h) => h.id !== held.id));
  };

  const handleCompleteBill = async () => {
    if (lines.length === 0) {
      showToast('Add at least one item to generate bill.', 'error');
      return;
    }
    if (paymentMode === 'credit_khata' && customerId === 'walkin') {
      showToast('Select a registered customer for Udhaar / Khata billing.', 'error');
      return;
    }

    const split =
      paymentMode === 'split'
        ? {
            cash: splitCash,
            upi: splitUpi,
            card: splitCard,
            bank: 0,
            creditKhata: splitKhata,
          }
        : {
            cash: paymentMode === 'cash' ? totals.grandTotal : 0,
            upi: paymentMode === 'upi' || paymentMode === 'qr' ? totals.grandTotal : 0,
            card: paymentMode === 'debit_card' || paymentMode === 'credit_card' ? totals.grandTotal : 0,
            bank: 0,
            creditKhata: paymentMode === 'credit_khata' ? totals.grandTotal : 0,
          };

    const amountPaid = split.cash + split.upi + split.card + split.bank;
    const balanceDue = Math.max(0, totals.grandTotal - amountPaid);

    setSubmitting(true);
    try {
      const { sale } = await completePosSale({
        items: computedItems,
        customerId,
        customerName: selectedCustomer?.name || 'Walk-in Customer',
        customerMobile: selectedCustomer?.mobile,
        itemTotal: totals.itemTotal,
        discountTotal: totals.discountTotal,
        couponCode: appliedCoupon || undefined,
        taxableValue: totals.taxableValue,
        cgstTotal: totals.cgstTotal,
        sgstTotal: totals.sgstTotal,
        igstTotal: totals.igstTotal,
        totalGst: totals.totalGst,
        roundOff: totals.roundOff,
        grandTotal: totals.grandTotal,
        customerSavings: totals.customerSavings,
        paymentMode,
        paymentSplit: split,
        amountPaid,
        balanceDue,
        idempotencyKey,
      });
      setPrintSale(sale);
      setLines([]);
      setBillDiscount(0);
      setAppliedCoupon('');
      setCouponCode('');
      setCustomerId('walkin');
      setIdempotencyKey(`idem_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Billing failed', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* POS Top Bar: Barcode Search + Offline Controls + Held Bills */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="relative flex-1 min-w-[260px]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={scanInput}
            onChange={(e) => setScanInput(e.target.value)}
            onKeyDown={handleScanEnter}
            placeholder="Scan Barcode / Search SKU, Hindi or English product name (Press Enter)..."
            aria-label="POS barcode or product search"
            className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <button
            type="button"
            onClick={() => setSimulatedOffline(!simulatedOffline)}
            className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border font-semibold ${
              isOffline
                ? 'bg-amber-500 text-slate-950 border-amber-600'
                : 'border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200'
            }`}
          >
            <WifiOff className="w-3.5 h-3.5" />
            {isOffline ? 'Offline Mode Active' : 'Simulate Offline'}
          </button>

          {offlineQueue.length > 0 && (
            <button
              type="button"
              disabled={isOffline}
              onClick={syncOfflineQueue}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-600 text-white font-semibold disabled:opacity-50"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Sync Pending ({offlineQueue.length})
            </button>
          )}

          {heldBills.length > 0 && (
            <div className="flex items-center gap-1">
              {heldBills.map((h) => (
                <button
                  key={h.id}
                  type="button"
                  onClick={() => handleResumeBill(h)}
                  className="inline-flex items-center gap-1 px-2.5 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 font-semibold"
                >
                  <PlayCircle className="w-3.5 h-3.5 text-emerald-600" />
                  Resume {h.heldAt}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Main Split: Left Quick Product Grid | Right Billing Cart & Payment */}
      <div className="grid lg:grid-cols-12 gap-5 items-start">
        <div className="lg:col-span-7 space-y-3">
          <div className="flex flex-wrap gap-1.5">
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border ${
                  selectedCategory === cat
                    ? 'bg-[#0F172A] text-white border-[#0F172A] dark:bg-amber-500 dark:text-slate-950'
                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300'
                }`}
              >
                {cat === 'ALL' ? 'All Items' : cat}
              </button>
            ))}
          </div>

          <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3 max-h-[540px] overflow-y-auto pr-1">
            {filteredProducts.map((p) => {
              const avail = Math.max(0, p.currentStock - (p.reservedStock || 0));
              return (
                <button
                  key={p.id}
                  type="button"
                  disabled={avail <= 0}
                  onClick={() => addProductToBill(p)}
                  className="text-left rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 hover:border-amber-500 transition-colors disabled:opacity-45"
                >
                  <div className="flex justify-between items-start gap-2 text-[11px] text-slate-500">
                    <span className="font-mono">{p.sku}</span>
                    <span className={avail <= p.reorderLevel ? 'text-amber-600 font-semibold' : 'text-emerald-600 font-semibold'}>
                      {avail} {p.unit}
                    </span>
                  </div>
                  <div className="text-sm font-bold mt-1 truncate">{p.nameHi}</div>
                  <div className="text-xs text-slate-500 truncate">{p.nameEn}</div>
                  <div className="mt-2 flex items-baseline justify-between tabular-nums">
                    <span className="text-sm font-extrabold text-[#0F172A] dark:text-amber-400">
                      {formatINR(p.sellingPrice)}
                    </span>
                    <span className="text-[11px] text-slate-400">
                      GST {p.gstRate}% · MRP {p.mrp}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Billing Cart */}
        <div className="lg:col-span-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <select
              aria-label="Select Customer"
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
              className="flex-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs font-semibold"
            >
              <option value="walkin">Walk-in Customer</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.mobile}) — Due: {formatINR(c.outstandingDue)}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={handleHoldBill}
              disabled={lines.length === 0}
              className="inline-flex items-center gap-1 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-semibold disabled:opacity-40"
            >
              <PauseCircle className="w-3.5 h-3.5" />
              Hold
            </button>
          </div>

          {/* Line Items */}
          <div className="max-h-60 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
            {lines.length === 0 ? (
              <p className="py-8 text-center text-xs text-slate-400">
                Scan barcode or click items on the left to start billing.
              </p>
            ) : (
              lines.map((l, idx) => (
                <div key={l.product.id} className="py-2.5 flex items-center justify-between gap-2 text-xs">
                  <div className="min-w-0 flex-1">
                    <div className="font-bold truncate">{l.product.nameHi}</div>
                    <div className="text-slate-500 tabular-nums">
                      {formatINR(l.product.sellingPrice)} / {l.product.unit} · GST {l.product.gstRate}%
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 tabular-nums">
                    <input
                      type="number"
                      step={l.product.unit === 'KG' || l.product.unit === 'LITRE' ? '0.25' : '1'}
                      min="0.1"
                      max={l.product.currentStock}
                      aria-label={`Quantity for ${l.product.nameEn}`}
                      value={l.qty}
                      onChange={(e) => {
                        const val = Math.max(0.1, Number(e.target.value) || 0.1);
                        setLines((prev) =>
                          prev.map((x, i) => (i === idx ? { ...x, qty: val } : x))
                        );
                      }}
                      className="w-16 rounded border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2 py-1 text-right font-bold"
                    />
                    <input
                      type="number"
                      min="0"
                      max="50"
                      aria-label={`Discount % for ${l.product.nameEn}`}
                      placeholder="%"
                      value={l.itemDiscountPct || ''}
                      onChange={(e) => {
                        const val = Math.min(50, Math.max(0, Number(e.target.value) || 0));
                        setLines((prev) =>
                          prev.map((x, i) => (i === idx ? { ...x, itemDiscountPct: val } : x))
                        );
                      }}
                      className="w-12 rounded border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-1.5 py-1 text-right"
                      title="Item discount %"
                    />
                    <span className="w-16 text-right font-bold">
                      {formatINR(computedItems[idx]?.lineTotal || 0)}
                    </span>
                    <button
                      type="button"
                      onClick={() => setLines((prev) => prev.filter((_, i) => i !== idx))}
                      aria-label={`Remove ${l.product.nameEn}`}
                      className="p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 rounded"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Discounts, Coupons, GST Mode */}
          <div className="grid grid-cols-3 gap-2 text-xs">
            <div>
              <label className="block text-[11px] text-slate-500 mb-1">Bill Discount (₹)</label>
              <input
                type="number"
                min="0"
                disabled={!hasPermission('discounts')}
                value={billDiscount || ''}
                onChange={(e) => setBillDiscount(Math.max(0, Number(e.target.value) || 0))}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2.5 py-1.5 tabular-nums"
              />
            </div>
            <div>
              <label className="block text-[11px] text-slate-500 mb-1">Coupon Code</label>
              <div className="flex gap-1">
                <input
                  type="text"
                  value={couponCode}
                  onChange={(e) => setCouponCode(e.target.value)}
                  placeholder="RKMALL10"
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2 py-1.5 font-mono uppercase"
                />
                <button
                  type="button"
                  onClick={() => setAppliedCoupon(couponCode.trim().toUpperCase())}
                  className="px-2 rounded-lg bg-slate-200 dark:bg-slate-800 font-semibold"
                >
                  OK
                </button>
              </div>
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-1.5 text-[11px] font-medium cursor-pointer pb-1.5">
                <input
                  type="checkbox"
                  checked={interState}
                  onChange={(e) => setInterState(e.target.checked)}
                />
                IGST (Inter-state)
              </label>
            </div>
          </div>

          {/* GST & Totals Summary */}
          <div className="rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-3 space-y-1 text-xs tabular-nums">
            <div className="flex justify-between">
              <span className="text-slate-500">Taxable Value</span>
              <span>{formatINR(totals.taxableValue)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">
                {interState ? 'IGST' : 'CGST + SGST'}
              </span>
              <span>
                {interState
                  ? formatINR(totals.igstTotal)
                  : `${formatINR(totals.cgstTotal)} + ${formatINR(totals.sgstTotal)}`}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Discount & Round-off</span>
              <span>
                -{formatINR(totals.discountTotal)} / {totals.roundOff >= 0 ? `+${totals.roundOff}` : totals.roundOff}
              </span>
            </div>
            <div className="flex justify-between text-lg font-extrabold pt-1.5 border-t border-slate-200 dark:border-slate-800">
              <span>Grand Total</span>
              <span className="text-emerald-600 dark:text-emerald-400">{formatINR(totals.grandTotal)}</span>
            </div>
          </div>

          {/* Payment Modes */}
          <div className="space-y-2 text-xs">
            <div className="grid grid-cols-4 gap-1.5">
              {(
                [
                  ['cash', 'Cash'],
                  ['upi', 'UPI'],
                  ['qr', 'QR Code'],
                  ['debit_card', 'Debit Card'],
                  ['credit_card', 'Credit Card'],
                  ['split', 'Split Pay'],
                  ['credit_khata', 'उधार Khata'],
                ] as Array<[PaymentMode, string]>
              ).map(([mode, label]) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setPaymentMode(mode)}
                  className={`py-1.5 px-2 rounded-lg border font-semibold ${
                    paymentMode === mode
                      ? 'bg-[#0F172A] text-white border-[#0F172A] dark:bg-amber-500 dark:text-slate-950'
                      : 'border-slate-200 dark:border-slate-700'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {paymentMode === 'split' && (
              <div className="grid grid-cols-4 gap-2 pt-1 tabular-nums">
                <input
                  type="number"
                  placeholder="Cash"
                  value={splitCash || ''}
                  onChange={(e) => setSplitCash(Number(e.target.value) || 0)}
                  className="rounded border border-slate-300 dark:border-slate-700 px-2 py-1"
                />
                <input
                  type="number"
                  placeholder="UPI"
                  value={splitUpi || ''}
                  onChange={(e) => setSplitUpi(Number(e.target.value) || 0)}
                  className="rounded border border-slate-300 dark:border-slate-700 px-2 py-1"
                />
                <input
                  type="number"
                  placeholder="Card"
                  value={splitCard || ''}
                  onChange={(e) => setSplitCard(Number(e.target.value) || 0)}
                  className="rounded border border-slate-300 dark:border-slate-700 px-2 py-1"
                />
                <input
                  type="number"
                  placeholder="Khata"
                  value={splitKhata || ''}
                  onChange={(e) => setSplitKhata(Number(e.target.value) || 0)}
                  className="rounded border border-slate-300 dark:border-slate-700 px-2 py-1"
                />
              </div>
            )}
          </div>

          <button
            type="button"
            disabled={submitting || lines.length === 0}
            onClick={handleCompleteBill}
            className="w-full py-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-extrabold disabled:opacity-45 transition-colors"
          >
            {submitting ? 'Processing Transaction...' : `${t.completeBill} (${formatINR(totals.grandTotal)})`}
          </button>
        </div>
      </div>

      {/* Offline Queue Review & Recent Invoices */}
      <div className="grid lg:grid-cols-2 gap-5">
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-3">
          <h3 className="text-sm font-bold">Recent POS Invoices (Reprint & Reversal Refund)</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500">
                  <th className="py-2 px-2">Invoice</th>
                  <th className="py-2 px-2">Customer</th>
                  <th className="py-2 px-2 text-right">Amount</th>
                  <th className="py-2 px-2">Mode</th>
                  <th className="py-2 px-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {sales.slice(0, 8).map((s) => (
                  <tr key={s.id} className="border-b border-slate-100 dark:border-slate-800/60 tabular-nums">
                    <td className="py-2 px-2 font-mono font-semibold whitespace-nowrap">
                      {s.invoiceNo}
                      {s.isDemo ? ' (DEMO)' : ''}
                    </td>
                    <td className="py-2 px-2 truncate max-w-[140px]">{s.customerName}</td>
                    <td className="py-2 px-2 text-right font-bold">{formatINR(s.grandTotal)}</td>
                    <td className="py-2 px-2 uppercase">{s.status === 'refunded' ? 'REFUNDED' : s.paymentMode}</td>
                    <td className="py-2 px-2 text-right space-x-1.5 whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => setPrintSale(s)}
                        aria-label={`Print invoice ${s.invoiceNo}`}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
                      >
                        <Printer className="w-3 h-3" />
                        Print
                      </button>
                      {s.status !== 'refunded' && hasPermission('refund_approval') && (
                        <button
                          type="button"
                          onClick={() => refundSale(s.id, 'Customer sales return at counter')}
                          aria-label={`Refund invoice ${s.invoiceNo}`}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded border border-red-200 dark:border-red-900 text-red-600 hover:bg-red-50"
                        >
                          <RotateCcw className="w-3 h-3" />
                          Refund
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-3">
          <h3 className="text-sm font-bold">Offline POS Queue (IndexedDB Pending Sync)</h3>
          {offlineQueue.length === 0 ? (
            <p className="text-xs text-slate-400 py-4">
              No offline pending bills. Toggle &ldquo;Simulate Offline&rdquo; above to test offline queue & sync.
            </p>
          ) : (
            <div className="space-y-2 text-xs">
              {offlineQueue.map((q) => (
                <div
                  key={q.idempotencyKey}
                  className="p-3 rounded-lg border border-amber-200 dark:border-amber-900 bg-amber-50/50 dark:bg-amber-950/20 flex justify-between items-center gap-2"
                >
                  <div>
                    <div className="font-mono font-bold">{q.idempotencyKey}</div>
                    <div className="text-slate-600 dark:text-slate-300">
                      {q.saleDraft.customerName} · {formatINR(q.saleDraft.grandTotal)} ·{' '}
                      <strong>{q.status.toUpperCase()}</strong>
                    </div>
                    {q.conflictReason && <div className="text-red-600">{q.conflictReason}</div>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {printSale && (
        <InvoicePrintModal
          sale={printSale}
          settings={storeSettings}
          onClose={() => setPrintSale(null)}
        />
      )}
    </div>
  );
};
