import { Language } from '../types/erp';

export const UI_LABELS: Record<
  Language,
  {
    storefront: string;
    erpConsole: string;
    shopNow: string;
    quickRation: string;
    cart: string;
    trackOrder: string;
    callStore: string;
    whatsappOrder: string;
    inStock: string;
    lowStock: string;
    outOfStock: string;
    addToCart: string;
    checkout: string;
    homeDelivery: string;
    storePickup: string;
    dashboard: string;
    posBilling: string;
    products: string;
    inventory: string;
    purchases: string;
    customersKhata: string;
    offers: string;
    ordersDelivery: string;
    whatsappAutomation: string;
    staffPayroll: string;
    accountsReports: string;
    settingsSecurity: string;
    signInGoogle: string;
    signOut: string;
    demoBanner: string;
    liveMode: string;
    demoMode: string;
    offlineBanner: string;
    todaySales: string;
    grossProfit: string;
    netProfit: string;
    customerDues: string;
    supplierDues: string;
    cashInHand: string;
    upiCollection: string;
    inventoryValue: string;
    pendingOrders: string;
    presentStaff: string;
    searchPlaceholder: string;
    save: string;
    cancel: string;
    printInvoice: string;
    completeBill: string;
  }
> = {
  hi: {
    storefront: 'ऑनलाइन स्टोर',
    erpConsole: 'मॉल ERP पैनल',
    shopNow: 'खरीदारी शुरू करें',
    quickRation: 'मासिक राशन सूची',
    cart: 'कार्ट',
    trackOrder: 'ऑर्डर ट्रैक करें',
    callStore: 'कॉल करें',
    whatsappOrder: 'व्हाट्सएप ऑर्डर',
    inStock: 'उपलब्ध',
    lowStock: 'कम स्टॉक',
    outOfStock: 'स्टॉक समाप्त',
    addToCart: 'कार्ट में जोड़ें',
    checkout: 'ऑर्डर पूरा करें',
    homeDelivery: 'होम डिलीवरी',
    storePickup: 'स्टोर से पिकअप',
    dashboard: 'मालिक डैशबोर्ड',
    posBilling: 'POS बिलिंग',
    products: 'उत्पाद मास्टर',
    inventory: 'इन्वेंटरी नियंत्रण',
    purchases: 'खरीद और सप्लायर',
    customersKhata: 'ग्राहक और उधार खाता',
    offers: 'ऑफ़र और कूपन',
    ordersDelivery: 'ऑनलाइन ऑर्डर व डिलीवरी',
    whatsappAutomation: 'व्हाट्सएप व मैसेज',
    staffPayroll: 'स्टाफ, हाज़िरी व वेतन',
    accountsReports: 'खाता, खर्च व रिपोर्ट्स',
    settingsSecurity: 'सेटिंग्स, ऑडिट व बैकअप',
    signInGoogle: 'Google से लॉगिन करें',
    signOut: 'लॉगआउट',
    demoBanner: 'डेमो सैंडबॉक्स प्रीव्यू — लाइव क्लाउड डेटा के लिए Google से लॉगिन करें',
    liveMode: 'लाइव रिकॉर्ड',
    demoMode: 'डेमो मोड',
    offlineBanner: 'ऑफ़लाइन मोड — POS बिल लोकल कतार में सुरक्षित हो रहे हैं',
    todaySales: 'आज की बिक्री',
    grossProfit: 'सकल लाभ',
    netProfit: 'अनुमानित शुद्ध लाभ',
    customerDues: 'ग्राहक बकाया (उधार)',
    supplierDues: 'सप्लायर बकाया',
    cashInHand: 'हाथ में नकद',
    upiCollection: 'UPI संग्रह',
    inventoryValue: 'स्टॉक मूल्य',
    pendingOrders: 'लंबित ऑनलाइन ऑर्डर',
    presentStaff: 'उपस्थित स्टाफ',
    searchPlaceholder: 'उत्पाद, ब्रांड या बारकोड खोजें...',
    save: 'सहेजें',
    cancel: 'रद्द करें',
    printInvoice: 'बिल प्रिंट करें',
    completeBill: 'बिल बनाएं',
  },
  en: {
    storefront: 'Online Store',
    erpConsole: 'Mall ERP Console',
    shopNow: 'Shop Groceries',
    quickRation: 'Quick Ration List',
    cart: 'Cart',
    trackOrder: 'Track Order',
    callStore: 'Call Store',
    whatsappOrder: 'WhatsApp Order',
    inStock: 'In Stock',
    lowStock: 'Low Stock',
    outOfStock: 'Out of Stock',
    addToCart: 'Add to Cart',
    checkout: 'Place Order',
    homeDelivery: 'Home Delivery',
    storePickup: 'Store Pickup',
    dashboard: 'Owner Dashboard',
    posBilling: 'POS Billing',
    products: 'Product Master',
    inventory: 'Inventory Control',
    purchases: 'Purchases & Suppliers',
    customersKhata: 'Customers & Khata',
    offers: 'Offers & Coupons',
    ordersDelivery: 'Orders & Delivery',
    whatsappAutomation: 'WhatsApp & Alerts',
    staffPayroll: 'Staff & Payroll',
    accountsReports: 'Accounts & Reports',
    settingsSecurity: 'Settings & Audit',
    signInGoogle: 'Sign in with Google',
    signOut: 'Sign Out',
    demoBanner: 'Demo Sandbox Preview — Sign in with Google for Live Cloud Sync',
    liveMode: 'Live Records',
    demoMode: 'Demo Mode',
    offlineBanner: 'Offline Mode — POS bills queued locally for sync',
    todaySales: "Today's Sales",
    grossProfit: 'Gross Profit',
    netProfit: 'Estimated Net Profit',
    customerDues: 'Customer Outstanding',
    supplierDues: 'Supplier Outstanding',
    cashInHand: 'Cash in Hand',
    upiCollection: 'UPI Collection',
    inventoryValue: 'Inventory Value',
    pendingOrders: 'Pending Orders',
    presentStaff: 'Present Staff',
    searchPlaceholder: 'Search products, brands, or barcode...',
    save: 'Save',
    cancel: 'Cancel',
    printInvoice: 'Print Invoice',
    completeBill: 'Complete Bill',
  },
};
