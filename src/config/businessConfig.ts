import { RolePermissionMatrix, StoreSettings } from '../types/erp';

export const BOOTSTRAP_OWNER_EMAIL = 'rkminimall.sirdala@gmail.com';

export const DEFAULT_PERMISSION_MATRIX: RolePermissionMatrix = {
  owner: {
    products: true,
    billing: true,
    discounts: true,
    stock_adjustment: true,
    refund_approval: true,
    customers: true,
    suppliers: true,
    accounting: true,
    reports: true,
    staff: true,
    settings: true,
  },
  super_admin: {
    products: true,
    billing: true,
    discounts: true,
    stock_adjustment: true,
    refund_approval: true,
    customers: true,
    suppliers: true,
    accounting: true,
    reports: true,
    staff: true,
    settings: true,
  },
  manager: {
    products: true,
    billing: true,
    discounts: true,
    stock_adjustment: true,
    refund_approval: true,
    customers: true,
    suppliers: true,
    accounting: false,
    reports: true,
    staff: true,
    settings: false,
  },
  cashier: {
    products: false,
    billing: true,
    discounts: false,
    stock_adjustment: false,
    refund_approval: false,
    customers: true,
    suppliers: false,
    accounting: false,
    reports: false,
    staff: false,
    settings: false,
  },
  inventory_manager: {
    products: true,
    billing: false,
    discounts: false,
    stock_adjustment: true,
    refund_approval: false,
    customers: false,
    suppliers: true,
    accounting: false,
    reports: true,
    staff: false,
    settings: false,
  },
  accountant: {
    products: false,
    billing: false,
    discounts: false,
    stock_adjustment: false,
    refund_approval: true,
    customers: true,
    suppliers: true,
    accounting: true,
    reports: true,
    staff: false,
    settings: false,
  },
  delivery_staff: {
    products: false,
    billing: false,
    discounts: false,
    stock_adjustment: false,
    refund_approval: false,
    customers: false,
    suppliers: false,
    accounting: false,
    reports: false,
    staff: false,
    settings: false,
  },
};

export const DEFAULT_STORE_SETTINGS: StoreSettings = {
  id: 'main',
  nameHi: 'भुवनेश्वर प्रसाद RK मिनी मॉल',
  nameEn: 'Bhuvaneshwar Prasad RK Mini Mall',
  tagline: 'Shop Smart... Live Better...',
  phone: '+91 9771946560',
  whatsappPhone: '+91 9771946560',
  address: '',
  gstin: '',
  state: 'Bihar',
  email: 'rkminimall.sirdala@gmail.com',
  openingHours: '08:00 AM - 09:30 PM',
  isOpen: true,
  upiId: '',
  deliveryCharge: 30,
  freeDeliveryAbove: 499,
  minOrderAmount: 199,
  invoicePrefix: 'RKMM',
  invoiceSequence: 1001,
  gstInclusive: true,
  loyaltyPointsPer100: 2,
  loyaltyPointValue: 1,
  reserveOnlineStock: true,
  demoModeActive: true,
  permissionMatrix: DEFAULT_PERMISSION_MATRIX,
};

export function getStoreContactLinks(settings: StoreSettings) {
  const digits = (settings.whatsappPhone || settings.phone).replace(/[^\d]/g, '');
  const telDigits = settings.phone.replace(/[^\d+]/g, '');
  return {
    phoneDisplay: settings.phone,
    whatsappDisplay: settings.whatsappPhone,
    whatsappUrl: `https://wa.me/${digits}`,
    telUrl: `tel:${telDigits}`,
  };
}

export function formatINR(amount: number): string {
  const safe = Number.isFinite(amount) ? amount : 0;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(safe);
}

export const GENERATED_MEDIA = {
  heroStorefront: '/src/assets/images/mall_hero_storefront_1795078162099.jpg',
  staplesGrains: '/src/assets/images/cat_staples_grains_1795078162442.jpg',
  snacksBeverages: '/src/assets/images/cat_snacks_beverages_1795078162576.jpg',
  personalHomeCare: '/src/assets/images/cat_personal_home_care_1795078163117.jpg',
  dairyFresh: '/src/assets/images/cat_dairy_fresh_1795078162167.jpg',
};
