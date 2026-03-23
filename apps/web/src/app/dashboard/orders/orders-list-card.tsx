'use client';

import { ChevronDown } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { BagLoader } from '@/components/ui/bag-loader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { Order, ShippingStatus } from './actions';
import { OrderCard } from './order-card';

export function OrdersListCard({
  filteredOrders,
  selectedOrders,
  ordersLoading,
  ordersError,
  onSelectAll,
  onSelectOrder,
  onStatusUpdate,
  onManageJumia,
  formatCurrency,
}: {
  filteredOrders: Order[];
  selectedOrders: Set<string>;
  ordersLoading: boolean;
  ordersError: string | null;
  onSelectAll: (isSelected: boolean) => void;
  onSelectOrder: (orderNumber: string, isSelected: boolean) => void;
  onStatusUpdate: (orderNumber: string, newStatus: ShippingStatus) => void;
  onManageJumia: (order: Order) => void;
  formatCurrency: (amount: number) => string;
}) {
  return (
    <Card className="glass border-slate-800/70 bg-white/60 backdrop-blur-xl dark:bg-black/40">
      <CardHeader className="border-b border-blue-200/50 px-4 pb-0 pt-4 dark:border-slate-800">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-bold">Recent Orders</h3>
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
        <div className="flex items-center gap-2 py-4">
          <Checkbox
            id="select-all"
            onCheckedChange={(checked) => onSelectAll(checked as boolean)}
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
        <div className="flex-1 space-y-3 overflow-y-auto px-4 pb-4">
          {ordersLoading ? (
            <div className="flex h-64 items-center justify-center">
              <BagLoader size={32} />
            </div>
          ) : ordersError ? (
            <Alert variant="destructive" className="m-4">
              <AlertTitle>Failed to Load Orders</AlertTitle>
              <AlertDescription>
                {ordersError} Please try again.
                <Button
                  variant="link"
                  className="ml-2 h-auto p-0"
                  onClick={() => window.location.reload()}
                >
                  Refresh
                </Button>
              </AlertDescription>
            </Alert>
          ) : (
            <div className="space-y-2">
              {filteredOrders.map((order) => (
                <OrderCard
                  key={order.orderNumber}
                  order={order}
                  isSelected={selectedOrders.has(order.orderNumber)}
                  onSelect={onSelectOrder}
                  onStatusUpdate={onStatusUpdate}
                  onManageJumia={onManageJumia}
                  formatCurrency={formatCurrency}
                />
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
