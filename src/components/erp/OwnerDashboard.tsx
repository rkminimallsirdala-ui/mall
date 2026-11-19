import React, { useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { formatINR } from '../../config/businessConfig';
import { useMall } from '../../context/MallContext';
import { UI_LABELS } from '../../i18n/translations';
import { computeDashboardMetrics } from '../../utils/erpLogic';

const CHART_COLORS = ['#0F172A', '#F59E0B', '#10B981', '#3B82F6', '#EF4444'];

export const OwnerDashboard: React.FC<{ onNavigateTab: (tab: string) => void }> = ({
  onNavigateTab,
}) => {
  const {
    language,
    sales,
    purchases,
    expenses,
    products,
    customers,
    suppliers,
    onlineOrders,
    staff,
    attendance,
    reportFilterMode,
    setReportFilterMode,
    isCloudLive,
  } = useMall();

  const t = UI_LABELS[language];
  const [period, setPeriod] = useState<'daily' | 'weekly' | 'monthly' | 'custom'>('monthly');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const metrics = useMemo(
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
        dateFrom: period === 'custom' ? dateFrom : undefined,
        dateTo: period === 'custom' ? dateTo : undefined,
      }),
    [
      sales,
      purchases,
      expenses,
      products,
      customers,
      suppliers,
      onlineOrders,
      staff,
      attendance,
      reportFilterMode,
      period,
      dateFrom,
      dateTo,
    ]
  );

  const filteredSales = useMemo(() => {
    if (reportFilterMode === 'live') return sales.filter((s) => !s.isDemo && s.status !== 'refunded');
    if (reportFilterMode === 'demo') return sales.filter((s) => s.isDemo && s.status !== 'refunded');
    return sales.filter((s) => s.status !== 'refunded');
  }, [sales, reportFilterMode]);

  const paymentChartData = useMemo(
    () =>
      [
        { name: 'Cash', value: metrics.cashInHand },
        { name: 'UPI', value: metrics.upiCollection },
        { name: 'Card', value: metrics.cardCollection },
        { name: 'Bank', value: metrics.bankCollection },
        { name: 'Udhaar/Khata', value: metrics.customerOutstanding },
      ].filter((d) => d.value > 0),
    [metrics]
  );

  const categoryChartData = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of products.filter((x) =>
      reportFilterMode === 'live' ? !x.isDemo : reportFilterMode === 'demo' ? x.isDemo : true
    )) {
      map.set(p.category, (map.get(p.category) || 0) + Math.max(0, p.currentStock) * p.sellingPrice);
    }
    return Array.from(map.entries()).map(([name, value]) => ({
      name: name.split(' ')[0],
      value: Math.round(value),
    }));
  }, [products, reportFilterMode]);

  const staffSalesRows = useMemo(() => {
    const map = new Map<string, { bills: number; total: number }>();
    for (const s of filteredSales) {
      const cur = map.get(s.cashierName) || { bills: 0, total: 0 };
      map.set(s.cashierName, { bills: cur.bills + 1, total: cur.total + s.grandTotal });
    }
    return Array.from(map.entries()).map(([name, stats]) => ({ name, ...stats }));
  }, [filteredSales]);

  return (
    <div className="space-y-6">
      {/* Filter & Analysis Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
        <div>
          <h2 className="text-xl font-extrabold tracking-tight">{t.dashboard}</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {isCloudLive ? 'Live Firestore Analytics' : 'Demo Sandbox Analytics'} · Calculated from
            actual transaction records
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-0.5 text-xs">
            {(['all', 'live', 'demo'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setReportFilterMode(m)}
                className={`px-2.5 py-1 rounded-md font-semibold capitalize ${
                  reportFilterMode === m
                    ? 'bg-[#0F172A] text-white dark:bg-amber-500 dark:text-slate-950'
                    : 'text-slate-600 dark:text-slate-300'
                }`}
              >
                {m === 'all' ? 'All Records' : m === 'live' ? 'Live Only' : 'Demo Only'}
              </button>
            ))}
          </div>

          <div className="flex rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-0.5 text-xs">
            {(['daily', 'weekly', 'monthly', 'custom'] as const).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPeriod(p)}
                className={`px-2.5 py-1 rounded-md font-semibold capitalize ${
                  period === p
                    ? 'bg-emerald-600 text-white'
                    : 'text-slate-600 dark:text-slate-300'
                }`}
              >
                {p}
              </button>
            ))}
          </div>

          {period === 'custom' && (
            <div className="flex items-center gap-1.5 text-xs">
              <input
                type="date"
                aria-label="Filter from date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-2 py-1"
              />
              <span>to</span>
              <input
                type="date"
                aria-label="Filter to date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-2 py-1"
              />
            </div>
          )}
        </div>
      </div>

      {/* Group 1: Business Sales */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200">
            01. Business Sales Performance
          </h3>
          <button
            type="button"
            onClick={() => onNavigateTab('pos')}
            className="text-xs font-semibold text-amber-600 dark:text-amber-400 hover:underline"
          >
            Open POS Counter →
          </button>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 tabular-nums">
          {[
            { label: t.todaySales, value: formatINR(metrics.todaySales) },
            { label: 'Yesterday Sales', value: formatINR(metrics.yesterdaySales) },
            { label: 'Weekly Sales', value: formatINR(metrics.weeklySales) },
            { label: 'Monthly Sales', value: formatINR(metrics.monthlySales) },
            { label: 'Yearly Sales', value: formatINR(metrics.yearlySales) },
            { label: "Today's Bills", value: String(metrics.todayBills) },
            { label: 'Avg Bill Value', value: formatINR(metrics.averageBillValue) },
          ].map((k) => (
            <div
              key={k.label}
              className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5"
            >
              <div className="text-xs text-slate-500 dark:text-slate-400 truncate">{k.label}</div>
              <div className="text-base font-extrabold mt-1 text-[#0F172A] dark:text-white">
                {k.value}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Group 2: Profit & Money */}
      <section className="space-y-3">
        <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200">
          02. Profit, Cash & Outstanding Ledgers
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 tabular-nums">
          {[
            { label: t.grossProfit, value: formatINR(metrics.grossProfit), tone: 'text-emerald-600 dark:text-emerald-400' },
            { label: t.netProfit, value: formatINR(metrics.estimatedNetProfit), tone: 'text-emerald-600 dark:text-emerald-400' },
            { label: 'Purchase Cost', value: formatINR(metrics.purchaseCost), tone: '' },
            { label: 'Total Expenses', value: formatINR(metrics.totalExpenses), tone: 'text-red-600 dark:text-red-400' },
            { label: t.cashInHand, value: formatINR(metrics.cashInHand), tone: '' },
            { label: t.upiCollection, value: formatINR(metrics.upiCollection), tone: '' },
            { label: 'Card Collection', value: formatINR(metrics.cardCollection), tone: '' },
            { label: 'Bank Collection', value: formatINR(metrics.bankCollection), tone: '' },
            { label: t.customerDues, value: formatINR(metrics.customerOutstanding), tone: 'text-amber-600 dark:text-amber-400' },
            { label: t.supplierDues, value: formatINR(metrics.supplierOutstanding), tone: 'text-red-600 dark:text-red-400' },
          ].map((k) => (
            <div
              key={k.label}
              className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5"
            >
              <div className="text-xs text-slate-500 dark:text-slate-400 truncate">{k.label}</div>
              <div className={`text-base font-extrabold mt-1 ${k.tone || 'text-[#0F172A] dark:text-white'}`}>
                {k.value}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Group 3 & 4 & 5: Inventory + Customers/Orders + Staff */}
      <div className="grid lg:grid-cols-3 gap-5 tabular-nums">
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-3">
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-bold">03. Inventory Valuation & Alerts</h3>
            <button
              type="button"
              onClick={() => onNavigateTab('inventory')}
              className="text-xs font-semibold text-amber-600 hover:underline"
            >
              Manage →
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2.5 text-xs">
            <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-950">
              <div className="text-slate-500">Total Products</div>
              <div className="text-sm font-bold mt-0.5">{metrics.totalProducts} SKUs</div>
            </div>
            <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-950">
              <div className="text-slate-500">Available Stock</div>
              <div className="text-sm font-bold mt-0.5">{metrics.totalAvailableStock} units</div>
            </div>
            <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-950">
              <div className="text-slate-500">Purchase Value</div>
              <div className="text-sm font-bold mt-0.5">{formatINR(metrics.inventoryPurchaseValue)}</div>
            </div>
            <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-950">
              <div className="text-slate-500">Selling Value</div>
              <div className="text-sm font-bold mt-0.5">{formatINR(metrics.inventorySellingValue)}</div>
            </div>
            <div className="p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300">
              <div>Low Stock</div>
              <div className="text-sm font-extrabold">{metrics.lowStockProducts}</div>
            </div>
            <div className="p-2.5 rounded-lg bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300">
              <div>Out of Stock</div>
              <div className="text-sm font-extrabold">{metrics.outOfStockProducts}</div>
            </div>
            <div className="p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300">
              <div>Near Expiry (45d)</div>
              <div className="text-sm font-extrabold">{metrics.nearExpiryProducts}</div>
            </div>
            <div className="p-2.5 rounded-lg bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300">
              <div>Expired</div>
              <div className="text-sm font-extrabold">{metrics.expiredProducts}</div>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-3">
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-bold">04. Customers & Online Orders</h3>
            <button
              type="button"
              onClick={() => onNavigateTab('orders')}
              className="text-xs font-semibold text-amber-600 hover:underline"
            >
              Orders →
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2.5 text-xs">
            <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-950">
              <div className="text-slate-500">Total Customers</div>
              <div className="text-sm font-bold mt-0.5">{metrics.totalCustomers}</div>
            </div>
            <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-950">
              <div className="text-slate-500">New / Repeat</div>
              <div className="text-sm font-bold mt-0.5">
                {metrics.newCustomers} / {metrics.repeatCustomers}
              </div>
            </div>
            <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-950">
              <div className="text-slate-500">Pending Orders</div>
              <div className="text-sm font-bold mt-0.5">{metrics.pendingOnlineOrders}</div>
            </div>
            <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-950">
              <div className="text-slate-500">In Packing</div>
              <div className="text-sm font-bold mt-0.5">{metrics.ordersInPacking}</div>
            </div>
            <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-950">
              <div className="text-slate-500">Out for Delivery</div>
              <div className="text-sm font-bold mt-0.5">{metrics.ordersOutForDelivery}</div>
            </div>
            <div className="p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300">
              <div>Delivered</div>
              <div className="text-sm font-extrabold">{metrics.deliveredOrders}</div>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-3">
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-bold">05. Staff Attendance & Sales</h3>
            <button
              type="button"
              onClick={() => onNavigateTab('staff')}
              className="text-xs font-semibold text-amber-600 hover:underline"
            >
              Staff →
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2.5 text-xs">
            <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-950">
              <div className="text-slate-500">Total Staff</div>
              <div className="text-sm font-bold mt-0.5">{metrics.totalEmployees}</div>
            </div>
            <div className="p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300">
              <div>Present Today</div>
              <div className="text-sm font-extrabold">{metrics.presentStaff}</div>
            </div>
            <div className="p-2.5 rounded-lg bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300">
              <div>Absent</div>
              <div className="text-sm font-extrabold">{metrics.absentStaff}</div>
            </div>
            <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-950">
              <div className="text-slate-500">On Leave</div>
              <div className="text-sm font-bold mt-0.5">{metrics.staffOnLeave}</div>
            </div>
          </div>
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 text-xs space-y-1">
            <div className="font-semibold text-slate-600 dark:text-slate-300">Staff-wise Sales</div>
            {staffSalesRows.length === 0 ? (
              <p className="text-slate-400">No sales logged yet.</p>
            ) : (
              staffSalesRows.map((row) => (
                <div key={row.name} className="flex justify-between">
                  <span className="truncate">{row.name} ({row.bills})</span>
                  <span className="font-bold">{formatINR(row.total)}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Analytics Charts */}
      <div className="grid lg:grid-cols-2 gap-6">
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
          <h3 className="text-sm font-bold mb-4">Category Stock Valuation (₹)</h3>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={categoryChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip formatter={(val) => formatINR(Number(val ?? 0))} />
                <Bar dataKey="value" fill="#0F172A" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
          <h3 className="text-sm font-bold mb-4">Payment & Receivables Mix</h3>
          <div className="h-64 w-full flex items-center justify-center">
            {paymentChartData.length === 0 ? (
              <p className="text-xs text-slate-400">No payment data in selected filter.</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={paymentChartData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="46%"
                    innerRadius={45}
                    outerRadius={80}
                    paddingAngle={2}
                  >
                    {paymentChartData.map((_, idx) => (
                      <Cell key={idx} fill={CHART_COLORS[idx % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(val) => formatINR(Number(val ?? 0))} />
                  <Legend wrapperStyle={{ fontSize: '12px' }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
