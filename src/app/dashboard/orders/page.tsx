
'use client';

import { useState } from 'react';
import {
  File,
  PlusCircle,
  Search,
  Filter,
  RefreshCw,
  MoreVertical,
  AlertTriangle,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
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
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';


// Mock data for recent orders
const recentOrders = [
  {
    orderNumber: '#06092',
    customerName: 'Arinze Ihemedu',
    total: 138000,
    status: 'Processing',
    payment: 'Paid',
    shipping: 'Unfulfilled',
    date: 'Nov 12, 2025',
    source: 'whatsapp',
  },
  {
    orderNumber: '#06091',
    customerName: 'Awolesi Aderemi',
    total: 482000,
    status: 'Processing',
    payment: 'Paid',
    shipping: 'Unfulfilled',
    date: 'Nov 11, 2025',
    source: 'whatsapp',
  },
  {
    orderNumber: '#06090',
    customerName: 'Wema Bank PLC',
    total: 368000,
    status: 'Pending',
    payment: 'Unpaid',
    shipping: 'Unfulfilled',
    date: 'Nov 11, 2025',
    source: 'whatsapp',
  },
  {
    orderNumber: '#06089',
    customerName: 'Jane Emmanuel Idaka',
    total: 356500,
    status: 'Processing',
    payment: 'Paid',
    shipping: 'Unfulfilled',
    date: 'Nov 11, 2025',
    source: 'instagram',
  },
  {
    orderNumber: '#06056',
    customerName: 'Mbarihaus Ltd',
    total: 930000,
    status: 'Shipped',
    payment: 'Paid',
    shipping: 'Fulfilled',
    date: 'Oct 30, 2025',
    source: 'other',
  },
  {
    orderNumber: '#06055',
    customerName: 'Ezekiel Oyesiji',
    total: 730000,
    status: 'Delivered',
    payment: 'Paid',
    shipping: 'Fulfilled',
    date: 'Oct 30, 2025',
    source: 'other',
  },
];

const StatusBadge = ({ status }: { status: string }) => {
    const variants: { [key: string]: 'default' | 'secondary' | 'destructive' | 'outline' } = {
        Paid: 'default',
        Unpaid: 'destructive',
        Pending: 'outline',
        Unfulfilled: 'outline',
        Fulfilled: 'default',
    };
    const variant = variants[status] || 'secondary';

    return <Badge variant={variant} className={cn({
        'bg-green-100 text-green-800 border-green-200': status === 'Paid' || status === 'Fulfilled' || status === 'Delivered',
        'bg-red-100 text-red-800 border-red-200': status === 'Unpaid',
        'bg-yellow-100 text-yellow-800 border-yellow-200': status === 'Pending' || status === 'Unfulfilled',
        'bg-blue-100 text-blue-800 border-blue-200': status === 'Processing' || status === 'Shipped',
    })}>{status}</Badge>;
};

const SourceIcon = ({ source }: { source: string }) => {
    if (source === 'whatsapp') {
        return <svg className="h-6 w-6 text-green-500" viewBox="0 0 24 24" fill="currentColor"><path d="M12.04 2C6.58 2 2.13 6.45 2.13 12c0 1.74.45 3.38 1.26 4.84l-1.33 4.85 4.97-1.3c1.4.78 2.98 1.21 4.61 1.21h.01c5.46 0 9.91-4.45 9.91-9.91 0-5.46-4.45-9.91-9.91-9.91zM17.48 15.36c-.21.6-1.3 1.12-1.79 1.18-.49.06-1.04.06-1.57-.09-.53-.15-1.12-.34-1.84-1.1-1.02-1.08-1.7-2.35-1.93-2.76-.23-.41-.03-.63.18-.84.2-.21.41-.35.56-.53.15-.18.2-.3.15-.49-.06-.18-.53-1.27-.73-1.76s-.4-.41-.56-.41h-.48c-.18 0-.4.18-.56.41-.18.21-.69.69-.69 1.69s.71 1.97.81 2.12c.1.15 1.41 2.35 3.43 3.21.49.21.87.34 1.18.43.53.15.99.12 1.36-.03.44-.18.69-.81.79-1.53.1-.71.1-1.3-.03-1.48-.06-.18-.24-.27-.45-.45z"/></svg>;
    }
     if (source === 'instagram') {
        return <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line></svg>;
    }
    return <div className="h-6 w-6 rounded-full bg-gray-200" />;
}

export default function OrdersPage() {
  const { merchant, loading } = useMerchant();
  const [filter, setFilter] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');

  const formatCurrency = (amount: number) => {
    const country = merchant?.country ? getCountryByCode(merchant.country) : undefined;
    const locale = country ? `en-${country.code}` : 'en-US';
    const currency = country ? country.currency : 'NGN';
    return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(amount);
  };
  
  const filteredOrders = recentOrders.filter(order => {
    const filterMatch = filter === 'All' || order.payment === filter || order.status === filter;
    const searchMatch = searchTerm === '' || 
                        order.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        order.orderNumber.toLowerCase().includes(searchTerm.toLowerCase());
    return filterMatch && searchMatch;
  });

  const filterButtons = ['All', 'Paid', 'Unpaid', 'Pending'];

  if (loading) {
    return <div className="flex items-center justify-center h-full"><Loader2 className="h-8 w-8 animate-spin" /></div>
  }

  return (
    <div className="flex flex-col h-full gap-4">
        <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold">Orders</h1>
            <div className="flex items-center gap-2">
            <Button size="icon" variant="outline" className="h-9 w-9">
                <Filter className="h-4 w-4" />
                <span className="sr-only">Filter</span>
            </Button>
            <Button size="icon" variant="outline" className="h-9 w-9">
                <RefreshCw className="h-4 w-4" />
                <span className="sr-only">Refresh</span>
            </Button>
            <Button size="icon" className="h-9 w-9">
                <PlusCircle className="h-4 w-4" />
                <span className="sr-only">Create Order</span>
            </Button>
            </div>
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

        <Alert className="bg-yellow-50 border-yellow-200 text-yellow-900">
            <AlertTriangle className="h-4 w-4 text-yellow-600" />
            <AlertTitle className="font-semibold">1,557 orders require urgent attention.</AlertTitle>
            <AlertDescription>
              <a href="#" className="font-medium underline">Click to resolve</a>
            </AlertDescription>
        </Alert>
        
        <div className="flex gap-2">
            {filterButtons.map(btnFilter => (
                <Button 
                    key={btnFilter}
                    variant={filter === btnFilter ? 'default' : 'outline'}
                    onClick={() => setFilter(btnFilter)}
                    className={cn(filter === btnFilter && 'bg-green-600 hover:bg-green-700 text-white')}
                >
                    {btnFilter}
                </Button>
            ))}
        </div>

        <div className="flex-1 overflow-y-auto space-y-3 pb-4">
            {filteredOrders.map((order) => (
                <Card key={order.orderNumber}>
                    <CardContent className="p-4 flex items-start gap-4">
                         <div className="flex-shrink-0 mt-1">
                             <SourceIcon source={order.source} />
                         </div>
                         <div className="flex-1">
                             <p className="font-semibold">{order.customerName}</p>
                             <p className="text-sm text-muted-foreground">{order.orderNumber} &middot; {order.date}</p>
                             <div className="mt-2 flex gap-2">
                                <StatusBadge status={order.payment} />
                                <StatusBadge status={order.shipping} />
                            </div>
                         </div>
                         <div className="text-right">
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
                                    <DropdownMenuItem>Print Invoice</DropdownMenuItem>
                                </DropdownMenuContent>
                             </DropdownMenu>
                         </div>
                    </CardContent>
                </Card>
            ))}
        </div>
    </div>
  );
}

    