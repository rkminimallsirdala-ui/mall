import React, { useState } from 'react';
import { Printer, QrCode, X } from 'lucide-react';
import { formatINR, getStoreContactLinks } from '../../config/businessConfig';
import { Sale, StoreSettings } from '../../types/erp';

interface InvoicePrintModalProps {
  sale: Sale;
  settings: StoreSettings;
  onClose: () => void;
}

export const InvoicePrintModal: React.FC<InvoicePrintModalProps> = ({
  sale,
  settings,
  onClose,
}) => {
  const [format, setFormat] = useState<'80mm' | '58mm' | 'a4'>('80mm');
  const [copyType, setCopyType] = useState<'Customer Copy' | 'Duplicate Invoice'>('Customer Copy');
  const links = getStoreContactLinks(settings);

  const widthClass =
    format === '58mm'
      ? 'max-w-[290px] text-[11px]'
      : format === '80mm'
        ? 'max-w-[380px] text-xs'
        : 'max-w-[780px] text-sm';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 overflow-y-auto">
      <div className="w-full max-w-4xl rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden">
        {/* Controls Toolbar */}
        <div className="no-print flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-slate-600 dark:text-slate-300 mr-1">
              Format:
            </span>
            {(['58mm', '80mm', 'a4'] as const).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFormat(f)}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                  format === f
                    ? 'bg-[#0F172A] text-white dark:bg-amber-500 dark:text-slate-950'
                    : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700'
                }`}
              >
                {f === 'a4' ? 'A4 Tax Invoice' : `${f} Thermal`}
              </button>
            ))}
            <select
              aria-label="Invoice Copy Type"
              value={copyType}
              onChange={(e) => setCopyType(e.target.value as 'Customer Copy' | 'Duplicate Invoice')}
              className="ml-2 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1.5 text-xs font-medium text-slate-800 dark:text-slate-100"
            >
              <option value="Customer Copy">Customer Copy</option>
              <option value="Duplicate Invoice">Duplicate Invoice</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 px-4 py-2 text-xs font-semibold text-white"
            >
              <Printer className="w-4 h-4" />
              Print Receipt
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close invoice preview"
              className="rounded-lg p-2 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-800"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Printable Invoice Body */}
        <div className="p-6 bg-slate-100 dark:bg-slate-950/60 flex justify-center overflow-x-auto">
          <div
            className={`${widthClass} w-full bg-white text-slate-900 p-5 rounded-lg border border-slate-200 shadow-sm font-sans`}
          >
            <div className="text-center border-b border-dashed border-slate-300 pb-3">
              <p className="text-[11px] font-semibold tracking-wide text-slate-500 uppercase">
                {copyType}
              </p>
              <h2 className="text-base font-extrabold text-[#0F172A] mt-0.5">
                {settings.nameHi}
              </h2>
              <p className="text-xs font-semibold text-slate-700">{settings.nameEn}</p>
              <p className="text-[11px] text-amber-700 font-medium">{settings.tagline}</p>
              {settings.address && (
                <p className="text-[11px] text-slate-600 mt-1">{settings.address}</p>
              )}
              <p className="text-[11px] font-semibold text-slate-800 mt-0.5 tabular-nums">
                Mob / WhatsApp: {links.phoneDisplay}
              </p>
              {settings.gstin && (
                <p className="text-[11px] font-mono text-slate-700">GSTIN: {settings.gstin}</p>
              )}
            </div>

            <div className="py-2.5 border-b border-dashed border-slate-300 grid grid-cols-2 gap-1 text-[11px]">
              <div>
                <span className="text-slate-500">Invoice:</span>{' '}
                <strong className="font-mono">{sale.invoiceNo}</strong>
              </div>
              <div className="text-right tabular-nums">
                <span className="text-slate-500">Date:</span>{' '}
                {new Date(sale.createdAt).toLocaleString('en-IN', {
                  dateStyle: 'short',
                  timeStyle: 'short',
                })}
              </div>
              <div>
                <span className="text-slate-500">Customer:</span> {sale.customerName}
              </div>
              <div className="text-right">
                <span className="text-slate-500">Cashier:</span> {sale.cashierName}
              </div>
            </div>

            <table className="w-full my-2.5 text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-300 text-[11px] text-slate-600">
                  <th className="py-1 font-semibold">Item</th>
                  <th className="py-1 text-right font-semibold">Qty</th>
                  <th className="py-1 text-right font-semibold">MRP</th>
                  <th className="py-1 text-right font-semibold">Rate</th>
                  <th className="py-1 text-right font-semibold">Amt</th>
                </tr>
              </thead>
              <tbody>
                {sale.items.map((item, idx) => (
                  <tr key={`${item.productId}_${idx}`} className="border-b border-slate-100">
                    <td className="py-1.5 pr-1">
                      <div className="font-medium leading-tight">{item.nameHi}</div>
                      <div className="text-[10px] text-slate-500">
                        {item.nameEn} · GST {item.gstRate}%
                      </div>
                    </td>
                    <td className="py-1.5 text-right tabular-nums whitespace-nowrap">
                      {item.qty} {item.unit}
                    </td>
                    <td className="py-1.5 text-right tabular-nums text-slate-500 line-through">
                      {item.mrp}
                    </td>
                    <td className="py-1.5 text-right tabular-nums">{item.sellingPrice}</td>
                    <td className="py-1.5 text-right font-semibold tabular-nums">
                      {item.lineTotal.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="border-t border-dashed border-slate-300 pt-2 space-y-1 tabular-nums">
              <div className="flex justify-between">
                <span className="text-slate-600">Item Total</span>
                <span>{formatINR(sale.itemTotal)}</span>
              </div>
              {sale.discountTotal > 0 && (
                <div className="flex justify-between text-emerald-700">
                  <span>Discount {sale.couponCode ? `(${sale.couponCode})` : ''}</span>
                  <span>-{formatINR(sale.discountTotal)}</span>
                </div>
              )}
              <div className="flex justify-between text-[11px] text-slate-500">
                <span>Taxable Value</span>
                <span>{formatINR(sale.taxableValue)}</span>
              </div>
              <div className="flex justify-between text-[11px] text-slate-500">
                <span>CGST + SGST / IGST</span>
                <span>
                  {formatINR(sale.cgstTotal)} + {formatINR(sale.sgstTotal)}
                  {sale.igstTotal > 0 ? ` / ${formatINR(sale.igstTotal)}` : ''}
                </span>
              </div>
              <div className="flex justify-between text-[11px] text-slate-500">
                <span>Round Off</span>
                <span>{sale.roundOff >= 0 ? `+${sale.roundOff}` : sale.roundOff}</span>
              </div>
              <div className="flex justify-between text-base font-extrabold border-t border-slate-300 pt-1.5 mt-1">
                <span>Grand Total</span>
                <span>{formatINR(sale.grandTotal)}</span>
              </div>
              {sale.customerSavings > 0 && (
                <div className="text-center bg-emerald-50 border border-emerald-200 rounded py-1 text-emerald-800 font-semibold">
                  आपकी कुल बचत (Total Savings): {formatINR(sale.customerSavings)}
                </div>
              )}
            </div>

            <div className="mt-3 pt-2 border-t border-dashed border-slate-300 text-[11px] space-y-1 tabular-nums">
              <div className="flex justify-between">
                <span>Payment Mode:</span>
                <strong className="uppercase">{sale.paymentMode.replace('_', ' ')}</strong>
              </div>
              <div className="flex justify-between">
                <span>Amount Paid:</span>
                <span>{formatINR(sale.amountPaid)}</span>
              </div>
              <div className="flex justify-between">
                <span>Balance Due:</span>
                <span className={sale.balanceDue > 0 ? 'text-red-600 font-bold' : ''}>
                  {formatINR(sale.balanceDue)}
                </span>
              </div>
            </div>

            {settings.upiId && (
              <div className="mt-3 p-2 rounded border border-slate-200 flex items-center gap-2 bg-slate-50">
                <QrCode className="w-8 h-8 text-slate-800 shrink-0" />
                <div className="text-[10px]">
                  <div className="font-semibold">UPI Pay: {settings.upiId}</div>
                  <div className="text-slate-500">Scan via PhonePe / GPay / Paytm</div>
                </div>
              </div>
            )}

            <div className="mt-4 text-center text-[11px] text-slate-600 border-t border-slate-200 pt-2">
              <p className="font-semibold text-slate-800">
                खरीदारी के लिए धन्यवाद! फिर पधारें — {settings.nameHi}
              </p>
              <p className="text-[10px] text-slate-500 mt-0.5">
                Customer Care & Home Delivery: {links.phoneDisplay}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
