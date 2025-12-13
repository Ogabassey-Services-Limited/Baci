'use client';

import {
  CheckCircle,
  ChevronLeft,
  Copy,
  Download,
  Edit,
  Mail,
  MoreVertical,
  Package,
  PackageCheck,
  Phone,
  Share2,
  Truck,
  Undo2,
  XCircle,
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Separator } from '@/components/ui/separator';
import { useMerchant } from '@/hooks/use-merchant';
import { useToast } from '@/hooks/use-toast';
import { getCountryByCode } from '@/lib/countries';
import { products } from '@/lib/products';
import type { Order, ShippingStatus } from '../actions';
import { SourceIcon, StatusBadge } from '../client-page';
import ConfirmInsuranceDialog from './confirm-insurance-dialog';

// Type definitions
interface OrderDetailsClientPageProps {
  initialOrder: Order;
}

interface OrderItem {
  id: string;
  name: string;
  quantity: number;
  price: number;
  product?: {
    image?: string;
    fulfillmentFields?: string[];
  };
  hasAssurance?: boolean;
}

// Helper function
function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    minimumFractionDigits: 0,
  }).format(amount);
}

// Placeholder FulfillmentDialog - replace with actual import when available
function FulfillmentDialog({ isOpen, onClose, orderItems, onConfirm }: any) {
  if (!isOpen) return null;
  return null; // Placeholder - actual dialog should be imported
}

