import React, { useMemo, useState } from 'react';
import {
  BarChart3,
  Boxes,
  Calculator,
  LogIn,
  LogOut,
  MessageSquare,
  Moon,
  Package,
  Receipt,
  Settings,
  ShoppingBag,
  Sun,
  Tag,
  Truck,
  Users,
  UserCheck,
} from 'lucide-react';
import { useMall } from '../../context/MallContext';
import { UI_LABELS } from '../../i18n/translations';
import { StaffRole } from '../../types/erp';
import { AccountsExpensesReportsModule } from './AccountsExpensesReportsModule';
import { CustomersKhataModule } from './CustomersKhataModule';
import { OffersModule } from './OffersModule';
import { OrdersDeliveryModule } from './OrdersDeliveryModule';
import { OwnerDashboard } from './OwnerDashboard';
import { PosTerminal } from './PosTerminal';
import { ProductsInventoryModule } from './ProductsInventoryModule';
import { PurchasesSuppliersModule } from './PurchasesSuppliersModule';
import { SettingsSecurityModule } from './SettingsSecurityModule';
import { StaffAttendancePayrollModule } from './StaffAttendancePayrollModule';
import { WhatsAppAutomationModule } from './WhatsAppAutomationModule';
import { PWAInstallButton } from '../common/PWAInstallButton';

export type ErpTabId =
  | 'dashboard'
  | 'pos'
  | 'products'
  | 'inventory'
  | 'purchases'
  | 'customers'
  | 'offers'
  | 'orders'
  | 'whatsapp'
  | 'staff'
  | 'accounts'
  | 'settings';

const ROLE_LABELS: Record<Exclude<StaffRole, 'customer'>, string> = {
  owner: 'Owner',
  super_admin: 'Super Admin',
  manager: 'Store Manager',
  cashier: 'POS Cashier',
  inventory_manager: 'Inventory Mgr',
  accountant: 'Accountant',
  delivery_staff: 'Delivery Staff',
};

