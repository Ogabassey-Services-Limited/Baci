
'use client';

import { useState, useEffect } from 'react';
import {
  File,
  PlusCircle,
  Search,
  RefreshCw,
  MoreVertical,
  AlertTriangle,
  ShoppingCart,
  Truck,
  PackageCheck,
  FileWarning,
  CheckCircle,
  X,
  ChevronDown,
  CreditCard,
  List,
  Hourglass,
  CircleDot,
  Undo2,
  AlertCircle as AlertCircleIcon,
  Clock,
  RotateCcw,
  ListFilter,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { useMerchant } from '@/hooks/use-merchant';
import { getCountryByCode } from '@/lib/countries';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem,
} from '@/components/ui/dropdown-menu';
import Link from 'next/link';
import { useToast } from '@/hooks/use-toast';
import { Checkbox } from '@/components/ui/checkbox';


// Mock data for recent orders
export const initialOrders = [
  {
    orderNumber: '#06092',
    customerName: 'Arinze Ihemedu',
    total: 138000,
    shippingStatus: 'Pending' as ShippingStatus,
    paymentStatus: 'Paid' as PaymentStatus,
    date: 'Nov 12, 2025',
    source: 'whatsapp',
  },
  {
    orderNumber: '#06091',
    customerName: 'Awolesi Aderemi',
    total: 482000,
    shippingStatus: 'Processing' as ShippingStatus,
    paymentStatus: 'Paid' as PaymentStatus,
    date: 'Nov 11, 2025',
    source: 'whatsapp',
  },
  {
    orderNumber: '#06090',
    customerName: 'Wema Bank PLC',
    total: 368000,
    shippingStatus: 'Pending' as ShippingStatus,
    paymentStatus: 'Unpaid' as PaymentStatus,
    date: 'Nov 11, 2025',
    source: 'whatsapp',
  },
  {
    orderNumber: '#06089',
    customerName: 'Jane Emmanuel Idaka',
    total: 356500,
    shippingStatus: 'Processing' as ShippingStatus,
    paymentStatus: 'Partially Paid' as PaymentStatus,
    date: 'Nov 11, 2025',
    source: 'instagram',
  },
  {
    orderNumber: '#06056',
    customerName: 'Mbarihaus Ltd',
    total: 930000,
    shippingStatus: 'Shipped' as ShippingStatus,
    paymentStatus: 'Paid' as PaymentStatus,
    date: 'Oct 30, 2025',
    source: 'other',
  },
  {
    orderNumber: '#06055',
    customerName: 'Ezekiel Oyesiji',
    total: 730000,
    shippingStatus: 'Delivered' as ShippingStatus,
    paymentStatus: 'Paid' as PaymentStatus,
    date: 'Oct 30, 2025',
    source: 'other',
  },
  {
    orderNumber: '#06054',
    customerName: 'Refund Guy',
    total: 10000,
    shippingStatus: 'Returned' as ShippingStatus,
    paymentStatus: 'Refunded' as PaymentStatus,
    date: 'Oct 29, 2025',
    source: 'other',
  },
];

export type ShippingStatus = 'Pending' | 'Processing' | 'Shipped' | 'Delivered' | 'Canceled' | 'Returned';
export type PaymentStatus = 'Paid' | 'Unpaid' | 'Pending' | 'Partially Paid' | 'Refunded';

export const StatusBadge = ({ status, type }: { status: string, type: 'payment' | 'shipping' }) => {
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

  const className = type === 'payment' ? paymentVariants[status] : shippingVariants[status];

  return <Badge variant={'outline'} className={cn('capitalize justify-center', className)}>{status}</Badge>;
};


