import React, { useState } from 'react';
import { Plus, Tag } from 'lucide-react';
import { formatINR } from '../../config/businessConfig';
import { useMall } from '../../context/MallContext';
import { Offer, OfferType } from '../../types/erp';

const OFFER_TYPES: Array<{ value: OfferType; label: string }> = [
  { value: 'flat_discount', label: 'Flat ₹ Discount' },
  { value: 'percentage_discount', label: '% Percentage Discount' },
  { value: 'bogo', label: 'Buy 1 Get 1 (BOGO)' },
  { value: 'buy2_get1', label: 'Buy 2 Get 1 Free' },
  { value: 'combo', label: 'Combo Offer' },
  { value: 'category_offer', label: 'Category Offer' },
  { value: 'product_offer', label: 'Product Specific Offer' },
  { value: 'brand_offer', label: 'Brand Offer' },
  { value: 'membership_discount', label: 'Membership Discount' },
  { value: 'weekend_deal', label: 'Weekend Deal' },
  { value: 'festival_deal', label: 'Festival Deal' },
  { value: 'min_cart_discount', label: 'Min Cart Value Discount' },
];

export const OffersModule: React.FC = () => {
  const { offers, upsertOffer, showToast } = useMall();
  const [showModal, setShowModal] = useState(false);

  const [form, setForm] = useState<Offer>({
    id: '',
    name: '',
    couponCode: '',
    description: '',
    offerType: 'percentage_discount',
    discountValue: 10,
    maxDiscount: 200,
    minPurchase: 499,
    startDate: new Date().toISOString().slice(0, 10),
    endDate: '2026-12-31',
    usageLimit: 500,
    usedCount: 0,
    stackable: false,
    active: true,
  });

  const openNewOffer = () => {
    setForm({
      id: `off_${Date.now()}`,
      name: '',
      couponCode: '',
      description: '',
      offerType: 'percentage_discount',
      discountValue: 10,
      maxDiscount: 200,
      minPurchase: 499,
      startDate: new Date().toISOString().slice(0, 10),
      endDate: '2026-12-31',
      usageLimit: 500,
      usedCount: 0,
      stackable: false,
      active: true,
    });
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.couponCode.trim()) {
      showToast('Offer name and coupon code are required.', 'error');
      return;
    }
    await upsertOffer({
      ...form,
      couponCode: form.couponCode.trim().toUpperCase(),
    });
    setShowModal(false);
  };

  const toggleActive = async (off: Offer) => {
    await upsertOffer({ ...off, active: !off.active });
  };

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold tracking-tight">Offers, Coupons & Festival Deals</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Active on both POS Terminal and Customer Online Storefront checkout
          </p>
        </div>
        <button
          type="button"
          onClick={openNewOffer}
          className="inline-flex items-center gap-1.5 rounded-lg bg-[#0F172A] dark:bg-amber-500 px-3.5 py-2 text-xs font-bold text-white dark:text-slate-950"
        >
          <Plus className="w-3.5 h-3.5" />
          Create Offer
        </button>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {offers.map((off) => (
          <div
            key={off.id}
            className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 flex flex-col justify-between gap-3"
          >
            <div className="space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="inline-flex items-center gap-1.5 font-mono text-xs font-extrabold px-2.5 py-1 rounded bg-amber-100 text-amber-900 dark:bg-amber-950/50 dark:text-amber-300">
                  <Tag className="w-3.5 h-3.5" />
                  {off.couponCode}
                </div>
                <button
                  type="button"
                  onClick={() => toggleActive(off)}
                  className={`px-2.5 py-1 rounded text-[11px] font-bold ${
                    off.active
                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300'
                      : 'bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                  }`}
                >
                  {off.active ? 'ACTIVE' : 'PAUSED'}
                </button>
              </div>
              <h3 className="text-sm font-extrabold">{off.name}</h3>
              <p className="text-xs text-slate-600 dark:text-slate-300">{off.description}</p>
            </div>

            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 text-xs space-y-1.5 tabular-nums">
              <div className="flex justify-between">
                <span className="text-slate-500">Type</span>
                <span className="font-semibold capitalize">{off.offerType.replace(/_/g, ' ')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Min Cart / Max Off</span>
                <span className="font-semibold">
                  {formatINR(off.minPurchase)} / {off.maxDiscount > 0 ? formatINR(off.maxDiscount) : 'No cap'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Validity & Usage</span>
                <span className="font-semibold">
                  {off.endDate} · {off.usedCount}/{off.usageLimit || '∞'}
                </span>
              </div>
              <div className="pt-1 flex justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setForm(off);
                    setShowModal(true);
                  }}
                  className="text-xs font-semibold text-amber-600 dark:text-amber-400 hover:underline"
                >
                  Edit Offer →
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <form
            onSubmit={handleSave}
            className="w-full max-w-lg rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 space-y-4 text-xs shadow-2xl"
          >
            <div className="flex justify-between items-center">
              <h3 className="text-base font-extrabold">Configure Offer / Coupon</h3>
              <button type="button" onClick={() => setShowModal(false)} className="text-slate-500">
                Close
              </button>
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold mb-1">Offer Name *</label>
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">Coupon Code *</label>
                <input
                  type="text"
                  required
                  value={form.couponCode}
                  onChange={(e) => setForm({ ...form, couponCode: e.target.value.toUpperCase() })}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 font-mono uppercase"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">Offer Type</label>
                <select
                  value={form.offerType}
                  onChange={(e) => setForm({ ...form, offerType: e.target.value as OfferType })}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2"
                >
                  {OFFER_TYPES.map((ot) => (
                    <option key={ot.value} value={ot.value}>
                      {ot.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-semibold mb-1">Discount Value (₹ or %)</label>
                <input
                  type="number"
                  min="0"
                  value={form.discountValue}
                  onChange={(e) => setForm({ ...form, discountValue: Number(e.target.value) || 0 })}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 tabular-nums"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">Min Purchase (₹)</label>
                <input
                  type="number"
                  min="0"
                  value={form.minPurchase}
                  onChange={(e) => setForm({ ...form, minPurchase: Number(e.target.value) || 0 })}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 tabular-nums"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">Max Discount Cap (₹)</label>
                <input
                  type="number"
                  min="0"
                  value={form.maxDiscount}
                  onChange={(e) => setForm({ ...form, maxDiscount: Number(e.target.value) || 0 })}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 tabular-nums"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">Start Date</label>
                <input
                  type="date"
                  value={form.startDate}
                  onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">End Date</label>
                <input
                  type="date"
                  value={form.endDate}
                  onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block font-semibold mb-1">Customer-Facing Description</label>
                <input
                  type="text"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2"
                />
              </div>
            </div>

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
                Save Offer
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