export const ErpShell: React.FC = () => {
  const {
    language,
    setLanguage,
    darkMode,
    toggleDarkMode,
    user,
    isCloudLive,
    actualRole,
    activeRoleView,
    setActiveRoleView,
    hasPermission,
    signInWithGoogle,
    signOut,
  } = useMall();

  const t = UI_LABELS[language];
  const [activeTab, setActiveTab] = useState<ErpTabId>('dashboard');

  const navItems = useMemo(() => {
    const items: Array<{ id: ErpTabId; label: string; icon: React.ReactNode; visible: boolean }> = [
      {
        id: 'dashboard',
        label: t.dashboard,
        icon: <BarChart3 className="w-4 h-4" />,
        visible: activeRoleView !== 'delivery_staff',
      },
      {
        id: 'pos',
        label: t.posBilling,
        icon: <Calculator className="w-4 h-4" />,
        visible: hasPermission('billing'),
      },
      {
        id: 'products',
        label: t.products,
        icon: <Package className="w-4 h-4" />,
        visible: hasPermission('products'),
      },
      {
        id: 'inventory',
        label: t.inventory,
        icon: <Boxes className="w-4 h-4" />,
        visible: hasPermission('products') || hasPermission('stock_adjustment'),
      },
      {
        id: 'purchases',
        label: t.purchases,
        icon: <Receipt className="w-4 h-4" />,
        visible: hasPermission('suppliers'),
      },
      {
        id: 'customers',
        label: t.customersKhata,
        icon: <Users className="w-4 h-4" />,
        visible: hasPermission('customers'),
      },
      {
        id: 'offers',
        label: t.offers,
        icon: <Tag className="w-4 h-4" />,
        visible: hasPermission('discounts') || activeRoleView === 'owner' || activeRoleView === 'manager',
      },
      {
        id: 'orders',
        label: t.ordersDelivery,
        icon: <Truck className="w-4 h-4" />,
        visible:
          activeRoleView === 'delivery_staff' ||
          hasPermission('billing') ||
          activeRoleView === 'owner' ||
          activeRoleView === 'manager',
      },
      {
        id: 'whatsapp',
        label: t.whatsappAutomation,
        icon: <MessageSquare className="w-4 h-4" />,
        visible: activeRoleView === 'owner' || activeRoleView === 'super_admin' || activeRoleView === 'manager',
      },
      {
        id: 'staff',
        label: t.staffPayroll,
        icon: <UserCheck className="w-4 h-4" />,
        visible:
          hasPermission('staff') ||
          hasPermission('accounting') ||
          activeRoleView === 'owner' ||
          activeRoleView === 'delivery_staff',
      },
      {
        id: 'accounts',
        label: t.accountsReports,
        icon: <ShoppingBag className="w-4 h-4" />,
        visible: hasPermission('accounting') || hasPermission('reports'),
      },
      {
        id: 'settings',
        label: t.settingsSecurity,
        icon: <Settings className="w-4 h-4" />,
        visible: hasPermission('settings'),
      },
    ];
    return items.filter((it) => it.visible);
  }, [t, activeRoleView, hasPermission]);

  const effectiveTab: ErpTabId = useMemo(() => {
    if (navItems.some((n) => n.id === activeTab)) return activeTab;
    return navItems[0]?.id || 'orders';
  }, [navItems, activeTab]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-5 space-y-5">
      {/* ERP Sub-Toolbar: Demo/Cloud Status + Role Switcher + HI/EN + Theme + Auth */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span
            className={`px-2.5 py-1 rounded-md font-bold ${
              isCloudLive
                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300'
                : 'bg-amber-100 text-amber-900 dark:bg-amber-950/50 dark:text-amber-300'
            }`}
          >
            {isCloudLive ? `Cloud Sync Active (${user?.email})` : t.demoBanner}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          {/* Role Experience Switcher */}
          <label className="flex items-center gap-1.5 font-semibold text-slate-600 dark:text-slate-300">
            <span>View Role:</span>
            <select
              aria-label="Switch ERP role experience"
              value={activeRoleView}
              onChange={(e) => {
                const nextRole = e.target.value as Exclude<StaffRole, 'customer'>;
                setActiveRoleView(nextRole);
                if (nextRole === 'delivery_staff') setActiveTab('orders');
                else if (nextRole === 'cashier') setActiveTab('pos');
                else if (nextRole === 'inventory_manager') setActiveTab('inventory');
                else if (nextRole === 'accountant') setActiveTab('accounts');
                else setActiveTab('dashboard');
              }}
              className="rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2.5 py-1.5 font-bold text-[#0F172A] dark:text-white"
            >
              {(Object.keys(ROLE_LABELS) as Array<Exclude<StaffRole, 'customer'>>).map((r) => (
                <option
                  key={r}
                  value={r}
                  disabled={isCloudLive && !['owner', 'super_admin'].includes(actualRole) && actualRole !== r}
                >
                  {ROLE_LABELS[r]}
                </option>
              ))}
            </select>
          </label>

          <button
            type="button"
            onClick={() => setLanguage(language === 'hi' ? 'en' : 'hi')}
            className="px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 font-bold"
          >
            {language === 'hi' ? 'EN' : 'हिन्दी'}
          </button>

          <button
            type="button"
            onClick={toggleDarkMode}
            aria-label="Toggle dark mode"
            className="p-1.5 rounded-lg border border-slate-300 dark:border-slate-700"
          >
            {darkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
          </button>

          <PWAInstallButton />

          {user ? (
            <button
              type="button"
              onClick={signOut}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 font-semibold"
            >
              <LogOut className="w-3.5 h-3.5" />
              {t.signOut}
            </button>
          ) : (
            <button
              type="button"
              onClick={signInWithGoogle}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0F172A] dark:bg-amber-500 text-white dark:text-slate-950 font-bold"
            >
              <LogIn className="w-3.5 h-3.5" />
              {t.signInGoogle}
            </button>
          )}
        </div>
      </div>

      {/* Role-Adaptive Navigation Sidebar + Active Module Canvas */}
      <div className="grid lg:grid-cols-12 gap-5 items-start">
        <aside className="lg:col-span-3 xl:col-span-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-2.5 flex lg:flex-col gap-1 overflow-x-auto">
          {navItems.map((item) => {
            const active = effectiveTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-xs font-bold shrink-0 lg:shrink whitespace-nowrap lg:whitespace-normal transition-colors text-left ${
                  active
                    ? 'bg-[#0F172A] text-white dark:bg-amber-500 dark:text-slate-950'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <span className="shrink-0">{item.icon}</span>
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </aside>

        <main className="lg:col-span-9 xl:col-span-10 min-w-0">
          {effectiveTab === 'dashboard' && (
            <OwnerDashboard onNavigateTab={(tab) => setActiveTab(tab as ErpTabId)} />
          )}
          {effectiveTab === 'pos' && <PosTerminal />}
          {effectiveTab === 'products' && <ProductsInventoryModule key="products" initialSubTab="products" />}
          {effectiveTab === 'inventory' && <ProductsInventoryModule key="inventory" initialSubTab="inventory" />}
          {effectiveTab === 'purchases' && <PurchasesSuppliersModule />}
          {effectiveTab === 'customers' && <CustomersKhataModule />}
          {effectiveTab === 'offers' && <OffersModule />}
          {effectiveTab === 'orders' && <OrdersDeliveryModule />}
          {effectiveTab === 'whatsapp' && <WhatsAppAutomationModule />}
          {effectiveTab === 'staff' && <StaffAttendancePayrollModule />}
          {effectiveTab === 'accounts' && <AccountsExpensesReportsModule />}
          {effectiveTab === 'settings' && <SettingsSecurityModule />}
        </main>
      </div>
    </div>
  );
};
