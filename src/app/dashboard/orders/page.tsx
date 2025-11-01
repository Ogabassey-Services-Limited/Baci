
'use client';

import {
  File,
  PlusCircle,
  Package,
  CreditCard,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { useMerchant } from '@/hooks/use-merchant';
import { getCountryByCode } from '@/lib/countries';

// Mock data for recent orders
const recentOrders = [
  {
    orderNumber: '#06059',
    customerName: 'Balogun Christianah Olasubomi',
    productInfo: '*HP elitebook 840 G6 || 8th Gen || Intel Core i5...',
    total: 370000,
    status: 'Processing',
    payment: 'Paid',
    shipping: 'Unfulfilled',
    date: 'October 31, 2025 8:39 PM',
  },
  {
    orderNumber: '#06058-1',
    customerName: 'Ogugua Augustine',
    productInfo: 'iPhone 15 128gb WiFi Only (premium Used)',
    total: 575000,
    status: 'Processing',
    payment: 'Paid',
    shipping: 'Unfulfilled',
    date: 'October 31, 2025 8:33 PM',
  },
  {
    orderNumber: '#06056',
    customerName: 'Mbarihaus Ltd (c/o Caleb Uzuegbunam)',
    productInfo: 'MacBook Air 2020 M1 16gb 512gb (premium Used) +1 items',
    total: 930000,
    status: 'Shipped',
    payment: 'Paid',
    shipping: 'Fulfilled',
    date: 'October 30, 2025 1:57 PM',
  },
  {
    orderNumber: '#06055-1',
    customerName: 'Ezekiel oluawasegun oyesiji',
    productInfo: 'Samsung Fold 3 256gb (New)',
    total: 730000,
    status: 'Delivered',
    payment: 'Paid',
    shipping: 'Fulfilled',
    date: 'October 30, 2025 1:52 PM',
  },
  {
    orderNumber: '#06054',
    customerName: 'Kolawole Ogunleye',
    productInfo: '11" iPad 11th gen 128gb WiFi only (Brand New) +3 items',
    total: 660000,
    status: 'Pending',
    payment: 'Unpaid',
    shipping: 'Unfulfilled',
    date: 'October 29, 2025 10:46 PM',
  },
];

const StatusBadge = ({ status }: { status: string }) => {
    const variants: { [key: string]: 'default' | 'secondary' | 'destructive' | 'outline' } = {
        Paid: 'default',
        Unpaid: 'destructive',
        Processing: 'secondary',
        Shipped: 'secondary',
        Delivered: 'default',
        Fulfilled: 'default',
        Unfulfilled: 'outline',
        Pending: 'outline',
    };
    const variant = variants[status] || 'secondary';

    return <Badge variant={variant} className={cn({
        'bg-green-100 text-green-800 border-green-200': status === 'Paid' || status === 'Delivered' || status === 'Fulfilled',
        'bg-red-100 text-red-800 border-red-200': status === 'Unpaid',
        'bg-blue-100 text-blue-800 border-blue-200': status === 'Processing' || status === 'Shipped',
        'bg-yellow-100 text-yellow-800 border-yellow-200': status === 'Pending' || status === 'Unfulfilled',
    })}>{status}</Badge>;
};


import { cn } from '@/lib/utils';


export default function OrdersPage() {
  const { merchant, loading } = useMerchant();

  const formatCurrency = (amount: number) => {
    const country = merchant?.country ? getCountryByCode(merchant.country) : undefined;
    const locale = country ? `en-${country.code}` : 'en-US';
    const currency = country ? country.currency : 'USD';

    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currency,
    }).format(amount);
  };
  
  if (loading) {
    return <div className="flex items-center justify-center h-full"><Loader2 className="h-8 w-8 animate-spin" /></div>
  }


  return (
    <div className="grid flex-1 items-start gap-4 p-4 sm:px-6 sm:py-0 md:gap-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Orders</h1>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" className="h-8 gap-1">
            <File className="h-3.5 w-3.5" />
            <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">
              Export CSV
            </span>
          </Button>
          <Button size="sm" className="h-8 gap-1">
            <PlusCircle className="h-3.5 w-3.5" />
            <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">
              Create Order
            </span>
          </Button>
        </div>
      </div>
      
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Heads up!</AlertTitle>
        <AlertDescription>
          You have some orders that require your attention. Please attend to them.
        </AlertDescription>
      </Alert>

      <div className="grid gap-4 md:grid-cols-2 md:gap-8 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Orders</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">5,924</div>
          </CardContent>
        </Card>
        <Card className='bg-red-50/50 border-red-200'>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-red-800">Amount Owed</CardTitle>
            <CreditCard className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-900">
              {formatCurrency(474880134.52)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed Orders</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">2,766</div>
          </CardContent>
        </Card>
        <Card className='bg-yellow-50/50 border-yellow-200'>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-yellow-800">Unpaid Orders</CardTitle>
            <AlertCircle className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-900">417</div>
          </CardContent>
        </Card>
      </div>

       <Card>
        <CardHeader>
          <CardTitle>Recent Orders</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order & Name</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Payment</TableHead>
                <TableHead>Shipping</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recentOrders.map((order) => (
                <TableRow key={order.orderNumber}>
                  <TableCell>
                    <div className="font-medium">{order.orderNumber} &middot; {order.customerName}</div>
                    <div className="text-xs text-muted-foreground">{order.productInfo}</div>
                  </TableCell>
                  <TableCell className="text-right">{formatCurrency(order.total)}</TableCell>
                  <TableCell>
                    <StatusBadge status={order.status} />
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={order.payment} />
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={order.shipping} />
                  </TableCell>
                  <TableCell className="text-muted-foreground">{order.date}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
