import React, { useState } from 'react';
import { Database, Download, ShieldAlert, Sparkles, Trash2, Upload } from 'lucide-react';
import { BOOTSTRAP_OWNER_EMAIL } from '../../config/businessConfig';
import { useMall } from '../../context/MallContext';

export const SettingsSecurityModule: React.FC = () => {
  const {
    storeSettings,
    saveStoreSettings,
    seedDemoDataToCloud,
    purgeDemoDataFromCloud,
    exportBackupJson,
    auditLogs,
    isCloudLive,
    actualRole,
    showToast,
  } = useMall();

  const [form, setForm] = useState(storeSettings);
  const [confirmPurge, setConfirmPurge] = useState(false);
  const [restorePreview, setRestorePreview] = useState<{
    products?: number;
    customers?: number;
    sales?: number;
    exportedAt?: string;
  } | null>(null);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    await saveStoreSettings(form);
  };

  const handleDownloadBackup = () => {
    const json = exportBackupJson();
    const blob = new Blob([json], { type: 'application/json;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rk_mini_mall_backup_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Full JSON backup downloaded.', 'success');
  };

  const handleValidateBackupFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      if (!parsed.storeSettings || !Array.isArray(parsed.products)) {
        throw new Error('Invalid backup structure');
      }
      setRestorePreview({
        products: parsed.products.length,
        customers: Array.isArray(parsed.customers) ? parsed.customers.length : 0,
        sales: Array.isArray(parsed.sales) ? parsed.sales.length : 0,
        exportedAt: parsed.exportedAt,
      });
      showToast('Backup JSON validated successfully.', 'success');
    } catch {
      showToast('Backup JSON failed schema validation.', 'error');
      setRestorePreview(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Owner Setup Wizard: Cloud Demo Seed & Safe Demo Purge */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-extrabold tracking-tight">
              Store Settings, Demo Setup Wizard, Audit Logs & Backup
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Bootstrap Owner: <span className="font-mono">{BOOTSTRAP_OWNER_EMAIL}</span> · Active Role:{' '}
              <strong className="uppercase">{actualRole}</strong> · Cloud Sync:{' '}
              <strong>{isCloudLive ? 'Connected' : 'Demo Sandbox'}</strong>
            </p>
          </div>
          <button
            type="button"
            onClick={handleDownloadBackup}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#0F172A] dark:bg-amber-500 text-white dark:text-slate-950 text-xs font-bold"
          >
            <Download className="w-3.5 h-3.5" />
            Download Full JSON Backup
          </button>
        </div>

        <div className="grid md:grid-cols-2 gap-4 pt-2 border-t border-slate-100 dark:border-slate-800">
          <div className="rounded-lg bg-slate-50 dark:bg-slate-950 p-4 space-y-2 text-xs">
            <div className="font-bold flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-amber-500" />
              One-Click Demo Data Seeder (20 Products & Sample ERP)
            </div>
            <p className="text-slate-500">
              Seeds all 20 supermarket products, sample Khata customers, suppliers, offers, staff, and sample bills tagged{' '}
              <code className="font-mono">isDemo: true</code> into Firestore.
            </p>
            <button
              type="button"
              onClick={seedDemoDataToCloud}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold"
            >
              <Database className="w-3.5 h-3.5" />
              Seed 20 Demo Products to Cloud
            </button>
          </div>

          <div className="rounded-lg bg-red-50/60 dark:bg-red-950/20 border border-red-200 dark:border-red-900/50 p-4 space-y-2 text-xs">
            <div className="font-bold text-red-700 dark:text-red-300 flex items-center gap-1.5">
              <Trash2 className="w-4 h-4" />
              Purge Demo Data Only (Go-Live Cleanup)
            </div>
            <p className="text-slate-600 dark:text-slate-300">
              Safely removes records flagged <code className="font-mono">isDemo: true</code>. Real live customer orders, bills, and stock remain untouched.
            </p>
            {!confirmPurge ? (
              <button
                type="button"
                onClick={() => setConfirmPurge(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-red-300 dark:border-red-800 text-red-700 dark:text-red-300 font-bold"
              >
                Clear All Demo Data
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={async () => {
                    await purgeDemoDataFromCloud();
                    setConfirmPurge(false);
                  }}
                  className="px-3 py-2 rounded-lg bg-red-600 text-white font-bold"
                >
                  Confirm Delete Demo Records
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmPurge(false)}
                  className="px-3 py-2 rounded-lg border border-slate-300 font-semibold"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Central Store Configuration Form */}
      <form
        onSubmit={handleSaveSettings}
        className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4 text-xs"
      >
        <h3 className="text-base font-extrabold">Central Store & Billing Configuration</h3>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <label className="block font-semibold mb-1">Store Name (Hindi)</label>
            <input
              type="text"
              value={form.nameHi}
              onChange={(e) => setForm({ ...form, nameHi: e.target.value })}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2"
            />
          </div>
          <div>
            <label className="block font-semibold mb-1">Store Name (English)</label>
            <input
              type="text"
              value={form.nameEn}
              onChange={(e) => setForm({ ...form, nameEn: e.target.value })}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2"
            />
          </div>
          <div>
            <label className="block font-semibold mb-1">Tagline</label>
            <input
              type="text"
              value={form.tagline}
              onChange={(e) => setForm({ ...form, tagline: e.target.value })}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2"
            />
          </div>
          <div>
            <label className="block font-semibold mb-1">Official Phone</label>
            <input
              type="tel"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2"
            />
          </div>
          <div>
            <label className="block font-semibold mb-1">Official WhatsApp Phone</label>
            <input
              type="tel"
              value={form.whatsappPhone}
              onChange={(e) => setForm({ ...form, whatsappPhone: e.target.value })}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2"
            />
          </div>
          <div>
            <label className="block font-semibold mb-1">Store Address</label>
            <input
              type="text"
              placeholder="Enter complete store address"
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2"
            />
          </div>
          <div>
            <label className="block font-semibold mb-1">GSTIN (Optional until registered)</label>
            <input
              type="text"
              placeholder="e.g. 10AAAAA0000A1Z5"
              value={form.gstin}
              onChange={(e) => setForm({ ...form, gstin: e.target.value.toUpperCase() })}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 font-mono uppercase"
            />
          </div>
          <div>
            <label className="block font-semibold mb-1">Store UPI ID</label>
            <input
              type="text"
              placeholder="e.g. rkminimall@upi"
              value={form.upiId}
              onChange={(e) => setForm({ ...form, upiId: e.target.value })}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2"
            />
          </div>
          <div>
            <label className="block font-semibold mb-1">Opening Hours</label>
            <input
              type="text"
              value={form.openingHours}
              onChange={(e) => setForm({ ...form, openingHours: e.target.value })}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2"
            />
          </div>
          <div>
            <label className="block font-semibold mb-1">Delivery Charge (₹)</label>
            <input
              type="number"
              min="0"
              value={form.deliveryCharge}
              onChange={(e) => setForm({ ...form, deliveryCharge: Number(e.target.value) || 0 })}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 tabular-nums"
            />
          </div>
          <div>
            <label className="block font-semibold mb-1">Free Delivery Above (₹)</label>
            <input
              type="number"
              min="0"
              value={form.freeDeliveryAbove}
              onChange={(e) => setForm({ ...form, freeDeliveryAbove: Number(e.target.value) || 0 })}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 tabular-nums"
            />
          </div>
          <div>
            <label className="block font-semibold mb-1">Invoice Prefix / Next Seq</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={form.invoicePrefix}
                onChange={(e) => setForm({ ...form, invoicePrefix: e.target.value.toUpperCase() })}
                className="w-24 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 font-mono uppercase"
              />
              <input
                type="number"
                min="1"
                value={form.invoiceSequence}
                onChange={(e) => setForm({ ...form, invoiceSequence: Number(e.target.value) || 1001 })}
                className="flex-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 tabular-nums"
              />
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-5 pt-2">
          <label className="flex items-center gap-2 cursor-pointer font-semibold">
            <input
              type="checkbox"
              checked={form.isOpen}
              onChange={(e) => setForm({ ...form, isOpen: e.target.checked })}
            />
            Store Currently Open
          </label>
          <label className="flex items-center gap-2 cursor-pointer font-semibold">
            <input
              type="checkbox"
              checked={form.gstInclusive}
              onChange={(e) => setForm({ ...form, gstInclusive: e.target.checked })}
            />
            MRP / Selling Prices are GST Inclusive
          </label>
          <label className="flex items-center gap-2 cursor-pointer font-semibold">
            <input
              type="checkbox"
              checked={form.reserveOnlineStock}
              onChange={(e) => setForm({ ...form, reserveOnlineStock: e.target.checked })}
            />
            Reserve Inventory when Online Order is Confirmed
          </label>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            className="px-5 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
          >
            Save Store Configuration
          </button>
        </div>
      </form>

      {/* Backup Validator & Audit Logs */}
      <div className="grid lg:grid-cols-12 gap-5 items-start">
        <div className="lg:col-span-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-3 text-xs">
          <h3 className="text-sm font-bold flex items-center gap-1.5">
            <Upload className="w-4 h-4 text-amber-600" />
            Validate Backup JSON (Disaster Recovery)
          </h3>
          <input
            type="file"
            accept="application/json"
            aria-label="Validate JSON backup file"
            onChange={handleValidateBackupFile}
            className="w-full text-xs"
          />
          {restorePreview && (
            <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950/30 p-3 space-y-1">
              <div className="font-bold text-emerald-700 dark:text-emerald-300">Valid Backup Schema</div>
              <div>Exported: {restorePreview.exportedAt?.slice(0, 19)}</div>
              <div>Products: {restorePreview.products} · Customers: {restorePreview.customers} · Bills: {restorePreview.sales}</div>
            </div>
          )}
        </div>

        <div className="lg:col-span-8 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-3">
          <h3 className="text-sm font-bold flex items-center gap-1.5">
            <ShieldAlert className="w-4 h-4 text-slate-500" />
            Immutable Audit Logs
          </h3>
          <div className="overflow-x-auto max-h-64">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500">
                  <th className="py-2">Time</th>
                  <th className="py-2">Actor</th>
                  <th className="py-2">Action</th>
                  <th className="py-2">Summary</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {auditLogs.slice(0, 20).map((log) => (
                  <tr key={log.id}>
                    <td className="py-2 font-mono text-[11px]">{log.createdAt.slice(0, 19).replace('T', ' ')}</td>
                    <td className="py-2">{log.actorEmail}</td>
                    <td className="py-2 font-mono font-semibold">{log.action}</td>
                    <td className="py-2">{log.summary}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
