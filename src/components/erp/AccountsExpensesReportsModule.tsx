import React, { useMemo, useState } from 'react';
import { Calculator, Download, Plus, Printer, Receipt } from 'lucide-react';
import { formatINR } from '../../config/businessConfig';
import { useMall } from '../../context/MallContext';
import { CashRegister, Expense, ExpenseCategory } from '../../types/erp';
import { buildCsvString, computeDashboardMetrics, reconcileCashRegister } from '../../utils/erpLogic';

const EXPENSE_CATEGORIES: ExpenseCategory[] = [
  'Electricity',
  'Rent',
  'Salary',
  'Transport',
  'Packaging',
  'Repair',
  'Internet',
  'Marketing',
  'Maintenance',
  'Miscellaneous',
];

export const AccountsExpensesReportsModule: React.FC = () => {
  const {
    expenses,
    cashRegisters,
    sales,
    purchases,
    products,
    customers,
    suppliers,
    onlineOrders,
    staff,
    attendance,
    reportFilterMode,
    setReportFilterMode,
    recordExpense,
    saveCashRegister,
    user,
    activeRoleView,
    showToast,
  } = useMall();

  const [subTab, setSubTab] = useState<'expenses' | 'cashbook' | 'reports'>('expenses');

  // Expense form
  const [expDate, setExpDate] = useState(new Date().toISOString().slice(0, 10));
  const [expCategory, setExpCategory] = useState<ExpenseCategory>('Electricity');
  const [expDesc, setExpDesc] = useState('');
  const [expAmount, setExpAmount] = useState('');
  const [expMode, setExpMode] = useState<'cash' | 'upi' | 'bank'>('cash');
  const [expReceipt, setExpReceipt] = useState('');

  // Cash Register Reconciliation
  const todayStr = new Date().toISOString().slice(0, 10);
  const metricsToday = useMemo(
    () =>
      computeDashboardMetrics({
        sales,
        purchases,
        expenses,
        products,
        customers,
        suppliers,
        onlineOrders,
        staff,
        attendance,
        filterMode: reportFilterMode,
        dateFrom: todayStr,
        dateTo: todayStr,
      }),
    [sales, purchases, expenses, products, customers, suppliers, onlineOrders, staff, attendance, reportFilterMode, todayStr]
  );

  const [openingCash, setOpeningCash] = useState(cashRegisters[0]?.openingCash || 5000);
  const [cashReceipts, setCashReceipts] = useState(0);
  const [cashRefunds, setCashRefunds] = useState(0);
  const [cashDeposits, setCashDeposits] = useState(0);
  const [countedClosingCash, setCountedClosingCash] = useState(metricsToday.cashInHand + 5000);

  const todayCashSales = useMemo(
    () =>
      sales
        .filter((s) => s.createdAt.slice(0, 10) === todayStr && s.status !== 'refunded')
        .reduce((sum, s) => sum + (s.paymentSplit?.cash || 0), 0),
    [sales, todayStr]
  );

  const todayCashExpenses = useMemo(
    () =>
      expenses
        .filter((e) => e.date === todayStr && e.paymentMode === 'cash')
        .reduce((sum, e) => sum + e.amount, 0),
    [expenses, todayStr]
  );

  const reconciliation = reconcileCashRegister({
    openingCash,
    cashSales: todayCashSales,
    cashReceipts,
    cashRefunds,
    cashExpenses: todayCashExpenses,
    cashDeposits,
    countedClosingCash,
  });

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = Number(expAmount);
    if (!expDesc.trim() || !Number.isFinite(amt) || amt <= 0) {
      showToast('Enter valid expense description and amount.', 'error');
      return;
    }
    const exp: Expense = {
      id: `exp_${Date.now()}`,
      date: expDate,
      category: expCategory,
      description: expDesc.trim(),
      amount: amt,
      paymentMode: expMode,
      receiptNo: expReceipt.trim() || undefined,
      authorizedBy: user?.displayName || activeRoleView,
    };
    await recordExpense(exp);
    setExpDesc('');
    setExpAmount('');
    setExpReceipt('');
  };

  const handleCloseRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    const reg: CashRegister = {
      id: `reg_${todayStr}`,
      date: todayStr,
      openingCash,
      cashSales: todayCashSales,
      cashReceipts,
      cashRefunds,
      cashExpenses: todayCashExpenses,
      cashDeposits,
      expectedClosingCash: reconciliation.expectedClosingCash,
      countedClosingCash,
      difference: reconciliation.difference,
      status: 'closed',
      closedBy: user?.displayName || activeRoleView,
    };
    await saveCashRegister(reg);
  };

  const metricsOverall = useMemo(
    () =>
      computeDashboardMetrics({
        sales,
        purchases,
        expenses,
        products,
        customers,
        suppliers,
        onlineOrders,
        staff,
        attendance,
        filterMode: reportFilterMode,
      }),
    [sales, purchases, expenses, products, customers, suppliers, onlineOrders, staff, attendance, reportFilterMode]
  );

  const downloadSalesGstCsv = () => {
    const filtered = sales.filter((s) =>
      reportFilterMode === 'live' ? !s.isDemo : reportFilterMode === 'demo' ? s.isDemo : true
    );
    const csv = buildCsvString(
      ['Invoice No', 'Date', 'Customer', 'Mode', 'Taxable', 'CGST', 'SGST', 'IGST', 'Grand Total', 'Status', 'Demo'],
      filtered.map((s) => [
        s.invoiceNo,
        s.createdAt.slice(0, 10),
        s.customerName,
        s.paymentMode,
        s.taxableValue,
        s.cgstTotal,
        s.sgstTotal,
        s.igstTotal,
        s.grandTotal,
        s.status,
        Boolean(s.isDemo),
      ])
    );
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rkmm_gst_sales_report_${todayStr}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadExpensesCsv = () => {
    const csv = buildCsvString(
      ['Date', 'Category', 'Description', 'Payment Mode', 'Amount', 'Authorized By'],
      expenses.map((e) => [e.date, e.category, e.description, e.paymentMode, e.amount, e.authorizedBy])
    );
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rkmm_expenses_${todayStr}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-extrabold tracking-tight">
            Accounts, Expenses, Cash Book & Business Reports
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Total Expenses: <strong className="text-red-600 tabular-nums">{formatINR(metricsOverall.totalExpenses)}</strong> ·
            Estimated Net Profit:{' '}
            <strong className="text-emerald-600 tabular-nums">{formatINR(metricsOverall.estimatedNetProfit)}</strong>
          </p>
        </div>

        <div className="flex flex-wrap gap-1.5 text-xs">
          {(
            [
              ['expenses', 'Expenses & Vouchers'],
              ['cashbook', 'Cash Register & Ledgers'],
              ['reports', 'GST & P&L Reports'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setSubTab(id)}
              className={`px-3 py-1.5 rounded-lg border font-semibold ${
                subTab === id
                  ? 'bg-[#0F172A] text-white border-[#0F172A] dark:bg-amber-500 dark:text-slate-950'
                  : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {subTab === 'expenses' && (
        <div className="grid lg:grid-cols-12 gap-5 items-start">
          <form
            onSubmit={handleAddExpense}
            className="lg:col-span-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-3 text-xs"
          >
            <h3 className="text-sm font-bold flex items-center gap-1.5">
              <Plus className="w-4 h-4 text-amber-600" />
              Record Store Expense
            </h3>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block font-semibold mb-1">Date</label>
                <input
                  type="date"
                  value={expDate}
                  onChange={(e) => setExpDate(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">Category</label>
                <select
                  value={expCategory}
                  onChange={(e) => setExpCategory(e.target.value as ExpenseCategory)}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2"
                >
                  {EXPENSE_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="block font-semibold mb-1">Description *</label>
              <input
                type="text"
                required
                value={expDesc}
                onChange={(e) => setExpDesc(e.target.value)}
                placeholder="e.g., Monthly Electricity Bill, Carry Bags..."
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block font-semibold mb-1">Amount (₹) *</label>
                <input
                  type="number"
                  min="1"
                  required
                  value={expAmount}
                  onChange={(e) => setExpAmount(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 tabular-nums"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">Payment Mode</label>
                <select
                  value={expMode}
                  onChange={(e) => setExpMode(e.target.value as 'cash' | 'upi' | 'bank')}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2"
                >
                  <option value="cash">Cash</option>
                  <option value="upi">UPI</option>
                  <option value="bank">Bank</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block font-semibold mb-1">Receipt / Voucher #</label>
              <input
                type="text"
                value={expReceipt}
                onChange={(e) => setExpReceipt(e.target.value)}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2"
              />
            </div>
            <button
              type="submit"
              className="w-full py-2.5 rounded-lg bg-[#0F172A] dark:bg-amber-500 text-white dark:text-slate-950 font-bold"
            >
              Save Expense Voucher
            </button>
          </form>

          <div className="lg:col-span-8 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-3">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-bold flex items-center gap-1.5">
                <Receipt className="w-4 h-4 text-slate-500" />
                Expense Ledger
              </h3>
              <button
                type="button"
                onClick={downloadExpensesCsv}
                className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded border border-slate-300 dark:border-slate-700"
              >
                <Download className="w-3.5 h-3.5" />
                CSV
              </button>
            </div>
            <div className="overflow-x-auto max-h-96">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500">
                    <th className="py-2">Date</th>
                    <th className="py-2">Category</th>
                    <th className="py-2">Description</th>
                    <th className="py-2">Mode</th>
                    <th className="py-2 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 tabular-nums">
                  {expenses.map((e) => (
                    <tr key={e.id}>
                      <td className="py-2 font-mono">{e.date}</td>
                      <td className="py-2 font-semibold">{e.category}</td>
                      <td className="py-2">{e.description}</td>
                      <td className="py-2 uppercase">{e.paymentMode}</td>
                      <td className="py-2 text-right font-bold text-red-600">{formatINR(e.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {subTab === 'cashbook' && (
        <div className="grid lg:grid-cols-12 gap-5 items-start">
          <form
            onSubmit={handleCloseRegister}
            className="lg:col-span-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-3 text-xs"
          >
            <h3 className="text-sm font-bold flex items-center gap-1.5">
              <Calculator className="w-4 h-4 text-emerald-600" />
              Daily Cash Register Reconciliation ({todayStr})
            </h3>
            <div className="grid grid-cols-2 gap-2 tabular-nums">
              <div>
                <label className="block font-semibold mb-1">Opening Cash (₹)</label>
                <input
                  type="number"
                  value={openingCash}
                  onChange={(e) => setOpeningCash(Number(e.target.value) || 0)}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">Today Cash Sales (Auto)</label>
                <input
                  type="number"
                  readOnly
                  value={todayCashSales}
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-950 px-3 py-2 font-bold"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">Khata Cash Receipts (₹)</label>
                <input
                  type="number"
                  value={cashReceipts}
                  onChange={(e) => setCashReceipts(Number(e.target.value) || 0)}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">Cash Refunds (₹)</label>
                <input
                  type="number"
                  value={cashRefunds}
                  onChange={(e) => setCashRefunds(Number(e.target.value) || 0)}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">Today Cash Expenses (Auto)</label>
                <input
                  type="number"
                  readOnly
                  value={todayCashExpenses}
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-950 px-3 py-2"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">Bank Cash Deposits (₹)</label>
                <input
                  type="number"
                  value={cashDeposits}
                  onChange={(e) => setCashDeposits(Number(e.target.value) || 0)}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2"
                />
              </div>
              <div className="col-span-2">
                <label className="block font-semibold mb-1">Physical Counted Closing Cash (₹)</label>
                <input
                  type="number"
                  value={countedClosingCash}
                  onChange={(e) => setCountedClosingCash(Number(e.target.value) || 0)}
                  className="w-full rounded-lg border border-amber-400 bg-amber-50/40 dark:bg-slate-950 px-3 py-2 font-bold"
                />
              </div>
            </div>

            <div className="rounded-lg bg-slate-50 dark:bg-slate-950 p-3 space-y-1 tabular-nums">
              <div className="flex justify-between">
                <span>Expected Closing Cash</span>
                <strong>{formatINR(reconciliation.expectedClosingCash)}</strong>
              </div>
              <div className="flex justify-between">
                <span>Shortage / Excess Difference</span>
                <strong
                  className={
                    reconciliation.difference === 0
                      ? 'text-emerald-600'
                      : reconciliation.difference < 0
                      ? 'text-red-600'
                      : 'text-amber-600'
                  }
                >
                  {reconciliation.difference >= 0 ? `+${formatINR(reconciliation.difference)}` : formatINR(reconciliation.difference)}
                </strong>
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
            >
              Close & Save Daily Cash Register
            </button>
          </form>

          <div className="lg:col-span-7 space-y-4">
            <div className="grid sm:grid-cols-3 gap-3 text-xs tabular-nums">
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
                <div className="text-slate-500">UPI / QR Ledger</div>
                <div className="text-lg font-extrabold mt-1">{formatINR(metricsOverall.upiCollection)}</div>
              </div>
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
                <div className="text-slate-500">Bank / Card Ledger</div>
                <div className="text-lg font-extrabold mt-1">
                  {formatINR(metricsOverall.bankCollection + metricsOverall.cardCollection)}
                </div>
              </div>
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
                <div className="text-slate-500">Receivables / Payables</div>
                <div className="text-sm font-extrabold mt-1">
                  <span className="text-emerald-600">{formatINR(metricsOverall.customerOutstanding)}</span> /{' '}
                  <span className="text-red-600">{formatINR(metricsOverall.supplierOutstanding)}</span>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
              <h3 className="text-sm font-bold mb-3">Past Cash Register Closings</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500">
                      <th className="py-2">Date</th>
                      <th className="py-2 text-right">Opening</th>
                      <th className="py-2 text-right">Expected</th>
                      <th className="py-2 text-right">Counted</th>
                      <th className="py-2 text-right">Diff</th>
                      <th className="py-2">By</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 tabular-nums">
                    {cashRegisters.map((r) => (
                      <tr key={r.id}>
                        <td className="py-2 font-mono">{r.date}</td>
                        <td className="py-2 text-right">{formatINR(r.openingCash)}</td>
                        <td className="py-2 text-right">{formatINR(r.expectedClosingCash)}</td>
                        <td className="py-2 text-right font-bold">{formatINR(r.countedClosingCash)}</td>
                        <td className="py-2 text-right">{formatINR(r.difference)}</td>
                        <td className="py-2">{r.closedBy || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {subTab === 'reports' && (
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-0.5 text-xs">
              {(['all', 'live', 'demo'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setReportFilterMode(m)}
                  className={`px-3 py-1.5 rounded-md font-semibold capitalize ${
                    reportFilterMode === m
                      ? 'bg-[#0F172A] text-white dark:bg-amber-500 dark:text-slate-950'
                      : 'text-slate-600 dark:text-slate-300'
                  }`}
                >
                  {m === 'all' ? 'All Records' : m === 'live' ? 'Live Only' : 'Demo Only'}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap gap-2 text-xs">
              <button
                type="button"
                onClick={downloadSalesGstCsv}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#0F172A] dark:bg-amber-500 text-white dark:text-slate-950 font-bold"
              >
                <Download className="w-3.5 h-3.5" />
                Export Sales & GST CSV
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 font-semibold"
              >
                <Printer className="w-3.5 h-3.5" />
                Print P&L Summary
              </button>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 tabular-nums">
            {[
              { label: 'Monthly Revenue', val: formatINR(metricsOverall.monthlySales) },
              { label: 'Gross Profit', val: formatINR(metricsOverall.grossProfit) },
              { label: 'Operating Expenses', val: formatINR(metricsOverall.totalExpenses) },
              { label: 'Estimated Net Profit', val: formatINR(metricsOverall.estimatedNetProfit) },
              { label: 'Stock Purchase Cost Value', val: formatINR(metricsOverall.inventoryPurchaseValue) },
              { label: 'Stock Selling Value', val: formatINR(metricsOverall.inventorySellingValue) },
              { label: 'Customer Udhaar Due', val: formatINR(metricsOverall.customerOutstanding) },
              { label: 'Supplier Payable Due', val: formatINR(metricsOverall.supplierOutstanding) },
            ].map((item) => (
              <div
                key={item.label}
                className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4"
              >
                <div className="text-xs text-slate-500">{item.label}</div>
                <div className="text-lg font-extrabold mt-1">{item.val}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
