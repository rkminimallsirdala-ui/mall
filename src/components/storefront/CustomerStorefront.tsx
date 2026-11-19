import React, { useMemo, useState } from 'react';
import {
  CheckCircle2,
  ClipboardList,
  MapPin,
  MessageCircle,
  Moon,
  Minus,
  Package,
  Phone,
  Plus,
  Search,
  ShoppingCart,
  Store,
  Sun,
  Tag,
  Truck,
  X,
} from 'lucide-react';
import { GENERATED_MEDIA, formatINR, getStoreContactLinks } from '../../config/businessConfig';
import { useMall } from '../../context/MallContext';
import { UI_LABELS } from '../../i18n/translations';
import { OnlineOrder, Product } from '../../types/erp';
import { calculateLineItemGst, validateAndApplyOffer } from '../../utils/erpLogic';
import { PWAInstallButton } from '../common/PWAInstallButton';

interface CartEntry {
  product: Product;
  qty: number;
}

interface CustomerStorefrontProps {
  cart: CartEntry[];
  setCart: React.Dispatch<React.SetStateAction<CartEntry[]>>;
  cartOpen: boolean;
  setCartOpen: (open: boolean) => void;
}

const CATEGORY_CARDS = [
  {
    key: 'Staples & Grains',
    labelHi: 'आटा, चावल, दाल व तेल',
    labelEn: 'Staples & Grains',
    image: GENERATED_MEDIA.staplesGrains,
  },
  {
    key: 'Snacks & Beverages',
    labelHi: 'चाय, बिस्कुट व पेय',
    labelEn: 'Snacks & Beverages',
    image: GENERATED_MEDIA.snacksBeverages,
  },
  {
    key: 'Home & Personal Care',
    labelHi: 'घरेलू व पर्सनल केयर',
    labelEn: 'Home & Personal Care',
    image: GENERATED_MEDIA.personalHomeCare,
  },
  {
    key: 'Dairy & Fresh',
    labelHi: 'डेयरी व ताज़ा उत्पाद',
    labelEn: 'Dairy & Fresh',
    image: GENERATED_MEDIA.dairyFresh,
  },
];

