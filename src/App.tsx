import React, { useEffect, useState } from 'react';
import { OfflineIndicator } from './components/common/OfflineIndicator';
import { ErpShell } from './components/erp/ErpShell';
import { ErrorBoundary } from './components/layout/ErrorBoundary';
import { TopNavBar } from './components/layout/TopNavBar';
import { CustomerStorefront } from './components/storefront/CustomerStorefront';
import { MallProvider, useMall } from './context/MallContext';
import { UI_LABELS } from './i18n/translations';
import { Product } from './types/erp';

interface CartEntry {
  product: Product;
  qty: number;
}

const MallApplicationShell: React.FC = () => {
  const { language, appMode, setAppMode, isOffline, offlineQueue, toast } = useMall();
  const t = UI_LABELS[language];

  const [cart, setCart] = useState<CartEntry[]>([]);
  const [cartOpen, setCartOpen] = useState(false);

  // Allow deep-link URL parameter ?mode=erp&autostart=1 for automated testing or direct ERP launch
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('mode') === 'erp') {
      setAppMode('erp');
    }
  }, [setAppMode]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  }, [appMode]);

  const handleScrollSection = (sectionId: string) => {
    setTimeout(() => {
      const el = document.getElementById(sectionId);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 60);
  };

  const cartCount = cart.reduce((sum, item) => sum + item.qty, 0);

  return (
    <div id="top" className="min-h-screen bg-[#F8FAFC] dark:bg-[#0B1120] text-[#0F172A] dark:text-[#F8FAFC] transition-colors">
      <TopNavBar
        cartCount={cartCount}
        onOpenCart={() => setCartOpen(true)}
        onScrollSection={handleScrollSection}
      />

      {appMode === 'storefront' ? (
        <CustomerStorefront
          cart={cart}
          setCart={setCart}
          cartOpen={cartOpen}
          setCartOpen={setCartOpen}
        />
      ) : (
        <ErpShell />
      )}

      <OfflineIndicator
        offline={isOffline}
        pendingCount={offlineQueue.length}
        label={t.offlineBanner}
      />

      {toast && (
        <div
          role="status"
          aria-live="polite"
          className={`fixed bottom-4 right-4 z-50 max-w-sm rounded-xl px-4 py-3 text-xs font-bold shadow-xl border ${
            toast.type === 'error'
              ? 'bg-red-600 text-white border-red-700'
              : toast.type === 'success'
              ? 'bg-emerald-600 text-white border-emerald-700'
              : 'bg-[#0F172A] text-white border-slate-700 dark:bg-amber-500 dark:text-slate-950'
          }`}
        >
          {toast.message}
        </div>
      )}
    </div>
  );
};

export default function App() {
  return (
    <ErrorBoundary>
      <MallProvider>
        <MallApplicationShell />
      </MallProvider>
    </ErrorBoundary>
  );
}