const StatusDropdown = ({
  order,
  onStatusUpdate
}: {
  order: (typeof initialOrders)[0],
  onStatusUpdate: (orderNumber: string, newStatus: ShippingStatus) => void;
}) => {
  const { shippingStatus } = order;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="flex items-center gap-2 capitalize w-full justify-between">
          <StatusBadge status={shippingStatus} type="shipping" />
          <ChevronDown className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {shippingStatus === 'Pending' && (
          <DropdownMenuItem onSelect={() => onStatusUpdate(order.orderNumber, 'Processing')}>
            <CheckCircle className="mr-2 h-4 w-4" />
            <span>Confirm Order</span>
          </DropdownMenuItem>
        )}
        {shippingStatus === 'Processing' && (
          <DropdownMenuItem onSelect={() => onStatusUpdate(order.orderNumber, 'Shipped')}>
            <Truck className="mr-2 h-4 w-4" />
            <span>Ship Order</span>
          </DropdownMenuItem>
        )}
        {shippingStatus === 'Shipped' && (
          <DropdownMenuItem onSelect={() => onStatusUpdate(order.orderNumber, 'Delivered')}>
            <PackageCheck className="mr-2 h-4 w-4" />
            <span>Mark as Delivered</span>
          </DropdownMenuItem>
        )}
        {shippingStatus === 'Delivered' && (
          <DropdownMenuItem onSelect={() => onStatusUpdate(order.orderNumber, 'Returned')}>
            <RefreshCw className="mr-2 h-4 w-4" />
            <span>Process Return</span>
          </DropdownMenuItem>
        )}
        {(shippingStatus === 'Pending' || shippingStatus === 'Processing') && (
          <DropdownMenuItem onSelect={() => onStatusUpdate(order.orderNumber, 'Canceled')} className="text-red-600 focus:text-red-600 focus:bg-red-50">
            <X className="mr-2 h-4 w-4" />
            <span>Cancel Order</span>
          </DropdownMenuItem>
        )}
        {(shippingStatus === 'Canceled' || shippingStatus === 'Returned') && <DropdownMenuItem disabled>No actions available</DropdownMenuItem>}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};


export const SourceIcon = ({ source }: { source: string }) => {
  if (source === 'whatsapp') {
    return <svg className="h-6 w-6 text-green-500" viewBox="0 0 24 24" fill="currentColor"><path d="M12.04 2C6.58 2 2.13 6.45 2.13 12c0 1.74.45 3.38 1.26 4.84l-1.33 4.85 4.97-1.3c1.4.78 2.98 1.21 4.61 1.21h.01c5.46 0 9.91-4.45 9.91-9.91 0-5.46-4.45-9.91-9.91-9.91zM17.48 15.36c-.21.6-1.3 1.12-1.79 1.18-.49.06-1.04.06-1.57-.09-.53-.15-1.12-.34-1.84-1.1-1.02-1.08-1.7-2.35-1.93-2.76-.23-.41-.03-.63.18-.84.2-.21.41-.35.56-.53.15-.18.2-.3.15-.49-.06-.18-.53-1.27-.73-1.76s-.4-.41-.56-.41h-.48c-.18 0-.4.18-.56.41-.18.21-.69.69-.69 1.69s.71 1.97.81 2.12c.1.15 1.41 2.35 3.43 3.21.49.21.87.34 1.18.43.53.15.99.12 1.36-.03.44-.18.69-.81.79-1.53.1-.71.1-1.3-.03-1.48-.06-.18-.24-.27-.45-.45z" /></svg>;
  }
  if (source === 'instagram') {
    return <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line></svg>;
  }
  return <div className="h-6 w-6 rounded-full bg-gray-200" />;
}

