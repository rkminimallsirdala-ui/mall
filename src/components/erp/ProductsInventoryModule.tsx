import React, { useMemo, useState } from 'react';
import { AlertTriangle, Barcode, Copy, Plus, Archive, Upload } from 'lucide-react';
import { formatINR } from '../../config/businessConfig';
import { useMall } from '../../context/MallContext';
import { MovementType, Product, ProductUnit } from '../../types/erp';
import { classifyProductAlerts } from '../../utils/erpLogic';
import { BarcodeLabelModal } from '../common/BarcodeLabelModal';

const UNITS: ProductUnit[] = ['KG', 'GM', 'LITRE', 'ML', 'PCS', 'PACKET', 'BOX', 'BOTTLE', 'CARTON', 'BUNDLE'];

export const ProductsInventoryModule: React.FC<{ initialSubTab?: 'products' | 'inventory' }> = ({
  initialSubTab = 'products',
}) => {
  const {
    products,
    movements,
    storeSettings,
    upsertProduct,
    archiveProduct,
    bulkImportProducts,
    adjustStock,
    showToast,
  } = useMall();

  const [subTab, setSubTab] = useState<'products' | 'inventory' | 'alerts' | 'ledger'>(initialSubTab);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<Product | null>(null);
  const [barcodeProduct, setBarcodeProduct] = useState<Product | null>(null);
  const [bulkCsvText, setBulkCsvText] = useState('');
  const [showBulkModal, setShowBulkModal] = useState(false);

  // Stock adjustment form
  const [adjProdId, setAdjProdId] = useState(products[0]?.id || '');
  const [adjType, setAdjType] = useState<MovementType>('stock_inward');
  const [adjQty, setAdjQty] = useState(10);
  const [adjReason, setAdjReason] = useState('');
  const [adjRef, setAdjRef] = useState('');
  const [overrideNeg, setOverrideNeg] = useState(false);

  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter(
      (p) =>
        !q ||
        p.nameEn.toLowerCase().includes(q) ||
        p.nameHi.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        p.barcode.includes(q)
    );
  }, [products, search]);

  const alertRows = useMemo(
    () =>
      products
        .filter((p) => p.active)
        .map((p) => ({ product: p, alerts: classifyProductAlerts(p) }))
        .filter((r) => r.alerts.length > 0),
    [products]
  );

  const createBlankProduct = (): Product => ({
    id: `prod_${Date.now()}`,
    nameHi: '',
    nameEn: '',
    imageUrl: '',
    sku: `RK-${Math.floor(1000 + Math.random() * 9000)}`,
    barcode: `890${Math.floor(1000000000 + Math.random() * 8999999999)}`,
    category: 'Staples & Grains',
    subcategory: 'General',
    brand: '',
    manufacturer: '',
    hsnCode: '',
    gstRate: 5,
    unit: 'PACKET',
    packSize: '1 PACK',
    purchaseRate: 0,
    mrp: 0,
    sellingPrice: 0,
    wholesalePrice: 0,
    discountPercent: 0,
    openingStock: 0,
    currentStock: 0,
    reservedStock: 0,
    minStock: 10,
    maxStock: 100,
    reorderLevel: 15,
    rackNumber: 'A-01',
    batchNumber: `B-${new Date().getFullYear()}`,
    mfgDate: new Date().toISOString().slice(0, 10),
    expiryDate: '2027-12-31',
    description: '',
    active: true,
  });

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    if (!editing.nameEn.trim() || !editing.nameHi.trim()) {
      showToast('Both Hindi and English product names are required.', 'error');
      return;
    }
    await upsertProduct(editing);
    setEditing(null);
  };

  const handleBulkImport = async () => {
    const lines = bulkCsvText
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
    const imported: Product[] = [];
    for (const line of lines) {
      const [nameHi, nameEn, category, unit, mrp, sellingPrice, purchaseRate, stock] = line
        .split(',')
        .map((s) => s.trim());
      if (!nameEn) continue;
      imported.push({
        ...createBlankProduct(),
        id: `prod_imp_${Date.now()}_${imported.length}`,
        nameHi: nameHi || nameEn,
        nameEn,
        category: category || 'Staples & Grains',
        unit: (UNITS.includes(unit as ProductUnit) ? unit : 'PCS') as ProductUnit,
        mrp: Number(mrp) || 0,
        sellingPrice: Number(sellingPrice) || Number(mrp) || 0,
        purchaseRate: Number(purchaseRate) || 0,
        openingStock: Number(stock) || 0,
        currentStock: Number(stock) || 0,
      });
    }
    if (imported.length === 0) {
      showToast('No valid CSV rows parsed.', 'error');
      return;
    }
    await bulkImportProducts(imported);
    setShowBulkModal(false);
    setBulkCsvText('');
  };

  const handleStockAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjProdId || adjQty <= 0 || !adjReason.trim()) {
      showToast('Select product, positive quantity, and reason.', 'error');
      return;
    }
    try {
      await adjustStock({
        productId: adjProdId,
        type: adjType,
        qty: adjQty,
        reason: adjReason.trim(),
        referenceNo: adjRef.trim() || `ADJ-${Date.now().toString().slice(-5)}`,
        overrideNegative: overrideNeg,
      });
      setAdjReason('');
      setAdjRef('');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Stock update failed', 'error');
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
        <div className="flex flex-wrap gap-1.5 text-xs">
          {(
            [
              ['products', 'Product Master'],
              ['inventory', 'Stock Adjustments'],
              ['alerts', `Alerts (${alertRows.length})`],
              ['ledger', `Movement Ledger (${movements.length})`],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              type="button"
              onClick={() => setSubTab(k)}
              className={`px-3.5 py-2 rounded-lg font-semibold ${
                subTab === k
                  ? 'bg-[#0F172A] text-white dark:bg-amber-500 dark:text-slate-950'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setShowBulkModal(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-semibold"
          >
            <Upload className="w-3.5 h-3.5" />
            Bulk CSV Import
          </button>
          <button
            type="button"
            onClick={() => setEditing(createBlankProduct())}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Product
          </button>
        </div>
      </div>

      {subTab === 'products' && (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-4">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by Hindi/English name, SKU, or Barcode..."
            aria-label="Filter product master"
            className="w-full sm:w-96 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-sm"
          />

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500">
                  <th className="py-2.5">Product (HI / EN)</th>
                  <th className="py-2.5">SKU / Barcode</th>
                  <th className="py-2.5">Category / Rack</th>
                  <th className="py-2.5 text-right">Purchase</th>
                  <th className="py-2.5 text-right">MRP / Sell</th>
                  <th className="py-2.5 text-right">GST</th>
                  <th className="py-2.5 text-right">Stock</th>
                  <th className="py-2.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredProducts.map((p) => (
                  <tr
                    key={p.id}
                    className={`border-b border-slate-100 dark:border-slate-800/60 tabular-nums ${
                      !p.active ? 'opacity-50' : ''
                    }`}
                  >
                    <td className="py-2.5 pr-2">
                      <div className="font-bold">
                        {p.nameHi} {p.isDemo ? '(DEMO)' : ''}
                      </div>
                      <div className="text-slate-500">
                        {p.nameEn} · {p.packSize}
                      </div>
                    </td>
                    <td className="py-2.5 font-mono">
                      <div>{p.sku}</div>
                      <div className="text-[11px] text-slate-400">{p.barcode}</div>
                    </td>
                    <td className="py-2.5">
                      <div>{p.category}</div>
                      <div className="text-[11px] text-slate-500">Rack {p.rackNumber}</div>
                    </td>
                    <td className="py-2.5 text-right">{formatINR(p.purchaseRate)}</td>
                    <td className="py-2.5 text-right">
                      <span className="text-slate-400 line-through mr-1">{p.mrp}</span>
                      <strong>{formatINR(p.sellingPrice)}</strong>
                    </td>
                    <td className="py-2.5 text-right">{p.gstRate}%</td>
                    <td className="py-2.5 text-right font-bold">
                      {p.currentStock} {p.unit}
                    </td>
                    <td className="py-2.5 text-right whitespace-nowrap space-x-1">
                      <button
                        type="button"
                        onClick={() => setEditing(p)}
                        className="px-2 py-1 rounded border border-slate-300 dark:border-slate-700 font-semibold"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setEditing({
                            ...p,
                            id: `prod_${Date.now()}`,
                            sku: `${p.sku}-COPY`,
                            nameEn: `${p.nameEn} (Copy)`,
                            isDemo: false,
                          })
                        }
                        aria-label={`Duplicate ${p.nameEn}`}
                        className="p-1 rounded border border-slate-300 dark:border-slate-700"
                        title="Duplicate Product"
                      >
                        <Copy className="w-3.5 h-3.5 inline" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setBarcodeProduct(p)}
                        aria-label={`Print barcode for ${p.nameEn}`}
                        className="p-1 rounded border border-slate-300 dark:border-slate-700"
                        title="Print Barcode"
                      >
                        <Barcode className="w-3.5 h-3.5 inline" />
                      </button>
                      {p.active && (
                        <button
                          type="button"
                          onClick={() => archiveProduct(p.id)}
                          aria-label={`Archive ${p.nameEn}`}
                          className="p-1 rounded border border-red-200 dark:border-red-900 text-red-600"
                          title="Archive Product"
                        >
                          <Archive className="w-3.5 h-3.5 inline" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {subTab === 'inventory' && (
        <form
          onSubmit={handleStockAdjustment}
          className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4 max-w-2xl"
        >
          <h3 className="text-base font-bold">Stock Inward / Outward / Adjustment / Return</h3>
          <div className="grid sm:grid-cols-2 gap-3 text-xs">
            <div>
              <label className="block font-semibold mb-1">Product</label>
              <select
                value={adjProdId}
                onChange={(e) => setAdjProdId(e.target.value)}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2"
              >
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nameEn} (Current: {p.currentStock} {p.unit})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-semibold mb-1">Movement Type</label>
              <select
                value={adjType}
                onChange={(e) => setAdjType(e.target.value as MovementType)}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2"
              >
                <option value="stock_inward">Stock Inward (+)</option>
                <option value="customer_return">Customer Return (+)</option>
                <option value="stock_outward">Stock Outward (-)</option>
                <option value="damaged">Damaged / Wastage (-)</option>
                <option value="supplier_return">Supplier Return (-)</option>
                <option value="transfer">Rack / Branch Transfer (-)</option>
              </select>
            </div>
            <div>
              <label className="block font-semibold mb-1">Quantity</label>
              <input
                type="number"
                step="0.1"
                min="0.1"
                required
                value={adjQty}
                onChange={(e) => setAdjQty(Number(e.target.value) || 0)}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2"
              />
            </div>
            <div>
              <label className="block font-semibold mb-1">Reference Number</label>
              <input
                type="text"
                value={adjRef}
                onChange={(e) => setAdjRef(e.target.value)}
                placeholder="GRN / Slip No"
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2"
              />
            </div>
          </div>
          <div className="text-xs">
            <label className="block font-semibold mb-1">Audit Reason *</label>
            <input
              type="text"
              required
              value={adjReason}
              onChange={(e) => setAdjReason(e.target.value)}
              placeholder="Physical count verification, damaged pack, or inward slip..."
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2"
            />
          </div>
          <label className="flex items-center gap-2 text-xs font-medium">
            <input
              type="checkbox"
              checked={overrideNeg}
              onChange={(e) => setOverrideNeg(e.target.checked)}
            />
            Authorized Negative Stock Override (logged in Audit Trail)
          </label>
          <button
            type="submit"
            className="px-4 py-2 rounded-lg bg-[#0F172A] dark:bg-amber-500 text-white dark:text-slate-950 text-xs font-bold"
          >
            Record Stock Movement
          </button>
        </form>
      )}

      {subTab === 'alerts' && (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-3">
          <h3 className="text-sm font-bold flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            Low Stock, Out of Stock & Expiry Alerts (FEFO)
          </h3>
          {alertRows.length === 0 ? (
            <p className="text-xs text-slate-500">All products are healthy and well-stocked.</p>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
              {alertRows.map(({ product, alerts }) => (
                <div key={product.id} className="py-2.5 flex flex-wrap justify-between gap-2 tabular-nums">
                  <div>
                    <span className="font-bold">{product.nameEn}</span> ({product.nameHi}) · Batch{' '}
                    <span className="font-mono">{product.batchNumber}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span>
                      Stock: <strong>{product.currentStock}</strong> / Reorder: {product.reorderLevel}
                    </span>
                    <span>Exp: {product.expiryDate}</span>
                    <span className="font-bold text-red-600 dark:text-red-400 uppercase">
                      {alerts.join(' · ').replace(/_/g, ' ')}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {subTab === 'ledger' && (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500">
                <th className="py-2">Date & Time</th>
                <th className="py-2">Product</th>
                <th className="py-2">Type</th>
                <th className="py-2 text-right">Prev</th>
                <th className="py-2 text-right">In</th>
                <th className="py-2 text-right">Out</th>
                <th className="py-2 text-right">New</th>
                <th className="py-2">Reason / Ref</th>
                <th className="py-2">Staff</th>
              </tr>
            </thead>
            <tbody>
              {movements.map((m) => (
                <tr key={m.id} className="border-b border-slate-100 dark:border-slate-800/60 tabular-nums">
                  <td className="py-2 whitespace-nowrap">
                    {new Date(m.createdAt).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}
                  </td>
                  <td className="py-2 font-semibold">{m.productName}</td>
                  <td className="py-2 uppercase">{m.type.replace(/_/g, ' ')}</td>
                  <td className="py-2 text-right">{m.previousStock}</td>
                  <td className="py-2 text-right text-emerald-600 font-bold">{m.stockIn || '-'}</td>
                  <td className="py-2 text-right text-red-600 font-bold">{m.stockOut || '-'}</td>
                  <td className="py-2 text-right font-bold">{m.newStock}</td>
                  <td className="py-2">
                    {m.reason} ({m.referenceNo})
                  </td>
                  <td className="py-2">{m.staffName}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Product Add/Edit Modal */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 overflow-y-auto">
          <form
            onSubmit={handleSaveProduct}
            className="w-full max-w-3xl rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto"
          >
            <h3 className="text-base font-extrabold">Product Master Details</h3>
            <div className="grid sm:grid-cols-3 gap-3 text-xs">
              <div>
                <label className="block font-semibold mb-1">Hindi Name *</label>
                <input
                  required
                  value={editing.nameHi}
                  onChange={(e) => setEditing({ ...editing, nameHi: e.target.value })}
                  className="w-full rounded border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2.5 py-1.5"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">English Name *</label>
                <input
                  required
                  value={editing.nameEn}
                  onChange={(e) => setEditing({ ...editing, nameEn: e.target.value })}
                  className="w-full rounded border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2.5 py-1.5"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">Brand</label>
                <input
                  value={editing.brand}
                  onChange={(e) => setEditing({ ...editing, brand: e.target.value })}
                  className="w-full rounded border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2.5 py-1.5"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">SKU</label>
                <input
                  required
                  value={editing.sku}
                  onChange={(e) => setEditing({ ...editing, sku: e.target.value })}
                  className="w-full rounded border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2.5 py-1.5 font-mono"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">Barcode</label>
                <input
                  value={editing.barcode}
                  onChange={(e) => setEditing({ ...editing, barcode: e.target.value })}
                  className="w-full rounded border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2.5 py-1.5 font-mono"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">Category</label>
                <input
                  value={editing.category}
                  onChange={(e) => setEditing({ ...editing, category: e.target.value })}
                  className="w-full rounded border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2.5 py-1.5"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">Unit</label>
                <select
                  value={editing.unit}
                  onChange={(e) => setEditing({ ...editing, unit: e.target.value as ProductUnit })}
                  className="w-full rounded border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2.5 py-1.5"
                >
                  {UNITS.map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-semibold mb-1">Pack Size</label>
                <input
                  value={editing.packSize}
                  onChange={(e) => setEditing({ ...editing, packSize: e.target.value })}
                  className="w-full rounded border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2.5 py-1.5"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">HSN / GST Rate (%)</label>
                <div className="flex gap-1">
                  <input
                    placeholder="HSN"
                    value={editing.hsnCode}
                    onChange={(e) => setEditing({ ...editing, hsnCode: e.target.value })}
                    className="w-1/2 rounded border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2 py-1.5"
                  />
                  <input
                    type="number"
                    value={editing.gstRate}
                    onChange={(e) => setEditing({ ...editing, gstRate: Number(e.target.value) || 0 })}
                    className="w-1/2 rounded border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2 py-1.5"
                  />
                </div>
              </div>
              <div>
                <label className="block font-semibold mb-1">Purchase Rate (₹)</label>
                <input
                  type="number"
                  step="0.01"
                  value={editing.purchaseRate}
                  onChange={(e) => setEditing({ ...editing, purchaseRate: Number(e.target.value) || 0 })}
                  className="w-full rounded border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2.5 py-1.5"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">MRP (₹)</label>
                <input
                  type="number"
                  step="0.01"
                  value={editing.mrp}
                  onChange={(e) => setEditing({ ...editing, mrp: Number(e.target.value) || 0 })}
                  className="w-full rounded border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2.5 py-1.5"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">Selling Price (₹)</label>
                <input
                  type="number"
                  step="0.01"
                  value={editing.sellingPrice}
                  onChange={(e) => setEditing({ ...editing, sellingPrice: Number(e.target.value) || 0 })}
                  className="w-full rounded border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2.5 py-1.5"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">Current Stock</label>
                <input
                  type="number"
                  step="0.1"
                  value={editing.currentStock}
                  onChange={(e) => setEditing({ ...editing, currentStock: Number(e.target.value) || 0 })}
                  className="w-full rounded border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2.5 py-1.5"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">Reorder / Min Stock</label>
                <input
                  type="number"
                  value={editing.reorderLevel}
                  onChange={(e) =>
                    setEditing({ ...editing, reorderLevel: Number(e.target.value) || 0 })
                  }
                  className="w-full rounded border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2.5 py-1.5"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">Rack / Batch / Expiry</label>
                <div className="flex gap-1">
                  <input
                    placeholder="Rack"
                    value={editing.rackNumber}
                    onChange={(e) => setEditing({ ...editing, rackNumber: e.target.value })}
                    className="w-1/3 rounded border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-1.5 py-1.5"
                  />
                  <input
                    type="date"
                    value={editing.expiryDate}
                    onChange={(e) => setEditing({ ...editing, expiryDate: e.target.value })}
                    className="w-2/3 rounded border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-1.5 py-1.5"
                  />
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-lg bg-[#0F172A] dark:bg-amber-500 text-white dark:text-slate-950 text-xs font-bold"
              >
                Save Product
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Bulk CSV Import Modal */}
      {showBulkModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-lg rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 space-y-3">
            <h3 className="text-base font-bold">Bulk Product Import (CSV Lines)</h3>
            <p className="text-xs text-slate-500">
              Format: <code>nameHi, nameEn, category, unit, mrp, sellingPrice, purchaseRate, stock</code>
            </p>
            <textarea
              rows={5}
              value={bulkCsvText}
              onChange={(e) => setBulkCsvText(e.target.value)}
              placeholder="हल्दी पाउडर, Turmeric Powder, Staples & Grains, PACKET, 65, 58, 45, 30"
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-3 text-xs font-mono"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowBulkModal(false)}
                className="px-3 py-1.5 rounded-lg border text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleBulkImport}
                className="px-4 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-bold"
              >
                Import Products
              </button>
            </div>
          </div>
        </div>
      )}

      {barcodeProduct && (
        <BarcodeLabelModal
          product={barcodeProduct}
          storeName={storeSettings.nameHi}
          onClose={() => setBarcodeProduct(null)}
        />
      )}
    </div>
  );
};
