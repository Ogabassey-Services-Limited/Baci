'use client';

import {
  CheckCircle,
  ChevronDown,
  PackageCheck,
  RefreshCw,
  Truck,
  X,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import type { Order, ShippingStatus } from './actions';

const PAYMENT_VARIANTS: Record<string, string> = {
  Paid: 'bg-green-100 text-green-800 border-green-200',
  Unpaid: 'bg-red-100 text-red-800 border-red-200',
  Pending: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  'Partially Paid': 'bg-blue-100 text-blue-800 border-blue-200',
  Refunded: 'bg-gray-100 text-gray-800 border-gray-200',
};

const SHIPPING_VARIANTS: Record<string, string> = {
  Pending: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  Processing: 'bg-blue-100 text-blue-800 border-blue-200',
  Shipped: 'bg-indigo-100 text-indigo-800 border-indigo-200',
  Delivered: 'bg-green-100 text-green-800 border-green-200',
  Canceled: 'bg-red-100 text-red-800 border-red-200',
  Returned: 'bg-purple-100 text-purple-800 border-purple-200',
};

export function StatusBadge({
  status,
  type,
}: {
  status: string;
  type: 'payment' | 'shipping';
}) {
  const className =
    type === 'payment' ? PAYMENT_VARIANTS[status] : SHIPPING_VARIANTS[status];

  return (
    <Badge
      variant="outline"
      className={cn(
        'inline-flex items-center justify-center whitespace-nowrap rounded-full border px-3 text-sm font-medium capitalize',
        type === 'payment'
          ? 'h-9 min-w-[124px] px-3 text-sm'
          : 'h-7 min-w-[104px] px-3 text-xs',
        className
      )}
    >
      {status}
    </Badge>
  );
}

export function StatusDropdown({
  order,
  onStatusUpdate,
}: {
  order: Order;
  onStatusUpdate: (orderNumber: string, newStatus: ShippingStatus) => void;
}) {
  const { shippingStatus } = order;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="flex h-9 min-w-[160px] items-center justify-between gap-2 rounded-lg capitalize"
          data-no-card-toggle="true"
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
}