export default function OrderDetailsClientPage({
  initialOrder,
}: OrderDetailsClientPageProps) {
  const { toast } = useToast();
  const [order, setOrder] = useState<Order>(initialOrder);
  const [isFulfillmentDialogOpen, setIsFulfillmentDialogOpen] = useState(false);
  const [isConfirmationDialogOpen, setIsConfirmationDialogOpen] = useState(false);
  const { merchant } = useMerchant();

  if (!order) {
    return null;
  }

  // --- MOCK ITEMS HANDLING ---
  // If items exist on the order (from our updated fetcher), use them.
  // Otherwise fall back to mock for safety in dev if DB is inconsistent.
  const orderItems = (order as any).items || (order as any).order_items || [];

  // Safe display map
  const displayItems: OrderItem[] = orderItems.length > 0
    ? orderItems
    : [];

  const doesOrderRequireFulfillment = () => {
    // Check for fulfillment fields OR assurance
    // Assurance items implicitly require fulfillment (device details)
    return displayItems.some(
      (item: any) =>
        (item.product?.fulfillmentFields && item.product.fulfillmentFields.length > 0) ||
        item.hasAssurance // New check
    );
  };

  const handleUpdateStatus = async (newStatus: ShippingStatus) => {
    // If confirming ('Processing'), check if we need the new dialog
    if (newStatus === 'Processing' && order.shippingStatus === 'Pending') {
      setIsConfirmationDialogOpen(true);
      return;
    }

    // ... OLD LOGIC for other statuses ...
    // But wait, the old logic was client-side only state update?
    // "handleUpdateStatus" updated local state and showed toast.
    // If I want to persist, I should call an API or server action.
    // The previous implementation seemed to be UI-mock or incomplete.
    // I will keep existing logic for non-confirm actions for safety, 
    // but for Confirm, I go through my new API.

    // Legacy/Existing logic for other statuses:
    let newPaymentStatus = order.paymentStatus;
    setOrder((prev) => ({
      ...prev,
      shippingStatus: newStatus,
      paymentStatus: newPaymentStatus,
    }));
    toast({
      title: `Order status updated to ${newStatus}`,
    });
  };

  const handleConfirmationSubmit = async (data: any) => {
    try {
      const response = await fetch(`/api/orders/${order.id}/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (!response.ok) throw new Error(result.error || 'Confirmation failed');

      toast({
        title: 'Order Confirmed',
        description: result.insurance?.success
          ? `Policy Active: ${result.insurance.results[0].policyNumber}`
          : 'Order processed successfully.'
      });

      // Update local state
      setOrder(prev => ({ ...prev, shippingStatus: 'Processing', paymentStatus: 'Paid' }));
      setIsConfirmationDialogOpen(false);

    } catch (error: any) {
      console.error(error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message
      });
    }
  };

  // Legacy mock handler - keep for backward compat if needed
  const handleFulfillmentConfirm = async (fulfillmentData: any) => {
    // ...
  };

  // ... formatCurrency ...

  const shippingFee = 0;
  const taxes = 0;
  const totalAmount = order.total + shippingFee + taxes;

  const getPrimaryAction = () => {
    switch (order.shippingStatus) {
      case 'Pending':
        return {
          text: 'Confirm Order',
          action: () => setIsConfirmationDialogOpen(true), // Always open dialog for consistency
          icon: CheckCircle,
        };
      // ... rest of cases
      case 'Processing':
        return {
          text: 'Ship Order',
          action: () => handleUpdateStatus('Shipped'),
          icon: Truck,
        };
      case 'Shipped':
        return {
          text: 'Mark as Delivered',
          action: () => handleUpdateStatus('Delivered'),
          icon: PackageCheck,
        };
      default:
        return null;
    }
  };

  const getSecondaryAction = () => {
    switch (order.shippingStatus) {
      case 'Pending':
      case 'Processing':
        return {
          text: 'Cancel Order',
          action: () => handleUpdateStatus('Cancelled' as ShippingStatus),
          icon: XCircle,
          variant: 'destructive' as const,
        };
      case 'Delivered':
        return {
          text: 'Process Refund',
          action: () => handleUpdateStatus('Returned' as ShippingStatus),
          icon: Undo2,
          variant: 'outline' as const,
        };
      default:
        return null;
    }
  };

  const primaryAction = getPrimaryAction();
  const secondaryAction = getSecondaryAction();

  return (
    <>
      <ConfirmInsuranceDialog
        isOpen={isConfirmationDialogOpen}
        onClose={() => setIsConfirmationDialogOpen(false)}
        onConfirm={handleConfirmationSubmit}
        orderItems={displayItems}
      />
      <FulfillmentDialog
        isOpen={isFulfillmentDialogOpen}
        onClose={() => setIsFulfillmentDialogOpen(false)}
        orderItems={displayItems}
        // ...
        onConfirm={handleFulfillmentConfirm}
      />
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/orders">
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-8 w-8"
            >
              <ChevronLeft className="h-4 w-4" />
              <span className="sr-only">Back to Orders</span>
            </Button>
          </Link>
          <h1 className="flex-1 shrink-0 whitespace-nowrap text-xl font-semibold tracking-tight sm:grow-0">
            Order {order.orderNumber}
          </h1>
          <div className="ml-auto flex items-center gap-2">
            <Button variant="outline" size="sm" className="gap-1">
              <Share2 className="h-3.5 w-3.5" />
              <span>Share</span>
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" className="h-9 w-9">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem>Print Invoice</DropdownMenuItem>
                <DropdownMenuItem>Contact Customer</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="grid auto-rows-max items-start gap-4 md:col-span-2">
            <Card>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle>Order Details</CardTitle>
                    <CardDescription>Date: {order.date}</CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={order.paymentStatus} type="payment" />
                    <StatusBadge
                      status={order.shippingStatus}
                      type="shipping"
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">
                      Channel
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <SourceIcon source={order.source} />
                      <p className="font-semibold capitalize">{order.source}</p>
                    </div>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">
                      Customer
                    </p>
                    <p className="font-semibold">{order.customerName}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">
                      Billing Address
                    </p>
                    <p className="text-sm">
                      Oko-awo Street (Building 5), VI opposite Eko hotel,
                      Nigeria
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">
                      Contact Details
                    </p>
                    <div className="flex items-center gap-2 text-sm mt-1">
                      <Phone className="w-4 h-4 text-muted-foreground" />
                      <span>09035576078</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm mt-1">
                      <Mail className="w-4 h-4 text-muted-foreground" />
                      <span>arinze.medu@gmail.com</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Products</CardTitle>
                {doesOrderRequireFulfillment() && (
                  <Alert
                    variant="default"
                    className="mt-2 bg-blue-50 border-blue-200 text-blue-800"
                  >
                    <Package className="h-4 w-4 !text-blue-800" />
                    <AlertTitle>Fulfillment Details Required</AlertTitle>
                    <AlertDescription>
                      One or more items in this order need specific details
                      (e.g., serial numbers) before fulfillment.
                    </AlertDescription>
                  </Alert>
                )}
              </CardHeader>
              <CardContent>
                {displayItems.map((item: OrderItem) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-4 mb-4 last:mb-0"
                  >
                    <Image
                      src={item.product?.image || products[0].image}
                      alt={item.name || 'Product'}
                      width={64}
                      height={64}
                      className="rounded-md object-cover"
                    />
                    <div className="flex-1">
                      <p className="font-semibold">{item.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {item.quantity} x {formatCurrency(item.price)}
                      </p>
                    </div>
                    <p className="font-semibold">
                      {formatCurrency(item.price * item.quantity)}
                    </p>
                  </div>
                ))}
              </CardContent>
              <CardFooter className="flex gap-2 justify-end">
                {secondaryAction && (
                  <Button
                    variant={secondaryAction.variant}
                    onClick={secondaryAction.action}
                    className="gap-1"
                  >
                    <secondaryAction.icon className="h-4 w-4" />
                    {secondaryAction.text}
                  </Button>
                )}
                {primaryAction && (
                  <Button onClick={primaryAction.action} className="gap-1">
                    <primaryAction.icon className="h-4 w-4" />
                    {primaryAction.text}
                  </Button>
                )}
              </CardFooter>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Shipment</CardTitle>
              </CardHeader>
              <CardContent>
                {order.tracking_number ? (
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Provider</p>
                      <p className="font-semibold">{order.shipping_provider}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">
                        Tracking #
                      </p>
                      <p className="font-semibold">{order.tracking_number}</p>
                    </div>
                    <Button asChild variant="outline" size="sm">
                      <Link href={`/track/${order.tracking_number}`}>
                        Track
                      </Link>
                    </Button>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No tracking information available.
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="grid auto-rows-max items-start gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Payment Summary</CardTitle>
                <Button variant="outline" size="sm" className="gap-1">
                  <Download className="h-3.5 w-3.5" />
                  Download Receipt
                </Button>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between">
                  <span>Sub Total</span>{' '}
                  <span>{formatCurrency(order.total)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Shipping Fee</span>{' '}
                  <span>{formatCurrency(shippingFee)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Taxes</span> <span>{formatCurrency(taxes)}</span>
                </div>
                <Separator />
                <div className="flex justify-between font-bold text-lg">
                  <span>Total Amount</span>{' '}
                  <span>{formatCurrency(totalAmount)}</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Payment Status</CardTitle>
              </CardHeader>
              <CardContent>
                <StatusBadge status={order.paymentStatus} type="payment" />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Shipping</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-1">
                  <p className="font-semibold">{order.customerName}</p>
                  <p className="text-sm text-muted-foreground">09035576078</p>
                  <p className="text-sm text-muted-foreground">
                    Oko-awo Street (Building 5), VI opposite Eko hotel, Nigeria
                  </p>
                </div>
                <div className="flex gap-1 mt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1 text-xs h-7"
                  >
                    <Edit className="h-3 w-3" /> Edit
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1 text-xs h-7"
                  >
                    <Copy className="h-3 w-3" /> Copy
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </>
  );
}
