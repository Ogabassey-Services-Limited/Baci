'use client';

import { File, PlusCircle, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { OrderManagerModal } from '@/components/jumia/order-manager-modal';
import { BagLoader } from '@/components/ui/bag-loader';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/auth-context';
import { useMerchant } from '@/hooks/use-merchant';
import { useToast } from '@/hooks/use-toast';
import { apiPatch } from '@/lib/api-client';
import { getCountryByCode } from '@/lib/countries';
import {
  getOrders,
  type Order,
  type OrderStats,
  type ShippingStatus,
} from './actions';
import { OrdersFiltersBar } from './orders-filters-bar';
import { OrdersListCard } from './orders-list-card';
import { OrdersStatsCards, OrdersUrgentAlert } from './orders-stats-cards';

interface OrdersClientPageProps {
  initialOrders?: Order[];
  initialStats?: OrderStats;
}

function formatStatusForDb(status: string) {
  return status.toLowerCase().replace(' ', '_');
}

export default function OrdersClientPage({
  initialOrders = [],
  initialStats = {
    totalOrders: 0,
    completedOrders: 0,
    unpaidOrders: 0,
    urgentOrders: 0,
  },
}: OrdersClientPageProps) {
  const { merchant, loading: merchantLoading } = useMerchant();
  const { loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [paymentFilter, setPaymentFilter] = useState('All');
  const [shippingFilter, setShippingFilter] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');
  const [orders, setOrders] = useState<Order[]>(initialOrders);
  const [showAlert, setShowAlert] = useState(true);
  const [selectedOrders, setSelectedOrders] = useState<Set<string>>(new Set());
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ordersError, setOrdersError] = useState<string | null>(null);
  const [selectedJumiaOrder, setSelectedJumiaOrder] = useState<Order | null>(
    null
  );
  const isHydrated = useRef(false);

  useEffect(() => {
    if (
      !isHydrated.current &&
      initialOrders.length > 0 &&
      paymentFilter === 'All' &&
      shippingFilter === 'All' &&
      !searchTerm
    ) {
      isHydrated.current = true;
      return;
    }

    isHydrated.current = true;

    if (!merchant?.id) {
      return;
    }

    const fetchOrders = async () => {
      setOrdersLoading(true);
      setOrdersError(null);

      try {
        const fetchedOrders = await getOrders(merchant.id, {
          paymentStatus: paymentFilter,
          shippingStatus: shippingFilter,
          search: searchTerm,
        });
        setOrders(fetchedOrders);
      } catch (_error) {
        setOrdersError('Could not load orders.');
        toast({
          title: 'Error Fetching Orders',
          description: 'Could not load orders. Please try again.',
          variant: 'destructive',
        });
      } finally {
        setOrdersLoading(false);
      }
    };

    const timer = window.setTimeout(
      () => {
        void fetchOrders();
      },
      searchTerm ? 500 : 0
    );

    return () => window.clearTimeout(timer);
  }, [
    initialOrders.length,
    merchant?.id,
    paymentFilter,
    searchTerm,
    shippingFilter,
    toast,
  ]);

  const handleUpdateStatus = async (
    orderNumber: string,
    newStatus: ShippingStatus
  ) => {
    const order = orders.find(
      (candidate) => candidate.orderNumber === orderNumber
    );

    if (!order?.id) {
      toast({
        title: 'Error',
        description: `Could not find order ${orderNumber} to update.`,
        variant: 'destructive',
      });
      return;
    }

    try {
      await apiPatch(`/api/orders/${order.id}`, {
        shipping_status: formatStatusForDb(newStatus),
      });

      setOrders((currentOrders) =>
        currentOrders.map((candidate) =>
          candidate.orderNumber === orderNumber
            ? { ...candidate, shippingStatus: newStatus }
            : candidate
        )
      );

      toast({
        title: `Order ${newStatus}! 🎉`,
        description: `Order ${orderNumber} has been updated.`,
      });
    } catch (_error) {
      toast({
        variant: 'destructive',
        title: 'Update Failed',
        description: 'Failed to update order status. Please try again.',
      });
    }
  };

  const formatCurrency = (amount: number) => {
    const country = merchant?.country
      ? getCountryByCode(merchant.country)
      : undefined;
    const locale = country ? `en-${country.code}` : 'en-US';
    const currency = country ? country.currency : 'USD';
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      currencyDisplay: 'symbol',
    }).format(amount);
  };

  const filteredOrders = orders.filter((order) => {
    const paymentMatch =
      paymentFilter === 'All' || order.paymentStatus === paymentFilter;
    const shippingMatch =
      shippingFilter === 'All' || order.shippingStatus === shippingFilter;
    const searchMatch =
      searchTerm === '' ||
      order.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.orderNumber.toLowerCase().includes(searchTerm.toLowerCase());

    return paymentMatch && shippingMatch && searchMatch;
  });

  const handleSelectOrder = (orderNumber: string, isSelected: boolean) => {
    setSelectedOrders((currentSelection) => {
      const nextSelection = new Set(currentSelection);

      if (isSelected) {
        nextSelection.add(orderNumber);
      } else {
        nextSelection.delete(orderNumber);
      }

      return nextSelection;
    });
  };

  const handleSelectAll = (isSelected: boolean) => {
    if (isSelected) {
      setSelectedOrders(
        new Set(filteredOrders.map((order) => order.orderNumber))
      );
      return;
    }

    setSelectedOrders(new Set());
  };

  if (authLoading || merchantLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <BagLoader size={32} />
      </div>
    );
  }

  return (
    <div className="relative flex h-full flex-col gap-4">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/10 via-background to-background" />
      <div className="pointer-events-none absolute left-0 top-0 -z-10 h-full w-full bg-[url('/grid.svg')] bg-center opacity-50 [mask-image:linear-gradient(180deg,white,rgba(255,255,255,0))]" />

      <div className="flex items-center justify-between">
        <h1 className="bg-gradient-to-r from-primary via-purple-500 to-blue-600 bg-clip-text text-3xl font-bold tracking-tight text-transparent">
          Orders 📦
        </h1>
        <div className="flex items-center gap-2">
          <Button
            size="icon"
            variant="outline"
            className="h-11 min-h-[44px] w-11 min-w-[44px]"
          >
            <File className="h-4 w-4" />
            <span className="sr-only">Export</span>
          </Button>
          <Button
            size="icon"
            variant="outline"
            className="h-11 min-h-[44px] w-11 min-w-[44px]"
          >
            <RefreshCw className="h-4 w-4" />
            <span className="sr-only">Refresh</span>
          </Button>
          <Link href="/dashboard/orders/create">
            <Button size="sm" className="h-11 min-h-[44px] gap-1">
              <PlusCircle className="h-4 w-4" />
              <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">
                Create Order
              </span>
            </Button>
          </Link>
        </div>
      </div>

      <OrdersStatsCards stats={initialStats} statsLoading={false} />

      <OrdersFiltersBar
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        paymentFilter={paymentFilter}
        onPaymentFilterChange={setPaymentFilter}
        shippingFilter={shippingFilter}
        onShippingFilterChange={setShippingFilter}
      />

      <OrdersUrgentAlert
        showAlert={showAlert}
        stats={initialStats}
        statsLoading={false}
        onDismiss={() => setShowAlert(false)}
        onResolve={() =>
          toast({
            title: 'Coming Soon',
            description: 'This feature will filter to show only urgent orders.',
          })
        }
      />

      <OrdersListCard
        filteredOrders={filteredOrders}
        selectedOrders={selectedOrders}
        ordersLoading={ordersLoading}
        ordersError={ordersError}
        onSelectAll={handleSelectAll}
        onSelectOrder={handleSelectOrder}
        onStatusUpdate={handleUpdateStatus}
        onManageJumia={setSelectedJumiaOrder}
        formatCurrency={formatCurrency}
      />

      {selectedJumiaOrder && (
        <OrderManagerModal
          isOpen={!!selectedJumiaOrder}
          onClose={() => setSelectedJumiaOrder(null)}
          orderId={selectedJumiaOrder.id}
          orderNumber={selectedJumiaOrder.orderNumber}
        />
      )}
    </div>
  );
}
