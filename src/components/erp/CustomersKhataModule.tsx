import React, { useMemo, useState } from 'react';
import { Download, MessageSquare, Plus, Printer, RotateCcw, Search, Wallet } from 'lucide-react';
import { formatINR } from '../../config/businessConfig';
import { useMall } from '../../context/MallContext';
import { Customer } from '../../types/erp';
import { buildCsvString } from '../../utils/erpLogic';

export const CustomersKhataModule: React.FC = () => {
  const {
    customers,
    customerLedger,
    upsertCustomer,
    recordCustomerKhataPayment,
    dispatchNotification,
    storeSettings,
    hasPermission,
    showToast,
  } = useMall();

  const [search, setSearch] = useState('');
  const [tierFilter, setTierFilter] = useState<'ALL' | Customer['membershipTier']>('ALL');
  const [duesOnly, setDuesOnly] = useState(false);
  const [selectedCustId, setSelectedCustId] = useState<string>(customers[0]?.id || '');

  // Customer form modal
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<Customer>({
    id: '',
    name: '',
    mobile: '',
    whatsapp: '',
    email: '',
    address: '',
    area: '',
    registrationDate: new Date().toISOString().slice(0, 10),
    membershipTier: 'Standard',
    loyaltyPoints: 0,
    totalPurchase: 0,
    totalOrders: 0,
    outstandingDue: 0,
    creditLimit: 5000,
    marketingConsent: true,
    status: 'active',
  });

  // Khata payment form
  const [payAmount, setPayAmount] = useState('');
  const [payMode, setPayMode] = useState<'cash' | 'upi' | 'bank'>('cash');
  const [payNotes, setPayNotes] = useState('');
  const [isReversal, setIsReversal] = useState(false);

  const filteredCustomers = useMemo(() => {
    const q = search.trim().toLowerCase();
    return customers.filter((c) => {
      if (tierFilter !== 'ALL' && c.membershipTier !== tierFilter) return false;
      if (duesOnly && c.outstandingDue <= 0) return false;
      if (!q) return true;
      return (
        c.name.toLowerCase().includes(q) ||
        c.mobile.toLowerCase().includes(q) ||
        c.area.toLowerCase().includes(q)
      );
    });
  }, [customers, search, tierFilter, duesOnly]);

  const selectedCustomer = useMemo(
    () => customers.find((c) => c.id === selectedCustId) || filteredCustomers[0] || null,
    [customers, selectedCustId, filteredCustomers]
  );

  const selectedLedger = useMemo(() => {
    if (!selectedCustomer) return [];
    return customerLedger
      .filter((e) => e.customerId === selectedCustomer.id)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [customerLedger, selectedCustomer]);

  const totalReceivable = useMemo(
    () => customers.reduce((sum, c) => sum + Math.max(0, c.outstandingDue), 0),
    [customers]
  );

  const openNewCustomer = () => {
    setForm({
      id: `cust_${Date.now()}`,
      name: '',
      mobile: '',
      whatsapp: '',
      email: '',
      address: '',
      area: '',
      registrationDate: new Date().toISOString().slice(0, 10),
      membershipTier: 'Standard',
      loyaltyPoints: 0,
      totalPurchase: 0,
      totalOrders: 0,
      outstandingDue: 0,
      creditLimit: 5000,
      marketingConsent: true,
      status: 'active',
    });
    setShowModal(true);
  };

  const openEditCustomer = (c: Customer) => {
    setForm(c);
    setShowModal(true);
  };

  const handleSaveCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.mobile.trim()) {
      showToast('Customer name and mobile number are required.', 'error');
      return;
    }
    await upsertCustomer({
      ...form,
      whatsapp: form.whatsapp || form.mobile,
    });
    setSelectedCustId(form.id);
    setShowModal(false);
  };

  const handleKhataSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomer) return;
    const amt = Number(payAmount);
    if (!Number.isFinite(amt) || amt <= 0) {
      showToast('Enter a valid amount greater than 0.', 'error');
      return;
    }
    if (isReversal && !hasPermission('refund_approval')) {
      showToast('Manager or Owner approval required for Khata reversal.', 'error');
      return;
    }
    await recordCustomerKhataPayment({
      customerId: selectedCustomer.id,
      amount: amt,
      paymentMode: payMode,
      notes: payNotes || (isReversal ? 'Manual Khata reversal entry' : 'Khata udhaar settlement'),
      isReversal,
    });
    setPayAmount('');
    setPayNotes('');
    setIsReversal(false);
  };

  const handleSendDueReminder = async (cust: Customer) => {
    const body = `नमस्ते ${cust.name} जी, ${storeSettings.nameHi} की ओर से सूचित किया जाता है कि आपका बकाया उधार ${formatINR(cust.outstandingDue)} है। कृपया शीघ्र भुगतान करें। सहायता हेतु संपर्क: ${storeSettings.phone}`;
    await dispatchNotification({
      channel: 'whatsapp',
      recipient: cust.whatsapp || cust.mobile,
      trigger: 'khata_payment_reminder',
      body,
    });
  };

  const handleExportCustomersCsv = () => {
    const csv = buildCsvString(
      ['ID', 'Name', 'Mobile', 'Area', 'Tier', 'Loyalty Points', 'Total Purchase', 'Credit Limit', 'Outstanding Due'],
      filteredCustomers.map((c) => [
        c.id,
        c.name,
        c.mobile,
        c.area,
        c.membershipTier,
        c.loyaltyPoints,
        c.totalPurchase,
        c.creditLimit,
        c.outstandingDue,
      ])
    );
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rkmm_customers_khata_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-5">
      {/* Header & Summary */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold tracking-tight">Customers CRM & Udhaar Khata</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Total Customers: <strong>{customers.length}</strong> · Total Udhaar Receivable:{' '}
            <strong className="text-amber-600 dark:text-amber-400 tabular-nums">{formatINR(totalReceivable)}</strong>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleExportCustomersCsv}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            <Download className="w-3.5 h-3.5" />
            Export CSV
          </button>
          <button
            type="button"
            onClick={openNewCustomer}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#0F172A] dark:bg-amber-500 px-3.5 py-2 text-xs font-bold text-white dark:text-slate-950"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Customer
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by customer name, mobile, or area..."
            aria-label="Search customers"
            className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs"
          />
        </div>

        <select
          aria-label="Filter membership tier"
          value={tierFilter}
          onChange={(e) => setTierFilter(e.target.value as 'ALL' | Customer['membershipTier'])}
          className="rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs font-semibold"
        >
          <option value="ALL">All Tiers</option>
          <option value="Standard">Standard</option>
          <option value="Silver">Silver</option>
          <option value="Gold">Gold</option>
          <option value="Platinum">Platinum</option>
        </select>

        <label className="inline-flex items-center gap-2 text-xs font-semibold cursor-pointer">
          <input
            type="checkbox"
            checked={duesOnly}
            onChange={(e) => setDuesOnly(e.target.checked)}
          />
          Udhaar Dues Only
        </label>
      </div>

      {/* Split Workspace: Customer List | Selected Customer Khata Ledger */}
      <div className="grid lg:grid-cols-12 gap-5 items-start">
        <div className="lg:col-span-6 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
          <div className="overflow-x-auto max-h-[560px]">
            <table className="w-full text-xs text-left">
              <thead className="sticky top-0 bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 text-slate-500">
                <tr>
                  <th className="p-3">Customer</th>
                  <th className="p-3">Tier / Points</th>
                  <th className="p-3 text-right">Purchase</th>
                  <th className="p-3 text-right">Khata Due</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 tabular-nums">
                {filteredCustomers.map((c) => {
                  const active = selectedCustomer?.id === c.id;
                  const nearLimit = c.creditLimit > 0 && c.outstandingDue >= c.creditLimit * 0.85;
                  return (
                    <tr
                      key={c.id}
                      onClick={() => setSelectedCustId(c.id)}
                      className={`cursor-pointer transition-colors ${
                        active ? 'bg-amber-50 dark:bg-amber-950/30' : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                      }`}
                    >
                      <td className="p-3">
                        <div className="font-bold text-slate-900 dark:text-white">{c.name}</div>
                        <div className="text-[11px] text-slate-500">
                          {c.mobile} · {c.area || 'Local'}
                        </div>
                      </td>
                      <td className="p-3">
                        <div className="font-semibold">{c.membershipTier}</div>
                        <div className="text-[11px] text-slate-500">{c.loyaltyPoints} pts</div>
                      </td>
                      <td className="p-3 text-right font-medium">{formatINR(c.totalPurchase)}</td>
                      <td className="p-3 text-right">
                        <div
                          className={`font-extrabold ${
                            c.outstandingDue > 0 ? 'text-red-600 dark:text-red-400' : 'text-emerald-600'
                          }`}
                        >
                          {formatINR(c.outstandingDue)}
                        </div>
                        {nearLimit && (
                          <div className="text-[10px] text-amber-700 dark:text-amber-300 font-semibold">
                            Limit {formatINR(c.creditLimit)}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Panel: Selected Customer Profile + Khata Settlement + Statement */}
        <div className="lg:col-span-6 space-y-4">
          {!selectedCustomer ? (
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 text-center text-xs text-slate-400">
              Select a customer to view Khata udhaar ledger and record payments.
            </div>
          ) : (
            <>
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="text-base font-extrabold">{selectedCustomer.name}</h3>
                    <p className="text-xs text-slate-500">
                      {selectedCustomer.mobile} · {selectedCustomer.address || 'Address not set'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => openEditCustomer(selectedCustomer)}
                      className="px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-semibold"
                    >
                      Edit Profile
                    </button>
                    <button
                      type="button"
                      onClick={() => window.print()}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-semibold"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      Statement
                    </button>
                    {selectedCustomer.outstandingDue > 0 && (
                      <button
                        type="button"
                        onClick={() => handleSendDueReminder(selectedCustomer)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        Remind Due
                      </button>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3 text-xs tabular-nums">
                  <div className="rounded-lg bg-slate-50 dark:bg-slate-950 p-3">
                    <div className="text-slate-500">Outstanding Due</div>
                    <div className="text-base font-extrabold text-red-600 dark:text-red-400 mt-0.5">
                      {formatINR(selectedCustomer.outstandingDue)}
                    </div>
                  </div>
                  <div className="rounded-lg bg-slate-50 dark:bg-slate-950 p-3">
                    <div className="text-slate-500">Credit Limit</div>
                    <div className="text-base font-extrabold mt-0.5">
                      {formatINR(selectedCustomer.creditLimit)}
                    </div>
                  </div>
                  <div className="rounded-lg bg-slate-50 dark:bg-slate-950 p-3">
                    <div className="text-slate-500">Loyalty Points</div>
                    <div className="text-base font-extrabold text-amber-600 mt-0.5">
                      {selectedCustomer.loyaltyPoints} pts
                    </div>
                  </div>
                </div>

                {/* Record Payment / Reversal */}
                <form
                  onSubmit={handleKhataSubmit}
                  className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-3 space-y-2.5 text-xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold flex items-center gap-1.5">
                      <Wallet className="w-3.5 h-3.5 text-emerald-600" />
                      Record Khata Payment / Settlement
                    </span>
                    <label className="inline-flex items-center gap-1.5 text-[11px] font-semibold cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isReversal}
                        onChange={(e) => setIsReversal(e.target.checked)}
                      />
                      <RotateCcw className="w-3 h-3" />
                      Reversal / Debit Entry
                    </label>
                  </div>
                  <div className="grid sm:grid-cols-3 gap-2">
                    <input
                      type="number"
                      min="1"
                      step="0.01"
                      required
                      value={payAmount}
                      onChange={(e) => setPayAmount(e.target.value)}
                      placeholder="Amount (₹)"
                      aria-label="Khata payment amount"
                      className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 tabular-nums"
                    />
                    <select
                      aria-label="Khata payment mode"
                      value={payMode}
                      onChange={(e) => setPayMode(e.target.value as 'cash' | 'upi' | 'bank')}
                      className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2"
                    >
                      <option value="cash">Cash</option>
                      <option value="upi">UPI / QR</option>
                      <option value="bank">Bank Transfer</option>
                    </select>
                    <input
                      type="text"
                      value={payNotes}
                      onChange={(e) => setPayNotes(e.target.value)}
                      placeholder="Notes / Ref #"
                      className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2"
                    />
                  </div>
                  <button
                    type="submit"
                    className={`w-full py-2 rounded-lg font-bold text-white ${
                      isReversal ? 'bg-amber-600 hover:bg-amber-700' : 'bg-emerald-600 hover:bg-emerald-700'
                    }`}
                  >
                    {isReversal ? 'Post Reversal / Credit Adjustment' : 'Receive Payment & Update Ledger'}
                  </button>
                </form>
              </div>

              {/* Ledger History */}
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-3">
                <h4 className="text-sm font-bold">Immutable Khata Ledger Statement</h4>
                <div className="overflow-x-auto max-h-64">
                  <table className="w-full text-xs text-left">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500">
                        <th className="py-2">Date / Ref</th>
                        <th className="py-2">Type</th>
                        <th className="py-2 text-right">Credit (+)</th>
                        <th className="py-2 text-right">Paid (-)</th>
                        <th className="py-2 text-right">Balance</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 tabular-nums">
                      {selectedLedger.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-6 text-center text-slate-400">
                            No Khata ledger entries yet for this customer.
                          </td>
                        </tr>
                      ) : (
                        selectedLedger.map((entry) => (
                          <tr key={entry.id}>
                            <td className="py-2">
                              <div className="font-mono font-semibold">{entry.invoiceNo}</div>
                              <div className="text-[11px] text-slate-500">
                                {entry.createdAt.slice(0, 10)} · {entry.notes}
                              </div>
                            </td>
                            <td className="py-2 uppercase text-[11px]">{entry.entryType.replace('_', ' ')}</td>
                            <td className="py-2 text-right text-red-600">
                              {entry.creditAdded > 0 ? formatINR(entry.creditAdded) : '—'}
                            </td>
                            <td className="py-2 text-right text-emerald-600">
                              {entry.paymentReceived > 0 ? formatINR(entry.paymentReceived) : '—'}
                            </td>
                            <td className="py-2 text-right font-bold">{formatINR(entry.remainingDue)}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Add/Edit Customer Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <form
            onSubmit={handleSaveCustomer}
            className="w-full max-w-lg rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 space-y-4 text-xs shadow-2xl"
          >
            <div className="flex justify-between items-center">
              <h3 className="text-base font-extrabold">Customer Profile</h3>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="text-slate-500 hover:text-slate-800"
              >
                Close
              </button>
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">Mobile Number *</label>
                <input
                  type="tel"
                  required
                  value={form.mobile}
                  onChange={(e) => setForm({ ...form, mobile: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">WhatsApp Number</label>
                <input
                  type="tel"
                  value={form.whatsapp}
                  onChange={(e) => setForm({ ...form, whatsapp: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">Area / Locality</label>
                <input
                  type="text"
                  value={form.area}
                  onChange={(e) => setForm({ ...form, area: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block font-semibold mb-1">Full Address</label>
                <input
                  type="text"
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">Membership Tier</label>
                <select
                  value={form.membershipTier}
                  onChange={(e) => setForm({ ...form, membershipTier: e.target.value as Customer['membershipTier'] })}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2"
                >
                  <option value="Standard">Standard</option>
                  <option value="Silver">Silver</option>
                  <option value="Gold">Gold</option>
                  <option value="Platinum">Platinum</option>
                </select>
              </div>
              <div>
                <label className="block font-semibold mb-1">Udhaar Credit Limit (₹)</label>
                <input
                  type="number"
                  min="0"
                  value={form.creditLimit}
                  onChange={(e) => setForm({ ...form, creditLimit: Number(e.target.value) || 0 })}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 tabular-nums"
                />
              </div>
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.marketingConsent}
                onChange={(e) => setForm({ ...form, marketingConsent: e.target.checked })}
              />
              Customer consented to WhatsApp offers & reminders
            </label>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-lg bg-[#0F172A] dark:bg-amber-500 text-white dark:text-slate-950 font-bold"
              >
                Save Customer
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