export default function OrdersPage() {
  const { merchant, loading } = useMerchant();
  const [paymentFilter, setPaymentFilter] = useState('All');
  const [shippingFilter, setShippingFilter] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');
  const { toast } = useToast();
  const [orders, setOrders] = useState<(typeof initialOrders[0] & { id?: string })[]>([]);
  const [showAlert, setShowAlert] = useState(true);
  const [selectedOrders, setSelectedOrders] = useState<Set<string>>(new Set());
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [ordersError, setOrdersError] = useState<string | null>(null);

  // Fetch orders from API
  useEffect(() => {
    const fetchOrders = async () => {
      // **FIX:** Do not fetch until merchant data is loaded and available
      if (loading || !merchant) {
        return;
      }

      setOrdersLoading(true);
      setOrdersError(null);

      try {
        const params = new URLSearchParams();
        if (paymentFilter !== 'All') {
          params.append('payment_status', paymentFilter.toLowerCase().replace(' ', '_'));
        }
        if (shippingFilter !== 'All') {
          params.append('shipping_status', shippingFilter.toLowerCase());
        }
        if (searchTerm) {
          params.append('search', searchTerm);
        }

        const response = await fetch(`/api/orders?${params.toString()}`);

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to fetch orders');
        }

        const data = await response.json();

        // Transform API orders to match the UI format
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const transformedOrders = data.orders.map((order: any) => ({
          orderNumber: order.order_number,
          customerName: order.customer_name,
          total: parseFloat(order.total),
          shippingStatus: formatStatus(order.shipping_status) as ShippingStatus,
          paymentStatus: formatStatus(order.payment_status) as PaymentStatus,
          date: new Date(order.created_at).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
          }),
          source: order.source === 'online_store' ? 'other' : order.source,
          id: order.id, // Store the database ID for updates
        }));

        setOrders(transformedOrders);
      } catch (error) {
        console.error('Error fetching orders:', error);
        setOrdersError((error as Error).message);
        // Fall back to mock data on error, but log the error
        setOrders(initialOrders);
      } finally {
        setOrdersLoading(false);
      }
    };

    fetchOrders();
  }, [loading, merchant, paymentFilter, shippingFilter, searchTerm]);

  // Helper function to format status from DB to UI
  const formatStatus = (status: string): string => {
    if (!status) return 'Pending';
    return status
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  // Helper function to format status from UI to DB
  const formatStatusForDB = (status: string): string => {
    return status.toLowerCase().replace(' ', '_');
  };

  const handleUpdateStatus = async (orderNumber: string, newStatus: ShippingStatus) => {
    // Find the order to get its database ID
    const order = orders.find(o => o.orderNumber === orderNumber);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (!order || !(order as any).id) {
      // Fallback to local update if no ID (for mock data)
      setOrders(currentOrders =>
        currentOrders.map(order =>
          order.orderNumber === orderNumber
            ? { ...order, shippingStatus: newStatus }
            : order
        )
      );
      toast({
        title: `Order ${newStatus}! 🎉`,
        description: `Order ${orderNumber} has been updated. The customer will be notified.`,
      });
      return;
    }

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const response = await fetch(`/api/orders/${(order as any).id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          shipping_status: formatStatusForDB(newStatus),
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update order');
      }

      // Update local state on success
      setOrders(currentOrders =>
        currentOrders.map(order =>
          order.orderNumber === orderNumber
            ? { ...order, shippingStatus: newStatus }
            : order
        )
      );

      toast({
        title: `Order ${newStatus}! 🎉`,
        description: `Order ${orderNumber} has been updated. The customer will be notified.`,
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
    const country = merchant?.country ? getCountryByCode(merchant.country) : undefined;
    const locale = country ? `en-${country.code}` : 'en-US';
    const currency = country ? country.currency : 'USD';
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currency,
      currencyDisplay: 'symbol',
    }).format(amount);
  };

  const filteredOrders = orders.filter(order => {
    const paymentMatch = paymentFilter === 'All' || order.paymentStatus === paymentFilter;
    const shippingMatch = shippingFilter === 'All' || order.shippingStatus === shippingFilter;
    const searchMatch = searchTerm === '' ||
      order.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.orderNumber.toLowerCase().includes(searchTerm.toLowerCase());
    return paymentMatch && shippingMatch && searchMatch;
  });

  const paymentStatuses: { name: PaymentStatus, icon: React.ElementType }[] = [
    { name: 'Paid', icon: CheckCircle },
    { name: 'Unpaid', icon: AlertCircleIcon },
    { name: 'Pending', icon: Hourglass },
    { name: 'Partially Paid', icon: CircleDot },
    { name: 'Refunded', icon: Undo2 },
  ];
  const shippingStatuses: { name: ShippingStatus, icon: React.ElementType }[] = [
    { name: 'Pending', icon: Clock },
    { name: 'Processing', icon: RefreshCw },
    { name: 'Shipped', icon: Truck },
    { name: 'Delivered', icon: PackageCheck },
    { name: 'Canceled', icon: X },
    { name: 'Returned', icon: RotateCcw },
  ];

  const handleSelectOrder = (orderNumber: string, isSelected: boolean) => {
    setSelectedOrders(prev => {
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
      setSelectedOrders(new Set(filteredOrders.map(o => o.orderNumber)));
    } else {
      setSelectedOrders(new Set());
    }
  }


  if (loading) {
    return <div className="flex items-center justify-center h-full"><Loader2 className="h-8 w-8 animate-spin" /></div>
  }

  return (
    <div className="flex flex-col h-full gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Orders 📦</h1>
        <div className="flex items-center gap-2">
          <Button size="icon" variant="outline" className="h-9 w-9">
            <File className="h-4 w-4" />
            <span className="sr-only">Export</span>
          </Button>
          <Button size="icon" variant="outline" className="h-9 w-9">
            <RefreshCw className="h-4 w-4" />
            <span className="sr-only">Refresh</span>
          </Button>
          <Link href="/dashboard/orders/create">
            <Button size="sm" className="h-9 gap-1">
              <PlusCircle className="h-4 w-4" />
              <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">Create Order</span>
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card className="bg-blue-50 border-blue-200 transition-transform transform hover:scale-105">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-blue-800">Total Orders 🛍️</CardTitle>
            <ShoppingCart className="h-5 w-5 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-900">5,957</div>
          </CardContent>
        </Card>
        <Card className="bg-yellow-50 border-yellow-200 transition-transform transform hover:scale-105">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-yellow-800">Completed Orders ✅</CardTitle>
            <PackageCheck className="h-5 w-5 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-900">2,768</div>
          </CardContent>
        </Card>
        <Card className="bg-blue-50 border-blue-200 transition-transform transform hover:scale-105">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-blue-800">Unpaid Orders 💸</CardTitle>
            <FileWarning className="h-5 w-5 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-900">422</div>
          </CardContent>
        </Card>
      </div>


      <div className="relative">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          type="search"
          placeholder="Search orders..."
          className="w-full bg-background pl-8"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {showAlert && (
        <Alert className="bg-yellow-50 border-yellow-200 text-yellow-900 relative">
          <AlertTriangle className="h-4 w-4 text-yellow-600" />
          <AlertTitle className="font-semibold">1,557 orders require urgent attention. ⚠️</AlertTitle>
          <AlertDescription>
            <a href="#" className="font-medium underline">Click to resolve</a>
          </AlertDescription>
          <Button variant="ghost" size="icon" className="absolute top-2 right-2 h-6 w-6" onClick={() => setShowAlert(false)}>
            <X className="h-4 w-4 text-yellow-700" />
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
            <Button variant="outline" className="gap-1 border-blue-200 bg-blue-50/50 text-blue-800 hover:bg-blue-100 hover:text-blue-900">
              <CreditCard className="h-4 w-4" />
              <span>{paymentFilter === 'All' ? 'Payment Status' : paymentFilter}</span>
              <ChevronDown className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuCheckboxItem checked={paymentFilter === 'All'} onCheckedChange={() => setPaymentFilter('All')} className="text-blue-800">
              <List className="mr-2 h-4 w-4" />
              All
            </DropdownMenuCheckboxItem>
            <DropdownMenuSeparator />
            {paymentStatuses.map(status => (
              <DropdownMenuCheckboxItem key={status.name} checked={paymentFilter === status.name} onCheckedChange={() => setPaymentFilter(status.name)} className="text-blue-800">
                <status.icon className="mr-2 h-4 w-4" />
                {status.name}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="gap-1 border-blue-200 bg-blue-50/50 text-blue-800 hover:bg-blue-100 hover:text-blue-900">
              <Truck className="h-4 w-4" />
              <span>{shippingFilter === 'All' ? 'Shipping Status' : shippingFilter}</span>
              <ChevronDown className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuCheckboxItem checked={shippingFilter === 'All'} onCheckedChange={() => setShippingFilter('All')} className="text-blue-800">
              <List className="mr-2 h-4 w-4" />
              All
            </DropdownMenuCheckboxItem>
            <DropdownMenuSeparator />
            {shippingStatuses.map(status => (
              <DropdownMenuCheckboxItem key={status.name} checked={shippingFilter === status.name} onCheckedChange={() => setShippingFilter(status.name)} className="text-blue-800">
                <status.icon className="mr-2 h-4 w-4" />
                {status.name}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <Card>
        <CardHeader className="px-4 pt-4 pb-0 border-b border-blue-200">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-bold">Recent Orders</h3>
            <div className="flex items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-8 gap-1" disabled={selectedOrders.size === 0}>
                    <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">Bulk Actions</span>
                    <ChevronDown className="h-3.5 w-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem>Mark as Paid</DropdownMenuItem>
                  <DropdownMenuItem>Mark as Unpaid</DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem>Fulfill Orders</DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="text-red-600">Delete Selected</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
          <div className="flex items-center gap-2 py-4">
            <Checkbox
              id="select-all"
              onCheckedChange={(checked) => handleSelectAll(checked as boolean)}
              checked={selectedOrders.size > 0 && selectedOrders.size === filteredOrders.length}
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
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : ordersError ? (
              <Alert variant="destructive" className="m-4">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Failed to Load Orders</AlertTitle>
                <AlertDescription>
                  {ordersError} Please try again.
                  <Button variant="link" className="p-0 h-auto ml-2" onClick={() => window.location.reload()}>Refresh</Button>
                </AlertDescription>
              </Alert>
            ) : filteredOrders.map((order) => (
              <Card key={order.orderNumber} className="transition-shadow hover:shadow-md">
                <CardContent className="p-4 flex items-center gap-4">
                  <Checkbox
                    onCheckedChange={(checked) => handleSelectOrder(order.orderNumber, checked as boolean)}
                    checked={selectedOrders.has(order.orderNumber)}
                    aria-label={`Select order ${order.orderNumber}`}
                    className="mt-1"
                  />
                  <div className="flex-shrink-0 mt-1">
                    <SourceIcon source={order.source} />
                  </div>
                  <div className="flex-1">
                    <Link href={`/dashboard/orders/${order.orderNumber.replace('#', '')}`} className="font-semibold hover:underline">
                      {order.customerName}
                    </Link>
                    <p className="text-sm text-muted-foreground">{order.orderNumber} &middot; {order.date}</p>
                  </div>
                  <div className="flex items-center justify-end gap-4 text-sm w-[280px]">
                    <div className="w-[110px] text-center">
                      <StatusBadge status={order.paymentStatus} type="payment" />
                    </div>
                    <div className="w-[140px]">
                      <StatusDropdown
                        order={order}
                        onStatusUpdate={handleUpdateStatus}
                      />
                    </div>
                  </div>
                  <div className="text-right w-28">
                    <p className="font-bold text-lg">{formatCurrency(order.total)}</p>
                  </div>
                  <div className="flex-shrink-0 -mr-2">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem>View Details</DropdownMenuItem>
                        <DropdownMenuItem>Contact Customer</DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem>Print Invoice</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
