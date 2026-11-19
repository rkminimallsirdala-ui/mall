import React from 'react';
import { Printer, X } from 'lucide-react';
import { formatINR } from '../../config/businessConfig';
import { Product } from '../../types/erp';

interface BarcodeLabelModalProps {
  product: Product;
  storeName: string;
  onClose: () => void;
}

export const BarcodeLabelModal: React.FC<BarcodeLabelModalProps> = ({
  product,
  storeName,
  onClose,
}) => {
  const code = product.barcode || product.sku;
  const bars = code.split('').flatMap((ch, idx) => {
    const val = ch.charCodeAt(0) + idx * 7;
    return [
      { w: (val % 3) + 1, dark: true },
      { w: ((val >> 2) % 2) + 1, dark: false },
      { w: ((val >> 3) % 3) + 1, dark: true },
      { w: 1, dark: false },
    ];
  });

  let xPos = 8;
  const barElements = bars.map((b, i) => {
    const el = b.dark ? (
      <rect key={i} x={xPos} y={4} width={b.w * 2} height={42} fill="#0F172A" />
    ) : null;
    xPos += b.w * 2;
    return el;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden">
        <div className="no-print flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-800">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
            Barcode & Price Sticker Preview
          </h3>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#0F172A] dark:bg-amber-500 px-3 py-1.5 text-xs font-semibold text-white dark:text-slate-950"
            >
              <Printer className="w-3.5 h-3.5" />
              Print Label
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close barcode preview"
              className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
        <div className="p-6 flex justify-center bg-slate-50 dark:bg-slate-950">
          <div className="w-[260px] rounded-lg border border-dashed border-slate-400 bg-white text-slate-900 p-3 text-center">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-600 truncate">
              {storeName}
            </p>
            <p className="text-xs font-bold mt-0.5 truncate">{product.nameHi}</p>
            <p className="text-[11px] text-slate-600 truncate">{product.nameEn} · {product.packSize}</p>
            <div className="flex justify-center my-2">
              <svg viewBox={`0 0 ${Math.max(160, xPos + 8)} 52`} className="w-48 h-12">
                {barElements}
              </svg>
            </div>
            <p className="text-[11px] font-mono tracking-widest">{code}</p>
            <div className="mt-1.5 flex items-center justify-center gap-2 text-xs tabular-nums">
              <span className="text-slate-500 line-through">MRP {formatINR(product.mrp)}</span>
              <span className="font-extrabold text-slate-950">
                Price {formatINR(product.sellingPrice)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
