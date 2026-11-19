import React from 'react';
import { ShoppingBag } from 'lucide-react';
import { useMall } from '../../context/MallContext';
import { UI_LABELS } from '../../i18n/translations';

interface TopNavBarProps {
  cartCount: number;
  onOpenCart: () => void;
  onScrollSection: (id: string) => void;
}

export const TopNavBar: React.FC<TopNavBarProps> = ({
  cartCount,
  onOpenCart,
  onScrollSection,
}) => {
  const { language, appMode, setAppMode, storeSettings } = useMall();
  const t = UI_LABELS[language];

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-[#0F172A]/90 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-8">
        {/* Zone 1: Single-line Brand Wordmark */}
        <a
          href="#top"
          onClick={(e) => {
            e.preventDefault();
            setAppMode('storefront');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          className="text-base sm:text-lg font-extrabold tracking-tight text-[#0F172A] dark:text-white whitespace-nowrap shrink-0"
        >
          {language === 'hi' ? storeSettings.nameHi : storeSettings.nameEn}
        </a>

        {/* Zone 2: 4-5 concise single-line nav links */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600 dark:text-slate-300">
          <button
            type="button"
            onClick={() => {
              setAppMode('storefront');
              onScrollSection('catalog');
            }}
            className="hover:text-[#0F172A] dark:hover:text-white hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
          >
            {t.storefront}
          </button>
          <button
            type="button"
            onClick={() => {
              setAppMode('storefront');
              onScrollSection('ration-list');
            }}
            className="hover:text-[#0F172A] dark:hover:text-white hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
          >
            {t.quickRation}
          </button>
          <button
            type="button"
            onClick={() => {
              setAppMode('storefront');
              onScrollSection('track-order');
            }}
            className="hover:text-[#0F172A] dark:hover:text-white hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
          >
            {t.trackOrder}
          </button>
          <button
            type="button"
            onClick={() => setAppMode('erp')}
            className={`hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0 ${
              appMode === 'erp'
                ? 'text-amber-600 dark:text-amber-400 font-semibold'
                : 'hover:text-[#0F172A] dark:hover:text-white'
            }`}
          >
            {t.erpConsole}
          </button>
        </nav>

        {/* Zone 3: 1 Primary CTA */}
        <div className="flex items-center gap-3 shrink-0">
          {appMode === 'storefront' ? (
            <button
              type="button"
              onClick={onOpenCart}
              aria-label={`Open shopping cart with ${cartCount} items`}
              className="inline-flex items-center gap-2 rounded-lg bg-[#0F172A] dark:bg-amber-500 px-4 py-2 text-xs font-semibold text-white dark:text-slate-950 hover:bg-slate-800 dark:hover:bg-amber-400 transition-colors whitespace-nowrap shrink-0 tabular-nums"
            >
              <ShoppingBag className="w-4 h-4" />
              <span>
                {t.cart} ({cartCount})
              </span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setAppMode('storefront')}
              className="inline-flex items-center gap-2 rounded-lg bg-[#0F172A] dark:bg-amber-500 px-4 py-2 text-xs font-semibold text-white dark:text-slate-950 hover:bg-slate-800 dark:hover:bg-amber-400 transition-colors whitespace-nowrap shrink-0"
            >
              {t.storefront}
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