export const CustomerStorefront: React.FC<CustomerStorefrontProps> = ({
  cart,
  setCart,
  cartOpen,
  setCartOpen,
}) => {
  const {
    language,
    setLanguage,
    darkMode,
    toggleDarkMode,
    storeSettings,
    products,
    offers,
    onlineOrders,
    user,
    signInWithGoogle,
    setAppMode,
    createOnlineOrder,
    showToast,
  } = useMall();

  const t = UI_LABELS[language];
  const links = getStoreContactLinks(storeSettings);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [couponInput, setCouponInput] = useState('');
  const [appliedCouponCode, setAppliedCouponCode] = useState('');
  const [couponError, setCouponError] = useState('');
  const [fulfillmentType, setFulfillmentType] = useState<'delivery' | 'pickup'>('delivery');
  const [customerName, setCustomerName] = useState('');
  const [customerMobile, setCustomerMobile] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [scheduleSlot, setScheduleSlot] = useState('Same Day (4 PM - 7 PM)');
  const [paymentMethod, setPaymentMethod] = useState<'cod' | 'upi_on_delivery' | 'store_pickup_pay'>('cod');
  const [confirmedOrder, setConfirmedOrder] = useState<OnlineOrder | null>(null);
  const [placingOrder, setPlacingOrder] = useState(false);

  const [rationText, setRationText] = useState('Aashirvaad Atta\nFortune Mustard Oil\nTata Salt\nToor Dal');
  const [trackQuery, setTrackQuery] = useState('');

  const activeProducts = useMemo(() => products.filter((p) => p.active), [products]);
  const activeOffers = useMemo(() => offers.filter((o) => o.active), [offers]);

  const filteredProducts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return activeProducts.filter((p) => {
      const catMatch = selectedCategory === 'ALL' || p.category === selectedCategory;
      const textMatch =
        !q ||
        p.nameEn.toLowerCase().includes(q) ||
        p.nameHi.toLowerCase().includes(q) ||
        p.brand.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        p.barcode.includes(q);
      return catMatch && textMatch;
    });
  }, [activeProducts, selectedCategory, searchQuery]);

  const addToCart = (product: Product, qtyDelta = 1) => {
    const available = Math.max(0, product.currentStock - (product.reservedStock || 0));
    if (available <= 0) {
      showToast(`${product.nameEn} is currently out of stock.`, 'error');
      return;
    }
    setCart((prev) => {
      const existing = prev.find((c) => c.product.id === product.id);
      if (existing) {
        const nextQty = Math.min(available, existing.qty + qtyDelta);
        if (nextQty <= 0) return prev.filter((c) => c.product.id !== product.id);
        return prev.map((c) => (c.product.id === product.id ? { ...c, qty: nextQty } : c));
      }
      return [...prev, { product, qty: Math.min(available, qtyDelta) }];
    });
  };

  const cartSubtotal = useMemo(
    () => cart.reduce((sum, item) => sum + item.product.sellingPrice * item.qty, 0),
    [cart]
  );

  const couponResult = useMemo(() => {
    if (!appliedCouponCode) return { valid: false, discountAmount: 0 };
    const found = activeOffers.find(
      (o) => o.couponCode.toLowerCase() === appliedCouponCode.toLowerCase()
    );
    return validateAndApplyOffer(found, cart, cartSubtotal);
  }, [appliedCouponCode, activeOffers, cart, cartSubtotal]);

  const deliveryFee =
    fulfillmentType === 'pickup' || cartSubtotal === 0 || cartSubtotal >= storeSettings.freeDeliveryAbove
      ? 0
      : storeSettings.deliveryCharge;
  const grandTotal = Math.max(0, cartSubtotal - couponResult.discountAmount + deliveryFee);

  const handleApplyCoupon = () => {
    const code = couponInput.trim().toUpperCase();
    if (!code) return;
    const found = activeOffers.find((o) => o.couponCode.toUpperCase() === code);
    const res = validateAndApplyOffer(found, cart, cartSubtotal);
    if (!res.valid) {
      setCouponError(res.reason || 'Invalid coupon.');
      setAppliedCouponCode('');
    } else {
      setCouponError('');
      setAppliedCouponCode(code);
      showToast(`Coupon ${code} applied! Saved ${formatINR(res.discountAmount)}`, 'success');
    }
  };

  const handleQuickRationAdd = () => {
    const lines = rationText
      .split('\n')
      .map((l) => l.trim().toLowerCase())
      .filter(Boolean);
    let added = 0;
    for (const line of lines) {
      const match = activeProducts.find(
        (p) =>
          (p.nameEn.toLowerCase().includes(line) || p.nameHi.toLowerCase().includes(line)) &&
          p.currentStock - (p.reservedStock || 0) > 0
      );
      if (match) {
        addToCart(match, 1);
        added += 1;
      }
    }
    if (added > 0) {
      setCartOpen(true);
      showToast(`Added ${added} item(s) from your ration list to cart.`, 'success');
    } else {
      showToast('No matching in-stock items found for your list.', 'info');
    }
  };

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cart.length === 0) return;
    if (!customerName.trim() || !customerMobile.trim()) {
      showToast('Please enter your name and mobile number.', 'error');
      return;
    }
    if (fulfillmentType === 'delivery' && !deliveryAddress.trim()) {
      showToast('Please enter delivery address.', 'error');
      return;
    }
    setPlacingOrder(true);
    try {
      const saleItems = cart.map((c) =>
        calculateLineItemGst({
          product: c.product,
          qty: c.qty,
          gstInclusive: storeSettings.gstInclusive,
        })
      );
      const order = await createOnlineOrder({
        customerName: customerName.trim(),
        customerMobile: customerMobile.trim(),
        deliveryAddress: fulfillmentType === 'pickup' ? 'Store Pickup Counter' : deliveryAddress.trim(),
        fulfillmentType,
        scheduleSlot,
        items: saleItems,
        subtotal: cartSubtotal,
        discountTotal: couponResult.discountAmount,
        deliveryCharge: deliveryFee,
        grandTotal,
        couponCode: appliedCouponCode || undefined,
        paymentMethod: fulfillmentType === 'pickup' ? 'store_pickup_pay' : paymentMethod,
      });
      setConfirmedOrder(order);
      setCart([]);
      setAppliedCouponCode('');
      setCouponInput('');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Order failed', 'error');
    } finally {
      setPlacingOrder(false);
    }
  };

  const trackedOrder = useMemo(() => {
    const q = trackQuery.trim().toLowerCase();
    if (!q) return null;
    return onlineOrders.find(
      (o) =>
        o.orderNo.toLowerCase() === q ||
        o.customerMobile.replace(/[^\d]/g, '').endsWith(q.replace(/[^\d]/g, ''))
    );
  }, [trackQuery, onlineOrders]);

  return (
    <div id="top" className="min-h-screen bg-[#F8FAFC] dark:bg-[#0B1120] text-[#0F172A] dark:text-slate-100">
      {/* Utility Bar below Header (Language, Theme, PWA Install, Official Phone, ERP Entry) */}
      <div className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/70">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-slate-600 dark:text-slate-300">
            <span className="font-semibold text-[#0F172A] dark:text-amber-400">
              {storeSettings.tagline}
            </span>
            <span aria-hidden="true" className="hidden sm:inline">·</span>
            <a
              href={links.telUrl}
              className="inline-flex items-center gap-1 font-semibold hover:text-emerald-600 tabular-nums"
            >
              <Phone className="w-3.5 h-3.5" />
              {links.phoneDisplay}
            </a>
            <span aria-hidden="true" className="hidden sm:inline">·</span>
            <span>{storeSettings.openingHours}</span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-0.5">
              <button
                type="button"
                onClick={() => setLanguage('hi')}
                className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors ${
                  language === 'hi'
                    ? 'bg-[#0F172A] text-white dark:bg-amber-500 dark:text-slate-950'
                    : 'text-slate-600 dark:text-slate-300'
                }`}
              >
                हिंदी
              </button>
              <button
                type="button"
                onClick={() => setLanguage('en')}
                className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors ${
                  language === 'en'
                    ? 'bg-[#0F172A] text-white dark:bg-amber-500 dark:text-slate-950'
                    : 'text-slate-600 dark:text-slate-300'
                }`}
              >
                EN
              </button>
            </div>
            <button
              type="button"
              onClick={toggleDarkMode}
              aria-label="Toggle dark mode"
              className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-1.5 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700"
            >
              {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
            <PWAInstallButton />
            {user ? (
              <button
                type="button"
                onClick={() => setAppMode('erp')}
                className="rounded-lg bg-amber-500 hover:bg-amber-400 px-3 py-1.5 text-xs font-bold text-slate-950 whitespace-nowrap"
              >
                {t.erpConsole}
              </button>
            ) : (
              <button
                type="button"
                onClick={signInWithGoogle}
                className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-700 whitespace-nowrap"
              >
                {t.signInGoogle}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Section 1: Storefront Hero */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 pt-8 pb-10">
        <div className="grid lg:grid-cols-12 gap-8 items-stretch">
          <div className="lg:col-span-6 flex flex-col justify-center space-y-5">
            <p className="text-xs font-semibold tracking-wide text-amber-600 dark:text-amber-400 uppercase">
              {storeSettings.nameEn} · {storeSettings.tagline}
            </p>
            <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight leading-tight text-balance">
              {language === 'hi'
                ? 'आपके घर की हर ज़रूरत, ताज़ा किराना और बचत — एक ही छत के नीचे'
                : 'Daily Groceries, Staples & Family Essentials Under One Roof'}
            </h1>
            <p className="text-base text-slate-600 dark:text-slate-300 max-w-xl leading-relaxed">
              {language === 'hi'
                ? 'भुवनेश्वर प्रसाद RK मिनी मॉल से सीधे ऑनलाइन ऑर्डर करें — तेज़ होम डिलीवरी, स्टोर पिकअप, और वास्तविक MRP से सीधी बचत।'
                : 'Order directly from Bhuvaneshwar Prasad RK Mini Mall with verified stock, same-day local delivery or quick counter pickup.'}
            </p>
            <div className="flex flex-wrap items-center gap-3 pt-1">
              <a
                href="#catalog"
                className="inline-flex items-center gap-2 rounded-lg bg-[#0F172A] dark:bg-amber-500 px-5 py-3 text-sm font-semibold text-white dark:text-slate-950 hover:bg-slate-800 dark:hover:bg-amber-400 transition-colors"
              >
                <ShoppingCart className="w-4 h-4" />
                {t.shopNow}
              </a>
              <a
                href={links.whatsappUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-lg border border-emerald-600/30 bg-emerald-50 dark:bg-emerald-950/50 px-5 py-3 text-sm font-semibold text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 transition-colors"
              >
                <MessageCircle className="w-4 h-4" />
                {t.whatsappOrder}
              </a>
              <button
                type="button"
                onClick={() => setAppMode('erp')}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-5 py-3 text-sm font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <Store className="w-4 h-4" />
                {t.erpConsole}
              </button>
            </div>
          </div>

          <div className="lg:col-span-6">
            <div className="relative h-72 sm:h-96 lg:h-full min-h-[300px] rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-200 dark:bg-slate-800">
              <img
                src={GENERATED_MEDIA.heroStorefront}
                alt="भुवनेश्वर प्रसाद RK मिनी मॉल Storefront"
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent flex items-end p-6">
                <div className="text-white space-y-1">
                  <p className="text-xs font-semibold text-amber-300">
                    Free Home Delivery above {formatINR(storeSettings.freeDeliveryAbove)}
                  </p>
                  <p className="text-lg font-bold">{storeSettings.nameHi}</p>
                  <p className="text-xs text-slate-200 tabular-nums">
                    Helpline & WhatsApp: {links.phoneDisplay}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 4-Column Category Strip */}
        <div className="mt-8 grid grid-cols-2 lg:grid-cols-4 gap-4">
          {CATEGORY_CARDS.map((cat) => (
            <button
              key={cat.key}
              type="button"
              onClick={() => {
                setSelectedCategory(cat.key);
                document.getElementById('catalog')?.scrollIntoView({ behavior: 'smooth' });
              }}
              className={`group text-left rounded-xl overflow-hidden border transition-all bg-white dark:bg-slate-900 ${
                selectedCategory === cat.key
                  ? 'border-amber-500 ring-2 ring-amber-500/20'
                  : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
              }`}
            >
              <div className="aspect-[4/3] w-full overflow-hidden bg-slate-100 dark:bg-slate-800">
                <img
                  src={cat.image}
                  alt={cat.labelEn}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
              </div>
              <div className="p-3.5">
                <p className="text-sm font-bold text-[#0F172A] dark:text-white truncate">
                  {language === 'hi' ? cat.labelHi : cat.labelEn}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 tabular-nums">
                  {(() => {
                    const cnt = activeProducts.filter((p) => p.category === cat.key).length;
                    return `${cnt} ${cnt === 1 ? 'item' : 'items'}`;
                  })()}
                </p>
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* Active Offers Strip */}
      {activeOffers.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 pb-8">
          <div className="rounded-xl border border-amber-200 dark:border-amber-900/60 bg-amber-50/70 dark:bg-amber-950/20 p-4 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <Tag className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" />
              <span className="text-sm font-bold">
                {language === 'hi' ? 'आज के मॉल ऑफ़र और कूपन कोड:' : 'Active Store Offers & Coupons:'}
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {activeOffers.map((off) => (
                <button
                  key={off.id}
                  type="button"
                  onClick={() => {
                    setCouponInput(off.couponCode);
                    setCartOpen(true);
                  }}
                  className="rounded-lg border border-amber-300 dark:border-amber-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs font-semibold text-amber-800 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/40"
                >
                  <span className="font-mono font-bold">{off.couponCode}</span> — {off.name}
                </button>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Section 2: Product Catalogue */}
      <section id="catalog" className="max-w-7xl mx-auto px-4 sm:px-6 py-8 border-t border-slate-200 dark:border-slate-800">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <h2 className="text-2xl font-extrabold tracking-tight">
              {language === 'hi' ? 'सुपरमार्केट कैटलॉग' : 'Supermarket Product Catalogue'}
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              {filteredProducts.length} products · Live POS-synchronized stock & prices
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 sm:w-72">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t.searchPlaceholder}
                aria-label="Search store products"
                className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>
            <button
              type="button"
              onClick={() => setSelectedCategory('ALL')}
              className={`px-3 py-2 rounded-lg text-xs font-semibold border transition-colors ${
                selectedCategory === 'ALL'
                  ? 'bg-[#0F172A] text-white border-[#0F172A] dark:bg-amber-500 dark:text-slate-950 dark:border-amber-500'
                  : 'bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200'
              }`}
            >
              All Categories
            </button>
          </div>
        </div>

        {filteredProducts.length === 0 ? (
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-10 text-center">
            <Package className="w-10 h-10 mx-auto text-slate-400 mb-2" />
            <p className="text-sm font-semibold">No matching products found.</p>
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setSelectedCategory('ALL');
              }}
              className="mt-3 px-4 py-2 rounded-lg bg-[#0F172A] dark:bg-amber-500 text-white dark:text-slate-950 text-xs font-semibold hover:bg-slate-800 dark:hover:bg-amber-400"
            >
              Reset Filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {filteredProducts.map((product) => {
              const available = Math.max(0, product.currentStock - (product.reservedStock || 0));
              const inCart = cart.find((c) => c.product.id === product.id);
              const saveAmt = Math.max(0, product.mrp - product.sellingPrice);
              return (
                <div
                  key={product.id}
                  className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden flex flex-col hover:-translate-y-0.5 hover:shadow-md transition-all"
                >
                  <button
                    type="button"
                    onClick={() => setSelectedProduct(product)}
                    className="aspect-[4/3] w-full bg-slate-100 dark:bg-slate-800 overflow-hidden text-left"
                  >
                    {product.imageUrl ? (
                      <img
                        src={product.imageUrl}
                        alt={product.nameEn}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-900 p-4">
                        <Package className="w-8 h-8 text-slate-400 mb-1" />
                        <span className="text-xs font-semibold text-slate-500">{product.brand}</span>
                      </div>
                    )}
                  </button>

                  <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                    <div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center justify-between gap-2">
                        <span className="truncate">{product.brand} · {product.packSize}</span>
                        <span
                          className={`font-semibold shrink-0 ${
                            available <= 0
                              ? 'text-red-600 dark:text-red-400'
                              : available <= product.reorderLevel
                                ? 'text-amber-600 dark:text-amber-400'
                                : 'text-emerald-600 dark:text-emerald-400'
                          }`}
                        >
                          {available <= 0 ? t.outOfStock : available <= product.reorderLevel ? t.lowStock : t.inStock}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSelectedProduct(product)}
                        className="mt-1 text-left block w-full"
                      >
                        <h3 className="text-base font-bold text-[#0F172A] dark:text-white leading-snug">
                          {product.nameHi}
                        </h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400">{product.nameEn}</p>
                      </button>
                    </div>

                    <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                      <div className="tabular-nums">
                        <div className="text-base font-extrabold text-[#0F172A] dark:text-white">
                          {formatINR(product.sellingPrice)}
                        </div>
                        <div className="text-xs text-slate-400 flex items-center gap-1.5">
                          <span className="line-through">{formatINR(product.mrp)}</span>
                          {saveAmt > 0 && (
                            <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                              Save {formatINR(saveAmt)}
                            </span>
                          )}
                        </div>
                      </div>

                      {inCart ? (
                        <div className="flex items-center gap-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-1">
                          <button
                            type="button"
                            onClick={() => addToCart(product, -1)}
                            aria-label={`Decrease ${product.nameEn} quantity`}
                            className="p-1.5 rounded hover:bg-slate-200 dark:hover:bg-slate-700"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <span className="px-2 text-xs font-bold tabular-nums">{inCart.qty}</span>
                          <button
                            type="button"
                            onClick={() => addToCart(product, 1)}
                            aria-label={`Increase ${product.nameEn} quantity`}
                            className="p-1.5 rounded hover:bg-slate-200 dark:hover:bg-slate-700"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          disabled={available <= 0}
                          onClick={() => addToCart(product, 1)}
                          aria-label={`Add ${product.nameEn} to cart`}
                          className="px-3.5 py-2 rounded-lg bg-[#0F172A] dark:bg-amber-500 text-white dark:text-slate-950 text-xs font-semibold hover:bg-slate-800 dark:hover:bg-amber-400 disabled:opacity-40 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
                        >
                          {t.addToCart}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Section 3: Quick Ration List + Order Tracking */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-10 border-t border-slate-200 dark:border-slate-800 grid lg:grid-cols-2 gap-8">
        <div
          id="ration-list"
          className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-4"
        >
          <div className="flex items-center gap-2.5">
            <ClipboardList className="w-5 h-5 text-amber-600" />
            <h2 className="text-lg font-bold">
              {language === 'hi' ? 'क्विक राशन लिस्ट (एक क्लिक में कार्ट भरें)' : 'Quick Monthly Ration List'}
            </h2>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Enter one item per line (Hindi or English) and add all matching items directly to your cart.
          </p>
          <textarea
            rows={4}
            value={rationText}
            onChange={(e) => setRationText(e.target.value)}
            aria-label="Quick ration list items"
            className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
          <button
            type="button"
            onClick={handleQuickRationAdd}
            className="px-4 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold"
          >
            Add Matching Items to Cart
          </button>
        </div>

        <div
          id="track-order"
          className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-4"
        >
          <div className="flex items-center gap-2.5">
            <Truck className="w-5 h-5 text-emerald-600" />
            <h2 className="text-lg font-bold">
              {language === 'hi' ? 'अपना ऑर्डर ट्रैक करें' : 'Track Your Store Order'}
            </h2>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Enter your Order Number (e.g. ORD-2026-801) or mobile number to check live packing & delivery status.
          </p>
          <div className="flex gap-2">
            <input
              type="text"
              value={trackQuery}
              onChange={(e) => setTrackQuery(e.target.value)}
              placeholder="ORD-2026-801 or 9835778899"
              aria-label="Order tracking search"
              className="flex-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-sm"
            />
          </div>
          {trackedOrder ? (
            <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-4 text-xs space-y-1.5">
              <div className="flex justify-between font-bold text-sm">
                <span>{trackedOrder.orderNo}</span>
                <span className="uppercase text-emerald-600 dark:text-emerald-400">
                  {trackedOrder.status.replace(/_/g, ' ')}
                </span>
              </div>
              <p>
                Customer: {trackedOrder.customerName} · Total: {formatINR(trackedOrder.grandTotal)}
              </p>
              <p className="text-slate-500">
                Fulfillment: {trackedOrder.fulfillmentType === 'delivery' ? 'Home Delivery' : 'Store Pickup'}
                {trackedOrder.assignedDeliveryStaffName
                  ? ` · Rider: ${trackedOrder.assignedDeliveryStaffName}`
                  : ''}
              </p>
            </div>
          ) : trackQuery.trim() ? (
            <p className="text-xs text-slate-500">No order found matching &ldquo;{trackQuery}&rdquo;.</p>
          ) : null}
        </div>
      </section>

      {/* Contact & Footer */}
      <footer className="border-t border-slate-200 dark:border-slate-800 bg-[#0F172A] text-slate-200 mt-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10 grid sm:grid-cols-3 gap-8 text-sm">
          <div className="space-y-2">
            <h3 className="text-lg font-extrabold text-white">{storeSettings.nameHi}</h3>
            <p className="text-xs text-amber-400 font-semibold">{storeSettings.nameEn}</p>
            <p className="text-xs text-slate-400">{storeSettings.tagline}</p>
            {storeSettings.address && (
              <p className="text-xs text-slate-300 flex items-start gap-1.5 pt-1">
                <MapPin className="w-4 h-4 shrink-0 text-amber-400" />
                <span>{storeSettings.address}</span>
              </p>
            )}
          </div>

          <div className="space-y-2">
            <h4 className="font-bold text-white">Store Contact & Support</h4>
            <p className="text-xs text-slate-300 tabular-nums">
              Official Phone: <a href={links.telUrl} className="underline">{links.phoneDisplay}</a>
            </p>
            <p className="text-xs text-slate-300 tabular-nums">
              WhatsApp Orders: <a href={links.whatsappUrl} target="_blank" rel="noreferrer" className="underline text-emerald-400">{links.whatsappDisplay}</a>
            </p>
            <p className="text-xs text-slate-400">Hours: {storeSettings.openingHours}</p>
          </div>

          <div className="space-y-2">
            <h4 className="font-bold text-white">Quick Actions</h4>
            <div className="flex flex-wrap gap-2">
              <a
                href={links.telUrl}
                className="px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-white"
              >
                {t.callStore}
              </a>
              <a
                href={links.whatsappUrl}
                target="_blank"
                rel="noreferrer"
                className="px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-xs font-semibold text-white"
              >
                {t.whatsappOrder}
              </a>
              <button
                type="button"
                onClick={() => setAppMode('erp')}
                className="px-3.5 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-xs font-bold text-slate-950"
              >
                {t.erpConsole}
              </button>
            </div>
          </div>
        </div>
        <div className="border-t border-slate-800 py-4 text-center text-xs text-slate-400">
          © {new Date().getFullYear()} {storeSettings.nameEn} · {links.phoneDisplay}
        </div>
      </footer>

      {/* Product Detail Modal */}
      {selectedProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-2xl rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden shadow-2xl grid sm:grid-cols-2">
            <div className="bg-slate-100 dark:bg-slate-800 aspect-square sm:aspect-auto">
              <img
                src={selectedProduct.imageUrl || GENERATED_MEDIA.staplesGrains}
                alt={selectedProduct.nameEn}
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
              />
            </div>
            <div className="p-6 flex flex-col justify-between space-y-4">
              <div>
                <div className="flex justify-between items-start gap-2">
                  <span className="text-xs text-slate-500">
                    {selectedProduct.brand} · {selectedProduct.category}
                  </span>
                  <button
                    type="button"
                    onClick={() => setSelectedProduct(null)}
                    aria-label="Close product details"
                    className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <h3 className="text-xl font-extrabold mt-1">{selectedProduct.nameHi}</h3>
                <p className="text-sm text-slate-500">{selectedProduct.nameEn} ({selectedProduct.packSize})</p>
                <p className="text-xs text-slate-600 dark:text-slate-300 mt-3 leading-relaxed">
                  {selectedProduct.description}
                </p>
                <div className="mt-4 text-xs text-slate-500 space-y-1 tabular-nums">
                  <div>SKU: {selectedProduct.sku} · Rack: {selectedProduct.rackNumber}</div>
                  <div>
                    Available Stock:{' '}
                    <strong>
                      {Math.max(0, selectedProduct.currentStock - (selectedProduct.reservedStock || 0))}{' '}
                      {selectedProduct.unit}
                    </strong>
                  </div>
                </div>
              </div>
              <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
                <div className="tabular-nums">
                  <div className="text-xl font-extrabold">{formatINR(selectedProduct.sellingPrice)}</div>
                  <div className="text-xs text-slate-400 line-through">MRP {formatINR(selectedProduct.mrp)}</div>
                </div>
                <button
                  type="button"
                  disabled={selectedProduct.currentStock - (selectedProduct.reservedStock || 0) <= 0}
                  onClick={() => {
                    addToCart(selectedProduct, 1);
                    setSelectedProduct(null);
                    setCartOpen(true);
                  }}
                  className="px-4 py-2.5 rounded-lg bg-[#0F172A] dark:bg-amber-500 text-white dark:text-slate-950 text-xs font-bold"
                >
                  {t.addToCart}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Slide-Over Cart & Checkout Drawer */}
      {cartOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/50">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 h-full flex flex-col border-l border-slate-200 dark:border-slate-800 shadow-2xl">
            <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <h3 className="text-base font-extrabold">
                {t.cart} ({cart.reduce((s, c) => s + c.qty, 0)})
              </h3>
              <button
                type="button"
                onClick={() => setCartOpen(false)}
                aria-label="Close shopping cart"
                className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {confirmedOrder ? (
                <div className="rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30 p-5 space-y-3">
                  <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300 font-bold">
                    <CheckCircle2 className="w-5 h-5" />
                    Order Confirmed: {confirmedOrder.orderNo}
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-300">
                    Thank you {confirmedOrder.customerName}! Total Payable:{' '}
                    <strong className="tabular-nums">{formatINR(confirmedOrder.grandTotal)}</strong>.
                  </p>
                  <p className="text-xs text-slate-600 dark:text-slate-300">
                    Store Contact: <strong>{links.phoneDisplay}</strong>
                  </p>
                  <a
                    href={`${links.whatsappUrl}?text=${encodeURIComponent(
                      `Hello ${storeSettings.nameEn}, I placed order ${confirmedOrder.orderNo} for ${formatINR(confirmedOrder.grandTotal)}.`
                    )}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white"
                  >
                    <MessageCircle className="w-4 h-4" />
                    Send Order on WhatsApp
                  </a>
                  <button
                    type="button"
                    onClick={() => {
                      setConfirmedOrder(null);
                      setCartOpen(false);
                    }}
                    className="block w-full mt-2 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-semibold"
                  >
                    Continue Shopping
                  </button>
                </div>
              ) : cart.length === 0 ? (
                <div className="text-center py-14 text-slate-500 text-sm">
                  Your cart is empty. Add groceries from the catalogue.
                </div>
              ) : (
                <>
                  <div className="space-y-3">
                    {cart.map(({ product, qty }) => (
                      <div
                        key={product.id}
                        className="flex items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-bold truncate">{product.nameHi}</p>
                          <p className="text-xs text-slate-500 tabular-nums">
                            {formatINR(product.sellingPrice)} × {qty} ={' '}
                            <strong>{formatINR(product.sellingPrice * qty)}</strong>
                          </p>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => addToCart(product, -1)}
                            aria-label={`Remove one ${product.nameEn}`}
                            className="p-1.5 rounded border border-slate-200 dark:border-slate-700"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="w-7 text-center text-xs font-bold tabular-nums">{qty}</span>
                          <button
                            type="button"
                            onClick={() => addToCart(product, 1)}
                            aria-label={`Add one ${product.nameEn}`}
                            className="p-1.5 rounded border border-slate-200 dark:border-slate-700"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Coupon Box */}
                  <div className="space-y-1.5">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={couponInput}
                        onChange={(e) => setCouponInput(e.target.value)}
                        placeholder="Coupon code (e.g. RKMALL10)"
                        aria-label="Coupon code"
                        className="flex-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-1.5 text-xs font-mono uppercase"
                      />
                      <button
                        type="button"
                        onClick={handleApplyCoupon}
                        className="px-3 py-1.5 rounded-lg bg-[#0F172A] dark:bg-amber-500 text-white dark:text-slate-950 text-xs font-semibold"
                      >
                        Apply
                      </button>
                    </div>
                    {couponError && <p className="text-xs text-red-600">{couponError}</p>}
                    {appliedCouponCode && couponResult.valid && (
                      <p className="text-xs text-emerald-600 font-semibold">
                        Coupon {appliedCouponCode} applied: -{formatINR(couponResult.discountAmount)}
                      </p>
                    )}
                  </div>

                  {/* Checkout Form */}
                  <form id="store-checkout-form" onSubmit={handleCheckout} className="space-y-3 pt-2">
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setFulfillmentType('delivery')}
                        className={`py-2 px-3 rounded-lg border text-xs font-semibold ${
                          fulfillmentType === 'delivery'
                            ? 'bg-[#0F172A] text-white border-[#0F172A] dark:bg-amber-500 dark:text-slate-950'
                            : 'border-slate-300 dark:border-slate-700'
                        }`}
                      >
                        {t.homeDelivery}
                      </button>
                      <button
                        type="button"
                        onClick={() => setFulfillmentType('pickup')}
                        className={`py-2 px-3 rounded-lg border text-xs font-semibold ${
                          fulfillmentType === 'pickup'
                            ? 'bg-[#0F172A] text-white border-[#0F172A] dark:bg-amber-500 dark:text-slate-950'
                            : 'border-slate-300 dark:border-slate-700'
                        }`}
                      >
                        {t.storePickup}
                      </button>
                    </div>

                    <input
                      type="text"
                      required
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder="Full Name *"
                      aria-label="Customer full name"
                      className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-xs"
                    />
                    <input
                      type="tel"
                      required
                      value={customerMobile}
                      onChange={(e) => setCustomerMobile(e.target.value)}
                      placeholder="Mobile / WhatsApp Number *"
                      aria-label="Customer mobile number"
                      className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-xs"
                    />
                    {fulfillmentType === 'delivery' && (
                      <textarea
                        rows={2}
                        required
                        value={deliveryAddress}
                        onChange={(e) => setDeliveryAddress(e.target.value)}
                        placeholder="Complete Delivery Address & Landmark *"
                        aria-label="Delivery address"
                        className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-xs"
                      />
                    )}
                    <div className="grid grid-cols-2 gap-2">
                      <select
                        aria-label="Schedule slot"
                        value={scheduleSlot}
                        onChange={(e) => setScheduleSlot(e.target.value)}
                        className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-2.5 py-2 text-xs"
                      >
                        <option value="Morning (9 AM - 12 PM)">Morning (9 AM - 12 PM)</option>
                        <option value="Same Day (4 PM - 7 PM)">Same Day (4 PM - 7 PM)</option>
                        <option value="Express (Within 2 Hrs)">Express (Within 2 Hrs)</option>
                      </select>
                      <select
                        aria-label="Payment method"
                        value={paymentMethod}
                        onChange={(e) =>
                          setPaymentMethod(e.target.value as 'cod' | 'upi_on_delivery' | 'store_pickup_pay')
                        }
                        className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-2.5 py-2 text-xs"
                      >
                        <option value="cod">Cash on Delivery</option>
                        <option value="upi_on_delivery">UPI on Delivery</option>
                        <option value="store_pickup_pay">Pay at Store Counter</option>
                      </select>
                    </div>
                  </form>
                </>
              )}
            </div>

            {cart.length > 0 && !confirmedOrder && (
              <div className="p-5 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 space-y-3 tabular-nums">
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span>Subtotal</span>
                    <span>{formatINR(cartSubtotal)}</span>
                  </div>
                  {couponResult.discountAmount > 0 && (
                    <div className="flex justify-between text-emerald-600 font-semibold">
                      <span>Discount</span>
                      <span>-{formatINR(couponResult.discountAmount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span>Delivery Fee</span>
                    <span>{deliveryFee === 0 ? 'FREE' : formatINR(deliveryFee)}</span>
                  </div>
                  <div className="flex justify-between text-base font-extrabold pt-1 border-t border-slate-200 dark:border-slate-800">
                    <span>Grand Total</span>
                    <span>{formatINR(grandTotal)}</span>
                  </div>
                </div>
                <button
                  type="submit"
                  form="store-checkout-form"
                  disabled={placingOrder}
                  className="w-full py-3 rounded-lg bg-[#0F172A] dark:bg-amber-500 text-white dark:text-slate-950 text-sm font-bold hover:bg-slate-800 dark:hover:bg-amber-400 disabled:opacity-50"
                >
                  {placingOrder ? 'Placing Order...' : `${t.checkout} (${formatINR(grandTotal)})`}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
