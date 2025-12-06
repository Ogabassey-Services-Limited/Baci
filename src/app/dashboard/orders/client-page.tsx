'use client';

import {
  AlertCircle as AlertCircleIcon,
  AlertTriangle,
  Box,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  CircleDot,
  Clock,
  CreditCard,
  File,
  FileWarning,
  Hourglass,
  List,
  ListFilter,
  MapPin,
  PackageCheck,
  PlusCircle,
  RefreshCw,
  RotateCcw,
  Search,
  ShoppingCart,
  Truck,
  Undo2,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { BagLoader } from '@/components/ui/bag-loader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/auth-context';
import { useMerchant } from '@/hooks/use-merchant';
import { useToast } from '@/hooks/use-toast';
import { apiPatch } from '@/lib/api-client';
import { getCountryByCode } from '@/lib/countries';
import { cn } from '@/lib/utils';
import {
  getOrders,
  type Order,
  type OrderStats,
  type PaymentStatus,
  type ShippingStatus,
} from './actions';

export const StatusBadge = ({
  status,
  type,
}: {
  status: string;
  type: 'payment' | 'shipping';
}) => {
  const paymentVariants: { [key: string]: string } = {
    Paid: 'bg-green-100 text-green-800 border-green-200',
    Unpaid: 'bg-red-100 text-red-800 border-red-200',
    Pending: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    'Partially Paid': 'bg-blue-100 text-blue-800 border-blue-200',
    Refunded: 'bg-gray-100 text-gray-800 border-gray-200',
  };

  const shippingVariants: { [key: string]: string } = {
    Pending: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    Processing: 'bg-blue-100 text-blue-800 border-blue-200',
    Shipped: 'bg-indigo-100 text-indigo-800 border-indigo-200',
    Delivered: 'bg-green-100 text-green-800 border-green-200',
    Canceled: 'bg-red-100 text-red-800 border-red-200',
    Returned: 'bg-purple-100 text-purple-800 border-purple-200',
  };

  const className =
    type === 'payment' ? paymentVariants[status] : shippingVariants[status];

  return (
    <Badge
      variant={'outline'}
      className={cn('capitalize justify-center', className)}
    >
      {status}
    </Badge>
  );
};

const StatusDropdown = ({
  order,
  onStatusUpdate,
}: {
  order: Order;
  onStatusUpdate: (orderNumber: string, newStatus: ShippingStatus) => void;
}) => {
  const { shippingStatus } = order;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="flex items-center gap-2 capitalize w-full justify-between"
        >
          <StatusBadge status={shippingStatus} type="shipping" />
          <ChevronDown className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {shippingStatus === 'Pending' && (
          <DropdownMenuItem
            onSelect={() => onStatusUpdate(order.orderNumber, 'Processing')}
          >
            <CheckCircle className="mr-2 h-4 w-4" />
            <span>Confirm Order</span>
          </DropdownMenuItem>
        )}
        {shippingStatus === 'Processing' && (
          <DropdownMenuItem
            onSelect={() => onStatusUpdate(order.orderNumber, 'Shipped')}
          >
            <Truck className="mr-2 h-4 w-4" />
            <span>Ship Order</span>
          </DropdownMenuItem>
        )}
        {shippingStatus === 'Shipped' && (
          <DropdownMenuItem
            onSelect={() => onStatusUpdate(order.orderNumber, 'Delivered')}
          >
            <PackageCheck className="mr-2 h-4 w-4" />
            <span>Mark as Delivered</span>
          </DropdownMenuItem>
        )}
        {shippingStatus === 'Delivered' && (
          <DropdownMenuItem
            onSelect={() => onStatusUpdate(order.orderNumber, 'Returned')}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            <span>Process Return</span>
          </DropdownMenuItem>
        )}
        {(shippingStatus === 'Pending' || shippingStatus === 'Processing') && (
          <DropdownMenuItem
            onSelect={() => onStatusUpdate(order.orderNumber, 'Canceled')}
            className="text-red-600 focus:text-red-600 focus:bg-red-50"
          >
            <X className="mr-2 h-4 w-4" />
            <span>Cancel Order</span>
          </DropdownMenuItem>
        )}
        {(shippingStatus === 'Canceled' || shippingStatus === 'Returned') && (
          <DropdownMenuItem disabled>No actions available</DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export const SourceIcon = ({ source }: { source: string }) => {
  if (source === 'whatsapp') {
    return (
      <svg
        className="h-6 w-6 text-green-500"
        viewBox="0 0 24 24"
        fill="currentColor"
        aria-hidden="true"
      >
        <path d="M12.04 2C6.58 2 2.13 6.45 2.13 12c0 1.74.45 3.38 1.26 4.84l-1.33 4.85 4.97-1.3c1.4.78 2.98 1.21 4.61 1.21h.01c5.46 0 9.91-4.45 9.91-9.91 0-5.46-4.45-9.91-9.91-9.91zM17.48 15.36c-.21.6-1.3 1.12-1.79 1.18-.49.06-1.04.06-1.57-.09-.53-.15-1.12-.34-1.84-1.1-1.02-1.08-1.7-2.35-1.93-2.76-.23-.41-.03-.63.18-.84.2-.21.41-.35.56-.53.15-.18.2-.3.15-.49-.06-.18-.53-1.27-.73-1.76s-.4-.41-.56-.41h-.48c-.18 0-.4.18-.56.41-.18.21-.69.69-.69 1.69s.71 1.97.81 2.12c.1.15 1.41 2.35 3.43 3.21.49.21.87.34 1.18.43.53.15.99.12 1.36-.03.44-.18.69-.81.79-1.53.1-.71.1-1.3-.03-1.48-.06-.18-.24-.27-.45-.45z" />
      </svg>
    );
  }
  if (source === 'instagram') {
    return (
      <svg
        className="h-6 w-6"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
        <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
        <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
      </svg>
    );
  }
  return <div className="h-6 w-6 rounded-full bg-gray-200" />;
};

const OrderCard = ({
  order,
  isSelected,
  onSelect,
  onStatusUpdate,
  formatCurrency,
}: {
  order: Order;
  isSelected: boolean;
  onSelect: (orderNumber: string, isSelected: boolean) => void;
  onStatusUpdate: (orderNumber: string, newStatus: ShippingStatus) => void;
  formatCurrency: (amount: number) => string;
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const itemCount = order.items?.length || 0;

  // Visual-First: Show thumbnails instead of text
  const visibleItems = order.items?.slice(0, 4) || [];
  const remainingItems = itemCount > 4 ? itemCount - 4 : 0;

  // Urgency Logic
  const orderTime = order.createdAt || new Date(order.date).getTime();
  const hoursAgo = Math.max(
    0,
    Math.floor((Date.now() - orderTime) / (1000 * 60 * 60))
  );

  // "Actionable" states: Pending/Processing shipping OR Unpaid/Pending payment
  const isActionable =
    ['Pending', 'Processing'].includes(order.shippingStatus) ||
    ['Unpaid', 'Pending'].includes(order.paymentStatus);

  // Exclude fully completed flows
  const isCompleted =
    ['Shipped', 'Delivered', 'Canceled', 'Returned'].includes(
      order.shippingStatus
    ) && ['Paid', 'Refunded'].includes(order.paymentStatus);

  const isUrgent = isActionable && !isCompleted && hoursAgo > 48;
  const isWarning = isActionable && !isCompleted && hoursAgo > 24 && !isUrgent;

  const timeDisplay = (() => {
    if (hoursAgo < 1) return 'Just now';
    if (hoursAgo < 24) return `${hoursAgo} hr${hoursAgo > 1 ? 's' : ''} ago`;
    const days = Math.floor(hoursAgo / 24);
    return `${days} day${days > 1 ? 's' : ''} ago`;
  })();

  const contextLabel = (() => {
    if (['Unpaid', 'Pending'].includes(order.paymentStatus))
      return 'Payment Pending';
    if (order.shippingStatus === 'Pending') return 'Unfulfilled';
    if (order.shippingStatus === 'Processing') return 'Processing';
    return 'Attention';
  })();

  const cardStyle = isUrgent
    ? 'border-l-red-500 bg-red-50/50 dark:bg-red-950/20'
    : isWarning
      ? 'border-l-amber-500 bg-amber-50/50 dark:bg-amber-950/20'
      : 'border-l-primary/20 bg-card hover:bg-accent/50';

  return (
    <Card
      className={`mb-3 transition-all hover:shadow-md overflow-hidden border-l-4 group ${cardStyle}`}
    >
      <div className="p-4 flex flex-col md:flex-row gap-4">
        {/* Left: Checkbox & Logic */}
        <div className="flex items-start gap-4 flex-1 min-w-0">
          <Checkbox
            onCheckedChange={(checked) =>
              onSelect(order.orderNumber, checked as boolean)
            }
            checked={isSelected}
            className="mt-1 shrink-0"
          />
          {/* Main Click Area */}
          <div
            className="flex-1 min-w-0"
            /* Removed generic onClick to prevent conflict with Name Link.
             Only expanding on row click if not clicking interactive elements.
             But simpler to let user click Chevron or non-interactive areas. */
          >
            {/* Header: Customer & Date & Urgency */}
            <div className="flex flex-wrap gap-2 text-sm mb-3 items-center">
              <Link
                href={`/dashboard/orders/${order.orderNumber.replace('#', '')}`}
                className="font-semibold text-foreground hover:underline decoration-primary underline-offset-4"
                onClick={(e) => e.stopPropagation()}
              >
                {order.customerName}
              </Link>
              <span className="text-muted-foreground">•</span>
              <button
                type="button"
                className="font-mono text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded cursor-pointer hover:text-foreground transition-colors"
                onClick={() => setIsExpanded(!isExpanded)}
              >
                {order.orderNumber}
              </button>
              <span className="text-muted-foreground">•</span>
              <span className="text-muted-foreground text-xs">
                {order.date}
              </span>

              {/* Urgency / Time Badge */}
              <div
                className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ml-2 ${
                  isUrgent
                    ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                    : isWarning
                      ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
                      : 'bg-muted text-muted-foreground'
                }`}
              >
                {isActionable && (isUrgent || isWarning) && (
                  <span className="font-semibold mr-1">{contextLabel}</span>
                )}
                {isUrgent ? (
                  <AlertTriangle className="w-3 h-3" />
                ) : isWarning ? (
                  <Clock className="w-3 h-3" />
                ) : (
                  <Clock className="w-3 h-3 opacity-50" />
                )}
                {timeDisplay}
              </div>

              <Badge
                variant="outline"
                className="ml-auto md:hidden text-[10px] h-5"
              >
                {order.paymentStatus}
              </Badge>
            </div>

            {/* Visual Row: Product Thumbnails */}
            <div className="flex items-center gap-2 mb-1">
              {visibleItems.length > 0 ? (
                visibleItems.map((item, i) => (
                  <div
                    key={i}
                    className="relative w-12 h-12 rounded-lg bg-muted border border-border flex items-center justify-center overflow-hidden shrink-0"
                  >
                    {item.image ? (
                      <img
                        src={item.image}
                        alt={item.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <Box className="w-5 h-5 text-muted-foreground/50" />
                    )}
                    {/* Quantity Badge if > 1 */}
                    {item.quantity > 1 && (
                      <div className="absolute -bottom-1 -right-1 bg-foreground text-background text-[10px] font-bold px-1 rounded-full shadow-sm">
                        x{item.quantity}
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <span className="text-sm text-muted-foreground italic">
                  No items found
                </span>
              )}

              {/* +X More Badge */}
              {remainingItems > 0 && (
                <div className="w-12 h-12 rounded-lg bg-muted/50 border border-dashed border-muted-foreground/30 flex items-center justify-center text-xs font-medium text-muted-foreground shrink-0">
                  +{remainingItems}
                </div>
              )}
            </div>

            <p className="text-xs text-muted-foreground truncate max-w-[90%] mt-1 group-hover:text-primary transition-colors">
              {itemCount} items: {order.items?.map((i) => i.name).join(', ')}
            </p>
          </div>
        </div>

        {/* Right: Metrics & Actions */}
        <div className="flex items-center justify-between md:justify-end gap-6 w-full md:w-auto border-t md:border-t-0 pt-3 md:pt-0 mt-2 md:mt-0">
          {/* Financials */}
          <div className="flex flex-col items-end min-w-[100px]">
            <span className="text-xs text-muted-foreground uppercase tracking-wider font-medium">
              Total
            </span>
            <span className="font-bold text-lg">
              {formatCurrency(order.total)}
            </span>
          </div>

          {/* Status Actions */}
          <div className="flex items-center gap-3">
            <div className="hidden md:block">
              <StatusBadge status={order.paymentStatus} type="payment" />
            </div>
            <StatusDropdown order={order} onStatusUpdate={onStatusUpdate} />
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsExpanded(!isExpanded)}
              className="shrink-0 h-8 w-8"
            >
              {isExpanded ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Expanded Details Pane */}
      {isExpanded && (
        <div className="bg-muted/10 border-t p-4 animate-in slide-in-from-top-2">
          <div className="grid gap-6 md:grid-cols-2">
            <div>
              <h5 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2">
                <Box className="w-3 h-3" /> Item Details
              </h5>
              <div className="space-y-2">
                {order.items?.map((item, idx) => (
                  <div
                    key={idx}
                    className="flex justify-between items-center text-sm p-2 hover:bg-muted/20 rounded"
                  >
                    <div className="flex gap-3 items-center overflow-hidden">
                      <div className="w-8 h-8 rounded bg-muted flex items-center justify-center shrink-0">
                        <Box className="w-4 h-4 text-muted-foreground/40" />
                      </div>
                      <div className="truncate">
                        <p className="font-medium truncate">{item.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {item.variant || 'Default Variant'}
                        </p>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-medium">x{item.quantity}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatCurrency(item.price)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h5 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2">
                <MapPin className="w-3 h-3" /> Fulfillment
              </h5>
              <div className="bg-background rounded-lg border p-4 text-sm space-y-3">
                <div className="flex justify-between border-b pb-2">
                  <span className="text-muted-foreground">Shipping Status</span>
                  <StatusBadge status={order.shippingStatus} type="shipping" />
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Provider</span>
                  <span className="font-medium">
                    {order.shipping_provider || 'Not assigned'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Tracking #</span>
                  <span className="font-mono bg-muted px-2 py-0.5 rounded text-xs">
                    {order.tracking_number || 'PENDING'}
                  </span>
                </div>
                <div className="pt-2">
                  <Link
                    href={`/dashboard/orders/${order.orderNumber.replace('#', '')}`}
                    className="w-full"
                  >
                    <Button variant="outline" size="sm" className="w-full">
                      Open Order Details
                    </Button>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
};

interface OrdersClientPageProps {
  initialOrders?: Order[];
  initialStats?: OrderStats;
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
  const [paymentFilter, setPaymentFilter] = useState('All');
  const [shippingFilter, setShippingFilter] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');
  const { toast } = useToast();
  const [orders, setOrders] = useState<Order[]>(initialOrders);
  const [showAlert, setShowAlert] = useState(true);
  const [selectedOrders, setSelectedOrders] = useState<Set<string>>(new Set());
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [stats, _setStats] = useState<OrderStats>(initialStats);
  const [statsLoading, _setStatsLoading] = useState(false);
  const [ordersError, _setOrdersError] = useState<string | null>(null);

  // Track first render/hydration
  const isHydrated = useRef(false);

  // Helper function to format status from DB to UI
  const _formatStatus = useCallback((status: string): string => {
    if (!status) return 'Pending';
    return status
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }, []);

  // Helper function to format status from UI to DB
  function formatStatusForDB(status: string): string {
    return status.toLowerCase().replace(' ', '_');
  }

  // Fetch orders from Server Action
  useEffect(() => {
    // Skip initial fetch if hydration occurred and filters are default
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
    isHydrated.current = true; // Mark as hydrated for subsequent updates

    if (!merchant?.id) return;

    const fetchOrders = async () => {
      setOrdersLoading(true);
      try {
        const fetchedOrders = await getOrders(merchant.id, {
          paymentStatus: paymentFilter,
          shippingStatus: shippingFilter,
          search: searchTerm,
        });
        setOrders(fetchedOrders);
      } catch (error) {
        console.error('Error fetching orders:', error);
        toast({
          title: 'Error Fetching Orders',
          description: 'Could not load orders. Please try again.',
          variant: 'destructive',
        });
      } finally {
        setOrdersLoading(false);
      }
    };

    // Debounce search
    const timer = setTimeout(
      () => {
        fetchOrders();
      },
      searchTerm ? 500 : 0
    );

    return () => clearTimeout(timer);
  }, [
    merchant?.id,
    paymentFilter,
    shippingFilter,
    searchTerm,
    toast,
    initialOrders.length,
  ]);

  // Fetch stats only if needed (e.g. periodically or on explicit refresh),
  // currently we assume passed stats are fresh enough for initial load.
  // We can leave stats static or refetch them.
  // For now let's only refetch stats if we know they might be stale OR explicitly requested.
  // But unlike original code, we WON'T fetch stats on plain filter changes (stats should be global).

  const handleUpdateStatus = async (
    orderNumber: string,
    newStatus: ShippingStatus
  ) => {
    // Find the order to get its database ID
    const order = orders.find((o) => o.orderNumber === orderNumber);
    if (!order || !order.id) {
      toast({
        title: 'Error',
        description: `Could not find order ${orderNumber} to update.`,
        variant: 'destructive',
      });
      return;
    }

    try {
      await apiPatch(`/api/orders/${order.id}`, {
        shipping_status: formatStatusForDB(newStatus),
      });

      // Update local state on success
      setOrders((currentOrders) =>
        currentOrders.map((o) =>
          o.orderNumber === orderNumber
            ? { ...o, shippingStatus: newStatus }
            : o
        )
      );

      toast({
        title: `Order ${newStatus}! 🎉`,
        description: `Order ${orderNumber} has been updated.`,
      });
    } catch (error) {
      console.error('Error updating order status:', error);
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
      currency: currency,
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

  const paymentStatuses: { name: PaymentStatus; icon: React.ElementType }[] = [
    { name: 'Paid', icon: CheckCircle },
    { name: 'Unpaid', icon: AlertCircleIcon },
    { name: 'Pending', icon: Hourglass },
    { name: 'Partially Paid', icon: CircleDot },
    { name: 'Refunded', icon: Undo2 },
  ];
  const shippingStatuses: { name: ShippingStatus; icon: React.ElementType }[] =
    [
      { name: 'Pending', icon: Clock },
      { name: 'Processing', icon: RefreshCw },
      { name: 'Shipped', icon: Truck },
      { name: 'Delivered', icon: PackageCheck },
      { name: 'Canceled', icon: X },
      { name: 'Returned', icon: RotateCcw },
    ];

  const handleSelectOrder = (orderNumber: string, isSelected: boolean) => {
    setSelectedOrders((prev) => {
      const newSelection = new Set(prev);
      if (isSelected) {
        newSelection.add(orderNumber);
      } else {
        newSelection.delete(orderNumber);
      }
      return newSelection;
    });
  };

  const handleSelectAll = (isSelected: boolean) => {
    if (isSelected) {
      setSelectedOrders(new Set(filteredOrders.map((o) => o.orderNumber)));
    } else {
      setSelectedOrders(new Set());
    }
  };

  if (authLoading || merchantLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <BagLoader size={32} />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full gap-4 relative">
      {/* Dynamic Background Elements */}
      <div className="absolute inset-0 w-full h-full bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/10 via-background to-background -z-10 pointer-events-none" />
      <div className="absolute top-0 left-0 w-full h-full bg-[url('/grid.svg')] bg-center [mask-image:linear-gradient(180deg,white,rgba(255,255,255,0))] -z-10 pointer-events-none opacity-50" />

      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-primary via-purple-500 to-blue-600 bg-clip-text text-transparent">
          Orders 📦
        </h1>
        <div className="flex items-center gap-2">
          <Button
            size="icon"
            variant="outline"
            className="h-11 w-11 min-w-[44px] min-h-[44px]"
          >
            <File className="h-4 w-4" />
            <span className="sr-only">Export</span>
          </Button>
          <Button
            size="icon"
            variant="outline"
            className="h-11 w-11 min-w-[44px] min-h-[44px]"
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

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card className="bg-blue-50/50 backdrop-blur-sm border-blue-200 transition-transform transform hover:scale-105">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-blue-800">
              Total Orders 🛍️
            </CardTitle>
            <ShoppingCart className="h-5 w-5 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-stat text-blue-900">
              {statsLoading ? (
                <BagLoader size={24} />
              ) : (
                stats.totalOrders.toLocaleString()
              )}
            </div>
          </CardContent>
        </Card>
        <Card className="bg-yellow-50/50 backdrop-blur-sm border-yellow-200 transition-transform transform hover:scale-105">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-yellow-800">
              Completed Orders ✅
            </CardTitle>
            <PackageCheck className="h-5 w-5 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-stat text-yellow-900">
              {statsLoading ? (
                <BagLoader size={24} />
              ) : (
                stats.completedOrders.toLocaleString()
              )}
            </div>
          </CardContent>
        </Card>
        <Card className="bg-blue-50/50 backdrop-blur-sm border-blue-200 transition-transform transform hover:scale-105">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-blue-800">
              Unpaid Orders 💸
            </CardTitle>
            <FileWarning className="h-5 w-5 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-stat text-blue-900">
              {statsLoading ? (
                <BagLoader size={24} />
              ) : (
                stats.unpaidOrders.toLocaleString()
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="relative">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          type="search"
          placeholder="Search orders..."
          className="w-full bg-background/50 backdrop-blur-sm pl-8"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {showAlert && stats.urgentOrders > 0 && (
        <Alert className="bg-yellow-50/80 backdrop-blur-sm border-yellow-200 text-yellow-900 relative">
          <AlertTriangle className="h-4 w-4 text-yellow-600" />
          <AlertTitle className="font-semibold">
            {statsLoading ? (
              <span className="flex items-center gap-2">
                <BagLoader size={16} />
                Checking orders...
              </span>
            ) : (
              `${stats.urgentOrders.toLocaleString()} order${stats.urgentOrders !== 1 ? 's' : ''} require${stats.urgentOrders === 1 ? 's' : ''} urgent attention.`
            )}
          </AlertTitle>
          <AlertDescription>
            <button
              type="button"
              className="font-medium underline bg-transparent border-none p-0 cursor-pointer text-inherit"
              onClick={() => {
                // TODO: Implement resolve action - filter to show only urgent orders
                toast({
                  title: 'Coming Soon',
                  description:
                    'This feature will filter to show only urgent orders.',
                });
              }}
            >
              Click to resolve
            </button>
          </AlertDescription>
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-2 right-2 h-6 w-6"
            onClick={() => setShowAlert(false)}
          >
            <BagLoader size={32} />
            <span className="sr-only">Dismiss</span>
          </Button>
        </Alert>
      )}

      <div className="flex gap-2 items-center text-sm text-muted-foreground">
        <div className="flex gap-2 items-center">
          <ListFilter className="h-4 w-4 text-blue-800" />
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              className="gap-1 border-blue-200 bg-blue-50/50 text-blue-800 hover:bg-blue-100 hover:text-blue-900"
            >
              <CreditCard className="h-4 w-4" />
              <span>
                {paymentFilter === 'All' ? 'Payment Status' : paymentFilter}
              </span>
              <ChevronDown className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuCheckboxItem
              checked={paymentFilter === 'All'}
              onCheckedChange={() => setPaymentFilter('All')}
              className="text-blue-800"
            >
              <List className="mr-2 h-4 w-4" />
              All
            </DropdownMenuCheckboxItem>
            <DropdownMenuSeparator />
            {paymentStatuses.map((status) => (
              <DropdownMenuCheckboxItem
                key={status.name}
                checked={paymentFilter === status.name}
                onCheckedChange={() => setPaymentFilter(status.name)}
                className="text-blue-800"
              >
                <status.icon className="mr-2 h-4 w-4" />
                {status.name}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              className="gap-1 border-blue-200 bg-blue-50/50 text-blue-800 hover:bg-blue-100 hover:text-blue-900"
            >
              <Truck className="h-4 w-4" />
              <span>
                {shippingFilter === 'All' ? 'Shipping Status' : shippingFilter}
              </span>
              <ChevronDown className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuCheckboxItem
              checked={shippingFilter === 'All'}
              onCheckedChange={() => setShippingFilter('All')}
              className="text-blue-800"
            >
              <List className="mr-2 h-4 w-4" />
              All
            </DropdownMenuCheckboxItem>
            <DropdownMenuSeparator />
            {shippingStatuses.map((status) => (
              <DropdownMenuCheckboxItem
                key={status.name}
                checked={shippingFilter === status.name}
                onCheckedChange={() => setShippingFilter(status.name)}
                className="text-blue-800"
              >
                <status.icon className="mr-2 h-4 w-4" />
                {status.name}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <Card className="glass bg-white/60 dark:bg-black/40 backdrop-blur-xl">
        <CardHeader className="px-4 pt-4 pb-0 border-b border-blue-200/50">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-bold">Recent Orders</h3>
            <div className="flex items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 gap-1"
                    disabled={selectedOrders.size === 0}
                  >
                    <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">
                      Bulk Actions
                    </span>
                    <ChevronDown className="h-3.5 w-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem>Mark as Paid</DropdownMenuItem>
                  <DropdownMenuItem>Mark as Unpaid</DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem>Fulfill Orders</DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="text-red-600">
                    Delete Selected
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
          <div className="flex items-center gap-2 py-4">
            <Checkbox
              id="select-all"
              onCheckedChange={(checked) => handleSelectAll(checked as boolean)}
              checked={
                selectedOrders.size > 0 &&
                selectedOrders.size === filteredOrders.length
              }
              aria-label="Select all orders"
            />
            <label htmlFor="select-all" className="text-sm font-medium">
              Select All
            </label>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="flex-1 overflow-y-auto space-y-3 pb-4 px-4">
            {ordersLoading ? (
              <div className="flex justify-center items-center h-64">
                <BagLoader size={32} />
              </div>
            ) : ordersError ? (
              <Alert variant="destructive" className="m-4">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Failed to Load Orders</AlertTitle>
                <AlertDescription>
                  {ordersError} Please try again.
                  <Button
                    variant="link"
                    className="p-0 h-auto ml-2"
                    onClick={() => window.location.reload()}
                  >
                    Refresh
                  </Button>
                </AlertDescription>
              </Alert>
            ) : (
              // New Collapsible Order Cards
              <div className="space-y-2">
                {filteredOrders.map((order) => (
                  <OrderCard
                    key={order.orderNumber}
                    order={order}
                    isSelected={selectedOrders.has(order.orderNumber)}
                    onSelect={handleSelectOrder}
                    onStatusUpdate={handleUpdateStatus}
                    formatCurrency={formatCurrency}
                  />
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
