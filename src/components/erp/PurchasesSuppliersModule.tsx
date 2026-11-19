import React, { useState } from 'react';
import { Plus } from 'lucide-react';
import { formatINR } from '../../config/businessConfig';
import { useMall } from '../../context/MallContext';
import { Purchase } from '../../types/erp';

export const PurchasesSuppliersModule: React.FC = () => {
  const {
    suppliers,
    purchases,
    supplierLedger,
    products,
    recordPurchase,
    recordSupplierPayment,
    showToast,
  } = useMall();

  const [tab, setTab] = useState<'purchases' | 'suppliers' | 'ledger'>('purchases');
  const [supplierId, setSupplierId] = useState(suppliers[0]?.id || '');
  const [productId, setProductId] = useState(products[0]?.id || '');
  const [qty, setQty] = useState(10);
  const [rate, setRate] = useState(products[0]?.purchaseRate || 100);
  const [invoiceNo, setInvoiceNo] = useState('');
  const [paidAmount, setPaidAmount] = useState(0);
  const [paySupId, setPaySupId] = useState(suppliers[0]?.id || '');
  const [payAmt, setPayAmt] = useState(0);
  const [payMode, setPayMode] = useState('bank');

  const handleRecordPurchase = async (e: React.FormEvent) => {
    e.preventDefault();
    const sup = suppliers.find((s) => s.id === supplierId);
    const prod = products.find((p) => p.id === productId);
    if (!sup || !prod || qty <= 0 || !invoiceNo.trim()) {
      showToast('Select supplier, product, positive qty, and invoice number.', 'error');
      return;
    }
    const totalAmount = Math.round(qty * rate * 100) / 100;
    const dueAmount = Math.max(0, totalAmount - paidAmount);
    const purchase: Purchase = {
      id: `pur_${Date.now()}`,
      supplierId: sup.id,
      supplierName: sup.businessName,
      poNumber: `PO-${Date.now().toString().slice(-5)}`,
      grnNumber: `GRN-${Date.now().toString().slice(-5)}`,
      invoiceNo: invoiceNo.trim(),
      status: 'received_inward',
      items: [
        {
          productId: prod.id,
          productName: prod.nameEn,
          qty,
          unit: prod.unit,
          rate,
          gstRate: prod.gstRate,
          total: totalAmount,
          batchNumber: prod.batchNumber,
        },
      ],
      totalAmount,
      paidAmount,
      dueAmount,
      paymentMode: 'bank',
      createdAt: new Date().toISOString(),
    };
    await recordPurchase(purchase);
    setInvoiceNo('');
    setPaidAmount(0);
  };

  const handleSupplierPay = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paySupId || payAmt <= 0) return;
    await recordSupplierPayment(paySupId, payAmt, payMode, 'Supplier due settlement');
    setPayAmt(0);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 text-xs">
        {(
          [
            ['purchases', 'Purchase Inward & GRN'],
            ['suppliers', `Suppliers & Payments (${suppliers.length})`],
            ['ledger', `Supplier Ledger (${supplierLedger.length})`],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            type="button"
            onClick={() => setTab(k)}
            className={`px-3.5 py-2 rounded-lg font-semibold ${
              tab === k
                ? 'bg-[#0F172A] text-white dark:bg-amber-500 dark:text-slate-950'
                : 'bg-slate-100 dark:bg-slate-800'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'purchases' && (
        <div className="grid lg:grid-cols-12 gap-5">
          <form
            onSubmit={handleRecordPurchase}
            className="lg:col-span-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-3 text-xs"
          >
            <h3 className="text-sm font-bold flex items-center gap-1.5">
              <Plus className="w-4 h-4 text-emerald-600" />
              New Purchase Invoice → GRN → Stock Inward
            </h3>
            <div>
              <label className="block font-semibold mb-1">Supplier</label>
              <select
                value={supplierId}
                onChange={(e) => setSupplierId(e.target.value)}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2"
              >
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.businessName} (Due: {formatINR(s.currentBalance)})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-semibold mb-1">Product</label>
              <select
                value={productId}
                onChange={(e) => {
                  const nextId = e.target.value;
                  setProductId(nextId);
                  const found = products.find((p) => p.id === nextId);
                  if (found) setRate(found.purchaseRate);
                }}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2"
              >
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nameEn} (Stock: {p.currentStock} {p.unit})
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block font-semibold mb-1">Qty</label>
                <input
                  type="number"
                  min="1"
                  value={qty}
                  onChange={(e) => setQty(Number(e.target.value) || 0)}
                  className="w-full rounded border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2.5 py-1.5"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">Rate (₹)</label>
                <input
                  type="number"
                  step="0.01"
                  value={rate}
                  onChange={(e) => setRate(Number(e.target.value) || 0)}
                  className="w-full rounded border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2.5 py-1.5"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">Paid Now (₹)</label>
                <input
                  type="number"
                  min="0"
                  value={paidAmount}
                  onChange={(e) => setPaidAmount(Number(e.target.value) || 0)}
                  className="w-full rounded border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2.5 py-1.5"
                />
              </div>
            </div>
            <div>
              <label className="block font-semibold mb-1">Supplier Invoice No *</label>
              <input
                required
                value={invoiceNo}
                onChange={(e) => setInvoiceNo(e.target.value)}
                placeholder="INV/2026/..."
                className="w-full rounded border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2"
              />
            </div>
            <div className="p-2.5 rounded bg-slate-50 dark:bg-slate-950 font-bold tabular-nums flex justify-between">
              <span>Bill Total: {formatINR(qty * rate)}</span>
              <span>Credit Due: {formatINR(Math.max(0, qty * rate - paidAmount))}</span>
            </div>
            <button
              type="submit"
              className="w-full py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
            >
              Confirm Purchase & Inward Stock
            </button>
          </form>

          <div className="lg:col-span-7 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 overflow-x-auto">
            <h3 className="text-sm font-bold mb-3">Purchase History</h3>
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500">
                  <th className="py-2">Invoice / GRN</th>
                  <th className="py-2">Supplier</th>
                  <th className="py-2 text-right">Total</th>
                  <th className="py-2 text-right">Paid</th>
                  <th className="py-2 text-right">Due</th>
                  <th className="py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {purchases.map((p) => (
                  <tr key={p.id} className="border-b border-slate-100 dark:border-slate-800/60 tabular-nums">
                    <td className="py-2 font-mono">
                      <div>{p.invoiceNo}</div>
                      <div className="text-[11px] text-slate-400">{p.grnNumber}</div>
                    </td>
                    <td className="py-2">{p.supplierName}</td>
                    <td className="py-2 text-right font-bold">{formatINR(p.totalAmount)}</td>
                    <td className="py-2 text-right text-emerald-600">{formatINR(p.paidAmount)}</td>
                    <td className="py-2 text-right text-red-600">{formatINR(p.dueAmount)}</td>
                    <td className="py-2 uppercase">{p.status.replace(/_/g, ' ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'suppliers' && (
        <div className="grid lg:grid-cols-12 gap-5">
          <form
            onSubmit={handleSupplierPay}
            className="lg:col-span-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-3 text-xs"
          >
            <h3 className="text-sm font-bold">Record Supplier Payment</h3>
            <select
              value={paySupId}
              onChange={(e) => setPaySupId(e.target.value)}
              className="w-full rounded border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2"
            >
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.businessName} (Bal: {formatINR(s.currentBalance)})
                </option>
              ))}
            </select>
            <input
              type="number"
              min="1"
              required
              value={payAmt || ''}
              onChange={(e) => setPayAmt(Number(e.target.value) || 0)}
              placeholder="Amount Paid (₹)"
              className="w-full rounded border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2"
            />
            <select
              value={payMode}
              onChange={(e) => setPayMode(e.target.value)}
              className="w-full rounded border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2"
            >
              <option value="bank">Bank / NEFT / RTGS</option>
              <option value="upi">UPI</option>
              <option value="cash">Cash</option>
            </select>
            <button
              type="submit"
              className="w-full py-2.5 rounded-lg bg-[#0F172A] dark:bg-amber-500 text-white dark:text-slate-950 font-bold"
            >
              Submit Supplier Payment
            </button>
          </form>

          <div className="lg:col-span-8 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500">
                  <th className="py-2">Business</th>
                  <th className="py-2">Contact</th>
                  <th className="py-2">GSTIN</th>
                  <th className="py-2 text-right">Terms</th>
                  <th className="py-2 text-right">Current Due</th>
                </tr>
              </thead>
              <tbody>
                {suppliers.map((s) => (
                  <tr key={s.id} className="border-b border-slate-100 dark:border-slate-800/60 tabular-nums">
                    <td className="py-2 font-bold">{s.businessName}</td>
                    <td className="py-2">
                      {s.contactPerson} · {s.mobile}
                    </td>
                    <td className="py-2 font-mono">{s.gstin}</td>
                    <td className="py-2 text-right">{s.creditTermsDays}d</td>
                    <td className="py-2 text-right font-extrabold text-red-600">
                      {formatINR(s.currentBalance)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'ledger' && (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500">
                <th className="py-2">Date</th>
                <th className="py-2">Supplier</th>
                <th className="py-2">Ref</th>
                <th className="py-2">Type</th>
                <th className="py-2 text-right">Purchase (+)</th>
                <th className="py-2 text-right">Paid (-)</th>
                <th className="py-2 text-right">Balance</th>
              </tr>
            </thead>
            <tbody>
              {supplierLedger.map((e) => (
                <tr key={e.id} className="border-b border-slate-100 dark:border-slate-800/60 tabular-nums">
                  <td className="py-2">{e.createdAt.slice(0, 10)}</td>
                  <td className="py-2 font-semibold">{e.supplierName}</td>
                  <td className="py-2 font-mono">{e.referenceNo}</td>
                  <td className="py-2 uppercase">{e.entryType.replace(/_/g, ' ')}</td>
                  <td className="py-2 text-right">{formatINR(e.debitAmount)}</td>
                  <td className="py-2 text-right text-emerald-600">{formatINR(e.creditAmount)}</td>
                  <td className="py-2 text-right font-bold">{formatINR(e.remainingDue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
