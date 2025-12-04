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
import { notFound, useParams } from 'next/navigation';
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
import {
  initialOrders,
  type ShippingStatus,
  SourceIcon,
  StatusBadge,
} from '../page';
import FulfillmentDialog from './fulfillment-dialog';

// Mock type, replace with your actual Product type
type Product = (typeof products)[0];
type OrderItem = {
  id: string;
  name: string;
  quantity: number;
  price: number;
  product: Product;
};

export default function OrderDetailsPage() {
  const params = useParams();
  const orderId = params.orderId as string;
  const { toast } = useToast();

  // Find the order from the mock data
  const [order, setOrder] = useState(
    initialOrders.find((o) => o.orderNumber.replace('#', '') === orderId)
  );
  const [isFulfillmentDialogOpen, setIsFulfillmentDialogOpen] = useState(false);

  // For demonstration, creating a more detailed order item
  const orderItem: OrderItem = {
    id: 'item-1',
    name: products[0].name,
    quantity: 2,
    price: products[0].price,
    product: products[0],
  };

  const { merchant } = useMerchant();

  if (!order) {
    return notFound();
  }

  // This function checks if any item in the order requires fulfillment details.
  const doesOrderRequireFulfillment = () => {
    // In a real app, you would check all items in the order.
    // For this demo, we check our single mocked `orderItem`.
    return (
      orderItem.product.fulfillmentFields &&
      orderItem.product.fulfillmentFields.length > 0
    );
  };

  const handleUpdateStatus = (newStatus: ShippingStatus) => {
    // Check for fulfillment requirements before confirming the order
    if (newStatus === 'Processing' && doesOrderRequireFulfillment()) {
      setIsFulfillmentDialogOpen(true);
      return; // Stop further execution until fulfillment is handled
    }

    let newPaymentStatus = order.paymentStatus;
    if (order.shippingStatus === 'Pending' && newStatus === 'Processing') {
      newPaymentStatus = 'Paid';
    }
    setOrder((prevOrder) =>
      prevOrder
        ? {
            ...prevOrder,
            shippingStatus: newStatus,
            paymentStatus: newPaymentStatus,
          }
        : prevOrder
    );
    toast({
      title: `Order status updated to ${newStatus}`,
      description: `Payment status is now ${newPaymentStatus}`,
    });
  };

  // biome-ignore lint/suspicious/noExplicitAny: Legacy code using any
  const handleFulfillmentConfirm = async (fulfillmentData: any) => {
    console.log('Fulfillment data received:', fulfillmentData);
    // Here you would typically save the fulfillmentData to your backend.
    // For now, we'll just log it and then proceed with the status update.

    await new Promise((resolve) => setTimeout(resolve, 1000)); // Simulate API call

    handleUpdateStatus('Processing'); // This will now execute the status change
    setIsFulfillmentDialogOpen(false);
    toast({
      title: 'Fulfillment Details Saved!',
      description: 'The order is now being processed.',
    });
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

  const shippingFee = 0;
  const taxes = 0;
  const totalAmount = order.total + shippingFee + taxes;

  const getPrimaryAction = () => {
    switch (order.shippingStatus) {
      case 'Pending':
        return {
          text: 'Confirm Order',
          action: () => handleUpdateStatus('Processing'),
          icon: CheckCircle,
        };
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
          action: () => handleUpdateStatus('Canceled'),
          icon: XCircle,
          variant: 'outline' as const,
        };
      case 'Delivered':
      case 'Shipped':
        return {
          text: 'Process Return',
          action: () => handleUpdateStatus('Returned'),
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
      <FulfillmentDialog
        isOpen={isFulfillmentDialogOpen}
        onClose={() => setIsFulfillmentDialogOpen(false)}
        orderItems={[orderItem]} // Pass the real order items here
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
                <div className="flex items-center gap-4">
                  <Image
                    src={orderItem.product.image}
                    alt={orderItem.name}
                    width={64}
                    height={64}
                    className="rounded-md object-cover"
                  />
                  <div className="flex-1">
                    <p className="font-semibold">{orderItem.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {orderItem.quantity} x {formatCurrency(orderItem.price)}
                    </p>
                  </div>
                  <p className="font-semibold">
                    {formatCurrency(orderItem.price * orderItem.quantity)}
                  </p>
                </div>
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
