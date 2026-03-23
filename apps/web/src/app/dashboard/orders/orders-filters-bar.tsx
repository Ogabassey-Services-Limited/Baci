'use client';

import {
  AlertCircle as AlertCircleIcon,
  CheckCircle,
  ChevronDown,
  CircleDot,
  Clock,
  CreditCard,
  Hourglass,
  List,
  ListFilter,
  RefreshCw,
  RotateCcw,
  Search,
  Truck,
  Undo2,
  X,
} from 'lucide-react';
import type { ElementType } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import type { PaymentStatus, ShippingStatus } from './actions';

const PAYMENT_STATUSES: { name: PaymentStatus; icon: ElementType }[] = [
  { name: 'Paid', icon: CheckCircle },
  { name: 'Unpaid', icon: AlertCircleIcon },
  { name: 'Pending', icon: Hourglass },
  { name: 'Partially Paid', icon: CircleDot },
  { name: 'Refunded', icon: Undo2 },
];

const SHIPPING_STATUSES: { name: ShippingStatus; icon: ElementType }[] = [
  { name: 'Pending', icon: Clock },
  { name: 'Processing', icon: RefreshCw },
  { name: 'Shipped', icon: Truck },
  { name: 'Delivered', icon: CheckCircle },
  { name: 'Canceled', icon: X },
  { name: 'Returned', icon: RotateCcw },
];

export function OrdersFiltersBar({
  searchTerm,
  onSearchChange,
  paymentFilter,
  onPaymentFilterChange,
  shippingFilter,
  onShippingFilterChange,
}: {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  paymentFilter: string;
  onPaymentFilterChange: (value: string) => void;
  shippingFilter: string;
  onShippingFilterChange: (value: string) => void;
}) {
  return (
    <>
      <div className="relative">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          type="search"
          placeholder="Search orders..."
          aria-label="Search orders"
          className="w-full bg-background/50 pl-8 backdrop-blur-sm"
          value={searchTerm}
          onChange={(event) => onSearchChange(event.target.value)}
        />
      </div>

      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
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
              onCheckedChange={() => onPaymentFilterChange('All')}
              className="text-blue-800"
            >
              <List className="mr-2 h-4 w-4" />
              All
            </DropdownMenuCheckboxItem>
            <DropdownMenuSeparator />
            {PAYMENT_STATUSES.map((status) => (
              <DropdownMenuCheckboxItem
                key={status.name}
                checked={paymentFilter === status.name}
                onCheckedChange={() => onPaymentFilterChange(status.name)}
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
              onCheckedChange={() => onShippingFilterChange('All')}
              className="text-blue-800"
            >
              <List className="mr-2 h-4 w-4" />
              All
            </DropdownMenuCheckboxItem>
            <DropdownMenuSeparator />
            {SHIPPING_STATUSES.map((status) => (
              <DropdownMenuCheckboxItem
                key={status.name}
                checked={shippingFilter === status.name}
                onCheckedChange={() => onShippingFilterChange(status.name)}
                className="text-blue-800"
              >
                <status.icon className="mr-2 h-4 w-4" />
                {status.name}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </>
  );
}
