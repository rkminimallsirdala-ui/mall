import React, { useMemo, useState } from 'react';
import { CheckCircle2, FileText, MapPin, PackageCheck, Phone, Truck, XCircle } from 'lucide-react';
import { formatINR } from '../../config/businessConfig';
import { useMall } from '../../context/MallContext';
import { OnlineOrder, OrderStatus, Sale } from '../../types/erp';
import { calculateCartTotals } from '../../utils/erpLogic';
import { InvoicePrintModal } from '../common/InvoicePrintModal';

const STATUS_FLOW: OrderStatus[] = [
  'new',
  'confirmed',
  'packing',
  'ready_for_pickup',
  'out_for_delivery',
  'delivered',
  'cancelled',
  'returned',
];

export const OrdersDeliveryModule: React.FC = () => {
  const {
    onlineOrders,
    staff,
    sales,
    storeSettings,
    activeRoleView,
    updateOnlineOrderStatus,
    completePosSale,
    dispatchNotification,
    showToast,
  } = useMall();

  const [statusFilter, setStatusFilter] = useState<'ALL' | OrderStatus>('ALL');
  const [podNote, setPodNote] = useState<Record<string, string>>({});
  const [failReason, setFailReason] = useState<Record<string, string>>({});
  const [printSale, setPrintSale] = useState<Sale | null>(null);
  const [busyOrderId, setBusyOrderId] = useState<string | null>(null);

  const deliveryStaffList = useMemo(
    () => staff.filter((s) => s.status === 'active' && (s.role === 'delivery_staff' || s.department === 'Delivery')),
    [staff]
  );

  const visibleOrders = useMemo(() => {
    return onlineOrders
      .filter((o) => {
        if (activeRoleView === 'delivery_staff') {
          if (statusFilter === 'ALL') {
            return ['packing', 'ready_for_pickup', 'out_for_delivery', 'delivered'].includes(o.status);
          }
        }
        return statusFilter === 'ALL' || o.status === statusFilter;
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [onlineOrders, statusFilter, activeRoleView]);

  const handleStatusChange = async (order: OnlineOrder, nextStatus: OrderStatus) => {
    setBusyOrderId(order.id);
    try {
      await updateOnlineOrderStatus(order.id, nextStatus, {
        proofOfDelivery: nextStatus === 'delivered' ? podNote[order.id] || 'Delivered to customer' : undefined,
        failedReason: nextStatus === 'cancelled' || nextStatus === 'returned' ? failReason[order.id] : undefined,
      });

      const trigger =
        nextStatus === 'confirmed'
          ? 'order_confirmed'
          : nextStatus === 'out_for_delivery'
          ? 'out_for_delivery'
          : nextStatus === 'delivered'
          ? 'delivered'
          : nextStatus === 'cancelled'
          ? 'order_cancelled'
          : '';
      if (trigger) {
        await dispatchNotification({
          channel: 'whatsapp',
          recipient: order.customerMobile,
          trigger,
          body: `${storeSettings.nameHi}: आपका ऑर्डर ${order.orderNo} अब "${nextStatus}" स्थिति में है। राशि: ${formatINR(order.grandTotal)}`,
        });
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Status update failed', 'error');
    } finally {
      setBusyOrderId(null);
    }
  };

  const handleAssignDelivery = async (orderId: string, staffId: string) => {
    const member = staff.find((s) => s.id === staffId);
    if (!member) return;
    await updateOnlineOrderStatus(orderId, 'out_for_delivery', {
      assignedDeliveryStaffId: member.id,
      assignedDeliveryStaffName: member.fullName,
    });
  };

  const handleConvertToInvoice = async (order: OnlineOrder) => {
    if (order.convertedInvoiceNo) {
      const existing = sales.find((s) => s.invoiceNo === order.convertedInvoiceNo);
      if (existing) setPrintSale(existing);
      return;
    }
    setBusyOrderId(order.id);
    try {
      const totals = calculateCartTotals(order.items, 0, order.discountTotal);
      const grandTotal = order.grandTotal;
      const { sale } = await completePosSale({
        items: order.items,
        customerId: order.customerId || 'walkin',
        customerName: order.customerName,
        customerMobile: order.customerMobile,
        itemTotal: totals.itemTotal,
        discountTotal: order.discountTotal,
        couponCode: order.couponCode,
        taxableValue: totals.taxableValue,
        cgstTotal: totals.cgstTotal,
        sgstTotal: totals.sgstTotal,
        igstTotal: totals.igstTotal,
        totalGst: totals.totalGst,
        roundOff: totals.roundOff,
        grandTotal,
        customerSavings: totals.customerSavings,
        paymentMode: order.paymentMethod === 'upi_on_delivery' ? 'upi' : 'cash',
        paymentSplit: {
          cash: order.paymentMethod === 'upi_on_delivery' ? 0 : grandTotal,
          upi: order.paymentMethod === 'upi_on_delivery' ? grandTotal : 0,
          card: 0,
          bank: 0,
          creditKhata: 0,
        },
        amountPaid: grandTotal,
        balanceDue: 0,
        idempotencyKey: `ord_conv_${order.id}`,
        sourceOrderId: order.id,
      });
      setPrintSale(sale);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Invoice conversion failed', 'error');
    } finally {
      setBusyOrderId(null);
    }
  };

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold tracking-tight">
            {activeRoleView === 'delivery_staff'
              ? 'Delivery Staff Dispatch Queue'
              : 'Online Orders, Stock Reservation & Delivery Pipeline'}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Single-deduction stock guarantee: confirming reserves stock once; cancelling releases it; converting skips double-deduction.
          </p>
        </div>

        <div className="flex flex-wrap gap-1.5 text-xs">
          {(['ALL', ...STATUS_FLOW] as const).map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setStatusFilter(st)}
              className={`px-2.5 py-1.5 rounded-lg border font-semibold capitalize ${
                statusFilter === st
                  ? 'bg-[#0F172A] text-white border-[#0F172A] dark:bg-amber-500 dark:text-slate-950'
                  : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300'
              }`}
            >
              {st === 'ALL' ? `All (${onlineOrders.length})` : st.replace(/_/g, ' ')}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        {visibleOrders.length === 0 ? (
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 text-center text-xs text-slate-400">
            No online orders match the selected filter.
          </div>
        ) : (
          visibleOrders.map((ord) => (
            <div
              key={ord.id}
              className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-3"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-sm font-extrabold">{ord.orderNo}</span>
                    <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[11px] font-bold uppercase">
                      {ord.status.replace(/_/g, ' ')}
                    </span>
                    <span className="text-xs text-slate-500">
                      {ord.fulfillmentType === 'delivery' ? 'Home Delivery' : 'Store Pickup'} · {ord.paymentMethod.replace(/_/g, ' ')}
                    </span>
                    {ord.stockReserved && (
                      <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                        Stock Reserved
                      </span>
                    )}
                    {ord.convertedInvoiceNo && (
                      <span className="font-mono text-[11px] font-bold text-amber-600 dark:text-amber-400">
                        Invoice: {ord.convertedInvoiceNo}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-slate-600 dark:text-slate-300 mt-1 flex flex-wrap items-center gap-3">
                    <span className="font-bold">{ord.customerName}</span>
                    <a href={`tel:${ord.customerMobile}`} className="inline-flex items-center gap-1 text-emerald-600 font-semibold">
                      <Phone className="w-3 h-3" />
                      {ord.customerMobile}
                    </a>
                    <span className="inline-flex items-center gap-1 text-slate-500">
                      <MapPin className="w-3 h-3" />
                      {ord.deliveryAddress || 'Store Pickup'}
                    </span>
                  </div>
                </div>

                <div className="text-right tabular-nums">
                  <div className="text-base font-extrabold text-[#0F172A] dark:text-amber-400">
                    {formatINR(ord.grandTotal)}
                  </div>
                  <div className="text-[11px] text-slate-500">
                    {ord.items.length} item(s) · {ord.createdAt.slice(0, 10)}
                  </div>
                </div>
              </div>

              {/* Order Items */}
              <div className="rounded-lg bg-slate-50 dark:bg-slate-950 p-3 text-xs grid sm:grid-cols-2 lg:grid-cols-3 gap-2 tabular-nums">
                {ord.items.map((it) => (
                  <div key={it.productId} className="flex justify-between gap-2">
                    <span className="truncate">
                      {it.nameHi} × {it.qty}
                    </span>
                    <span className="font-bold">{formatINR(it.lineTotal)}</span>
                  </div>
                ))}
              </div>

              {/* Action Controls */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
                <div className="flex flex-wrap items-center gap-2">
                  {ord.status === 'new' && activeRoleView !== 'delivery_staff' && (
                    <button
                      type="button"
                      disabled={busyOrderId === ord.id}
                      onClick={() => handleStatusChange(ord, 'confirmed')}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 text-white font-bold"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Confirm & Reserve Stock
                    </button>
                  )}
                  {ord.status === 'confirmed' && activeRoleView !== 'delivery_staff' && (
                    <button
                      type="button"
                      disabled={busyOrderId === ord.id}
                      onClick={() => handleStatusChange(ord, 'packing')}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#0F172A] dark:bg-amber-500 text-white dark:text-slate-950 font-bold hover:bg-slate-800 dark:hover:bg-amber-400 transition"
                    >
                      <PackageCheck className="w-3.5 h-3.5" />
                      Move to Packing
                    </button>
                  )}
                  {ord.status === 'packing' && (
                    <button
                      type="button"
                      disabled={busyOrderId === ord.id}
                      onClick={() =>
                        handleStatusChange(ord, ord.fulfillmentType === 'pickup' ? 'ready_for_pickup' : 'out_for_delivery')
                      }
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-amber-500 text-slate-950 font-bold"
                    >
                      <Truck className="w-3.5 h-3.5" />
                      {ord.fulfillmentType === 'pickup' ? 'Ready for Pickup' : 'Dispatch Out for Delivery'}
                    </button>
                  )}
                  {(ord.status === 'out_for_delivery' || ord.status === 'ready_for_pickup') && (
                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        type="text"
                        value={podNote[ord.id] || ''}
                        onChange={(e) => setPodNote({ ...podNote, [ord.id]: e.target.value })}
                        placeholder="Proof of Delivery / Receiver note"
                        className="rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2.5 py-1.5"
                      />
                      <button
                        type="button"
                        disabled={busyOrderId === ord.id}
                        onClick={() => handleStatusChange(ord, 'delivered')}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 text-white font-bold"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Mark Delivered
                      </button>
                    </div>
                  )}

                  {activeRoleView !== 'delivery_staff' && ord.fulfillmentType === 'delivery' && !['delivered', 'cancelled', 'returned'].includes(ord.status) && (
                    <select
                      aria-label={`Assign delivery staff for ${ord.orderNo}`}
                      value={ord.assignedDeliveryStaffId || ''}
                      onChange={(e) => handleAssignDelivery(ord.id, e.target.value)}
                      className="rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2.5 py-1.5"
                    >
                      <option value="">Assign Delivery Staff...</option>
                      {deliveryStaffList.map((st) => (
                        <option key={st.id} value={st.id}>
                          {st.fullName} ({st.mobile})
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {activeRoleView !== 'delivery_staff' && !['cancelled', 'returned'].includes(ord.status) && (
                    <button
                      type="button"
                      disabled={busyOrderId === ord.id}
                      onClick={() => handleConvertToInvoice(ord)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 font-bold hover:bg-slate-50 dark:hover:bg-slate-800"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      {ord.convertedInvoiceNo ? `View Invoice ${ord.convertedInvoiceNo}` : 'Convert to POS Invoice'}
                    </button>
                  )}

                  {!['delivered', 'cancelled', 'returned'].includes(ord.status) && (
                    <div className="flex items-center gap-1">
                      <input
                        type="text"
                        value={failReason[ord.id] || ''}
                        onChange={(e) => setFailReason({ ...failReason, [ord.id]: e.target.value })}
                        placeholder="Cancel/Fail reason"
                        className="w-32 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2 py-1"
                      />
                      <button
                        type="button"
                        disabled={busyOrderId === ord.id}
                        onClick={() => handleStatusChange(ord, 'cancelled')}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-red-200 dark:border-red-900 text-red-600 font-semibold"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        Cancel
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {printSale && (
        <InvoicePrintModal sale={printSale} settings={storeSettings} onClose={() => setPrintSale(null)} />
      )}
    </div>
  );
};
