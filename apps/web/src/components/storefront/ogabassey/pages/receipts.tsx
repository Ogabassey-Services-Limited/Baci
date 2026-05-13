'use client';

import type { ReceiptMerchant, ReceiptOrder } from '@baci/shared';
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  ExternalLink,
  FileText,
  Leaf,
  Loader2,
  Search,
  X,
} from 'lucide-react';
import type React from 'react';
import { useEffect, useState } from 'react';
import { EmptyState } from '../components/empty-state';
import { ReceiptModal } from '../components/ReceiptModal';
import { useCustomerAuth } from '@/contexts/customer-auth-context';
import { useMerchantSafe } from '@/hooks/use-merchant-client';

/** List item for display in the receipts grid */
interface ReceiptListItem {
  id: string;
  order_number: string;
  date: string;
  total: string;
  status: 'Paid' | 'Partially Paid' | 'Unpaid';
  paymentStatus: 'paid' | 'partially_paid' | 'unpaid';
  balance: string;
  firstProductName: string;
  firstProductImage: string;
  /** Raw order data for the shared receipt generator */
  rawOrder: ReceiptOrder;
}

export const OgabasseyV2Receipts: React.FC = () => {
  const { customer, isAuthenticated } = useCustomerAuth();
  const merchantContext = useMerchantSafe();

  const [searchQuery, setSearchQuery] = useState('');
  const [receipts, setReceipts] = useState<ReceiptListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<ReceiptOrder | null>(null);
  const [merchantReceiptData, setMerchantReceiptData] =
    useState<ReceiptMerchant | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Fetch orders
  useEffect(() => {
    const fetchOrders = async () => {
      if (!isAuthenticated || !merchantContext?.merchant?.slug) {
        setIsLoading(false);
        return;
      }

      try {
        const res = await fetch(
          `/api/storefront/orders?merchantSlug=${encodeURIComponent(merchantContext.merchant.slug)}`
        );
        const data = await res.json();

        if (data.orders) {
          const customerName = customer
            ? `${customer.first_name || ''} ${customer.last_name || ''}`.trim() ||
              'Customer'
            : 'Customer';

          const mapped: ReceiptListItem[] = data.orders.map(
            (order: Record<string, unknown>) => {
              const items = (order.items as Array<Record<string, unknown>>) ?? [];
              const currency = (order.currency as string) || 'NGN';
              const total = Number(order.total) || 0;
              const amountPaid = Number(order.amount_paid ?? total);
              const paymentStatus =
                (order.payment_status as string) || 'unpaid';

              const formatCurrency = (val: number) =>
                new Intl.NumberFormat('en-NG', {
                  style: 'currency',
                  currency,
                  minimumFractionDigits: 0,
                }).format(val);

              const rawOrder: ReceiptOrder = {
                order_number:
                  (order.order_number as string) ||
                  String(order.id).slice(0, 8).toUpperCase(),
                created_at: order.created_at as string,
                currency,
                total,
                subtotal: Number(order.subtotal ?? total),
                shipping_fee: Number(order.shipping_fee ?? 0),
                tax_amount: Number(order.tax_amount ?? 0),
                discount_amount: Number(order.discount_amount ?? 0),
                amount_paid: amountPaid,
                balance: Number(order.balance ?? total - amountPaid),
                payment_status: paymentStatus,
                payment_method: (order.payment_method as string) ?? null,
                is_credit_order: (order.is_credit_order as boolean) ?? false,
                customer_name: customerName,
                customer_email: customer?.email || '',
                customer_phone: (customer?.phone as string) ?? null,
                shipping_address:
                  (order.shipping_address as ReceiptOrder['shipping_address']) ??
                  null,
                virtual_account: null,
                items: items.map((item) => ({
                  product_name:
                    (item.product_name as string) ||
                    (item.name as string) ||
                    'Product',
                  quantity: Number(item.quantity) || 1,
                  price: Number(item.price) || 0,
                })),
              };

              const statusLabel =
                paymentStatus === 'paid'
                  ? 'Paid'
                  : paymentStatus === 'partially_paid'
                    ? 'Partially Paid'
                    : 'Unpaid';

              return {
                id: order.id as string,
                order_number: rawOrder.order_number,
                date: new Date(order.created_at as string).toLocaleDateString(),
                total: formatCurrency(total),
                status: statusLabel,
                paymentStatus: paymentStatus as ReceiptListItem['paymentStatus'],
                balance: formatCurrency(Math.max(0, total - amountPaid)),
                firstProductName:
                  (items[0]?.product_name as string) ||
                  (items[0]?.name as string) ||
                  'Unknown item',
                firstProductImage:
                  (items[0]?.product_image as string) ||
                  (items[0]?.image as string) ||
                  '/placeholder.png',
                rawOrder,
              } satisfies ReceiptListItem;
            }
          );

          setReceipts(mapped);
        }
      } catch (err) {
        console.error('Failed to fetch receipts', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchOrders();
  }, [isAuthenticated, merchantContext?.merchant?.slug, customer]);

  // Build merchant receipt data from context
  useEffect(() => {
    const m = merchantContext?.merchant;
    if (!m) return;

    setMerchantReceiptData({
      business_name: m.business_name || null,
      logo_url: m.logo_url || null,
      email: m.email || '',
      phone: m.phone || null,
      support_email: m.support_email || null,
      support_phone: m.support_phone || null,
      business_address: m.business_address || null,
      cac_rc_number: null,
      tax_identification_number: null,
      legal_entity_name: null,
      brand_colors: m.brand_colors,
      vat_registration_status: m.vat_registration_status || null,
      vat_rate: m.vat_rate ?? null,
      bank_code: null,
      bank_account_number: null,
      bank_name: null,
      bank_account_name: null,
      social_media: m.social_media,
      pages: m.pages,
    });
  }, [merchantContext?.merchant]);

  const filteredReceipts = receipts.filter((receipt) => {
    const query = searchQuery.toLowerCase();
    return (
      receipt.order_number.toLowerCase().includes(query) ||
      receipt.firstProductName.toLowerCase().includes(query) ||
      receipt.status.toLowerCase().includes(query)
    );
  });

  const handleViewReceipt = (receipt: ReceiptListItem) => {
    setSelectedOrder(receipt.rawOrder);
    setIsModalOpen(true);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Paid':
        return (
          <span className="bg-green-50 text-green-700 text-[10px] font-bold px-2.5 py-1 rounded-full border border-green-100 flex items-center gap-1 w-fit">
            <CheckCircle2 size={12} /> Paid
          </span>
        );
      case 'Partially Paid':
        return (
          <span className="bg-yellow-50 text-yellow-700 text-[10px] font-bold px-2.5 py-1 rounded-full border border-yellow-100 flex items-center gap-1 w-fit">
            <Clock size={12} /> Partial
          </span>
        );
      default:
        return (
          <span className="bg-red-50 text-red-700 text-[10px] font-bold px-2.5 py-1 rounded-full border border-red-100 flex items-center gap-1 w-fit">
            <AlertCircle size={12} /> Unpaid
          </span>
        );
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="animate-spin text-gray-400" size={32} />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <EmptyState
          title="Sign in to view receipts"
          description="Log in to your account to access your receipts and invoices."
          variant="generic"
          compact
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24 md:pb-12 pt-4 md:pt-8 flex flex-col">
      <div className="max-w-[1400px] mx-auto px-4 md:px-6 w-full flex-1 flex flex-col">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <FileText className="text-red-600 fill-red-600" />
            Receipts & Invoices
          </h1>

          <div className="relative w-full md:w-96">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search ID, Product or Status..."
              className="w-full pl-10 pr-10 py-2.5 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-100 focus:border-red-200 transition-all text-sm"
            />
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              size={18}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Sustainability Banner */}
        <div className="bg-green-50 border border-green-100 rounded-xl p-4 mb-8 flex items-center gap-3">
          <div className="p-2 bg-white text-green-600 rounded-lg shrink-0 border border-green-100">
            <Leaf size={18} />
          </div>
          <div>
            <p className="text-xs font-bold text-green-800 uppercase tracking-wide mb-0.5">
              100% Paperless
            </p>
            <p className="text-sm text-green-700">
              By using digital receipts, you&apos;ve helped us save over 100k
              sheets of paper this year.
            </p>
          </div>
        </div>

        {filteredReceipts.length === 0 ? (
          <div className="flex-1 flex items-center justify-center">
            <EmptyState
              title="No receipts found"
              description={
                searchQuery
                  ? `No results found for "${searchQuery}"`
                  : 'You have no transactions receipts yet. Orders you make will appear here.'
              }
              variant="generic"
              compact
            />
          </div>
        ) : (
          <div className="space-y-4">
            {filteredReceipts.map((receipt) => (
              <div
                key={receipt.id}
                className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden group"
              >
                <div className="p-5 md:p-6 flex flex-col md:flex-row gap-6 md:items-center">
                  {/* Product Image */}
                  <div className="w-16 h-16 md:w-20 md:h-20 bg-gray-50 rounded-xl p-2 shrink-0 border border-gray-100 flex items-center justify-center">
                    <img
                      src={receipt.firstProductImage}
                      alt={receipt.firstProductName}
                      className="w-full h-full object-contain mix-blend-multiply"
                    />
                  </div>

                  {/* Info Grid */}
                  <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-8">
                    {/* Column 1: Order Details */}
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        {getStatusBadge(receipt.status)}
                        <span className="text-xs text-gray-400">&bull;</span>
                        <span className="text-xs text-gray-500 font-medium">
                          {receipt.date}
                        </span>
                      </div>
                      <h3 className="font-bold text-gray-900 text-sm md:text-base mb-0.5">
                        #{receipt.order_number}
                      </h3>
                      <p className="text-xs text-gray-500 truncate">
                        {receipt.firstProductName}
                      </p>
                    </div>

                    {/* Column 2: Payment */}
                    <div className="flex flex-col justify-center">
                      <span className="text-[10px] uppercase tracking-wider text-gray-400 font-bold mb-1">
                        {receipt.paymentStatus === 'unpaid'
                          ? 'Total Due'
                          : 'Total Amount'}
                      </span>
                      <span
                        className={`font-bold text-lg ${receipt.paymentStatus === 'unpaid' ? 'text-red-600' : 'text-gray-900'}`}
                      >
                        {receipt.total}
                      </span>
                      {receipt.paymentStatus === 'partially_paid' && (
                        <span className="text-xs text-red-500 font-medium">
                          Bal: {receipt.balance}
                        </span>
                      )}
                    </div>

                    {/* Column 3: Actions */}
                    <div className="flex items-center justify-start md:justify-end gap-3 md:border-l md:border-gray-50 md:pl-6">
                      <button
                        type="button"
                        onClick={() => handleViewReceipt(receipt)}
                        className="flex items-center gap-2 text-xs font-bold text-gray-600 hover:text-red-600 hover:bg-red-50 py-2.5 px-4 rounded-xl transition-colors border border-gray-200 hover:border-red-100 group/btn"
                      >
                        <ExternalLink
                          size={14}
                          className="group-hover/btn:scale-110 transition-transform"
                        />
                        View{' '}
                        {receipt.paymentStatus === 'unpaid'
                          ? 'Invoice'
                          : 'Receipt'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <ReceiptModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        orderData={selectedOrder}
        merchantData={merchantReceiptData}
      />
    </div>
  );
};
