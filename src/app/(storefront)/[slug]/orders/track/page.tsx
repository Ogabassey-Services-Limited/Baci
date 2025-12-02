'use client';

import {
  CheckCircle2,
  Clock,
  CreditCard,
  ExternalLink,
  Mail,
  MapPin,
  Package,
  Phone,
  Search,
  Truck,
  XCircle,
} from 'lucide-react';
import Image from 'next/image';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';

interface TimelineEvent {
  status: 'completed' | 'current' | 'pending' | 'failed';
  title: string;
  description: string;
  timestamp: string;
  icon:
    | 'order'
    | 'payment'
    | 'processing'
    | 'shipped'
    | 'delivered'
    | 'cancelled';
}

interface OrderItem {
  id: string;
  product_name: string;
  variant_name?: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  product_image?: string;
}

interface OrderData {
  order: {
    id: string;
    order_number: string;
    status: string;
    payment_status: string;
    created_at: string;
    subtotal: number;
    shipping_cost: number;
    discount_amount: number;
    total: number;
    currency: string;
  };
  customer: {
    name: string;
    email: string;
    phone: string;
  };
  shipping_address: {
    address: string;
    city: string;
    state: string;
    country: string;
  };
  items: OrderItem[];
  timeline: TimelineEvent[];
  shipping_tracking: {
    provider: string;
    tracking_number: string;
    tracking_url: string;
  } | null;
  estimated_delivery: {
    min: string;
    max: string;
  } | null;
  merchant: {
    name: string;
    logo?: string;
    support_email?: string;
    support_phone?: string;
  };
}

const iconMap = {
  order: Package,
  payment: CreditCard,
  processing: Clock,
  shipped: Truck,
  delivered: CheckCircle2,
  cancelled: XCircle,
};

export default function OrderTrackPage() {
  const [orderNumber, setOrderNumber] = useState('');
  const [email, setEmail] = useState('');
  const [orderData, setOrderData] = useState<OrderData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleTrackOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        order_number: orderNumber,
        email: email,
      });

      const response = await fetch(`/api/storefront/orders/track?${params}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to find order');
      }

      setOrderData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      setOrderData(null);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleDateString('en-NG', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatCurrency = (amount: number, currency: string = 'NGN') => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency,
    }).format(amount);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-500';
      case 'current':
        return 'bg-blue-500 animate-pulse';
      case 'pending':
        return 'bg-gray-300';
      case 'failed':
        return 'bg-red-500';
      default:
        return 'bg-gray-300';
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold mb-2">Track Your Order</h1>
        <p className="text-muted-foreground">
          Enter your order number and email to track your delivery
        </p>
      </div>

      <Card className="mb-8">
        <CardContent className="pt-6">
          <form onSubmit={handleTrackOrder} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="orderNumber"
                  className="block text-sm font-medium mb-1"
                >
                  Order Number
                </label>
                <Input
                  id="orderNumber"
                  placeholder="ORD-123456"
                  value={orderNumber}
                  onChange={(e) => setOrderNumber(e.target.value)}
                  required
                />
              </div>
              <div>
                <label
                  htmlFor="email"
                  className="block text-sm font-medium mb-1"
                >
                  Email Address
                </label>
                <Input
                  id="email"
                  type="email"
                  placeholder="your@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? (
                <>
                  <Clock className="mr-2 h-4 w-4 animate-spin" />
                  Searching...
                </>
              ) : (
                <>
                  <Search className="mr-2 h-4 w-4" />
                  Track Order
                </>
              )}
            </Button>
          </form>

          {error && (
            <div className="mt-4 p-4 bg-red-50 text-red-600 rounded-lg text-sm">
              {error}
            </div>
          )}
        </CardContent>
      </Card>

      {orderData && (
        <div className="space-y-6">
          {/* Order Header */}
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    Order {orderData.order.order_number}
                    <Badge
                      variant={
                        orderData.order.status === 'delivered'
                          ? 'default'
                          : orderData.order.status === 'cancelled'
                            ? 'destructive'
                            : 'secondary'
                      }
                    >
                      {orderData.order.status.charAt(0).toUpperCase() +
                        orderData.order.status.slice(1)}
                    </Badge>
                  </CardTitle>
                  <CardDescription>
                    Placed on {formatDate(orderData.order.created_at)}
                  </CardDescription>
                </div>
                {orderData.estimated_delivery && (
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground">
                      Estimated Delivery
                    </p>
                    <p className="font-medium">
                      {new Date(
                        orderData.estimated_delivery.min
                      ).toLocaleDateString('en-NG', {
                        month: 'short',
                        day: 'numeric',
                      })}{' '}
                      -{' '}
                      {new Date(
                        orderData.estimated_delivery.max
                      ).toLocaleDateString('en-NG', {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </p>
                  </div>
                )}
              </div>
            </CardHeader>
          </Card>

          {/* Timeline */}
          <Card>
            <CardHeader>
              <CardTitle>Order Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="relative">
                {orderData.timeline.map((event, index) => {
                  const Icon = iconMap[event.icon];
                  return (
                    <div key={index} className="flex gap-4 pb-8 last:pb-0">
                      <div className="relative flex flex-col items-center">
                        <div
                          className={`w-10 h-10 rounded-full flex items-center justify-center ${getStatusColor(
                            event.status
                          )} ${event.status === 'pending' ? 'bg-gray-200' : 'text-white'}`}
                        >
                          <Icon className="w-5 h-5" />
                        </div>
                        {index < orderData.timeline.length - 1 && (
                          <div
                            className={`absolute top-10 w-0.5 h-full ${
                              event.status === 'completed'
                                ? 'bg-green-500'
                                : 'bg-gray-200'
                            }`}
                          />
                        )}
                      </div>
                      <div className="flex-1 pt-1">
                        <p className="font-medium">{event.title}</p>
                        <p className="text-sm text-muted-foreground">
                          {event.description}
                        </p>
                        {event.timestamp && (
                          <p className="text-xs text-muted-foreground mt-1">
                            {formatDate(event.timestamp)}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {orderData.shipping_tracking && (
                <div className="mt-6 p-4 bg-blue-50 rounded-lg">
                  <p className="font-medium text-blue-900">
                    Tracking Information
                  </p>
                  <p className="text-sm text-blue-700 mt-1">
                    {orderData.shipping_tracking.provider}:{' '}
                    {orderData.shipping_tracking.tracking_number}
                  </p>
                  <Button
                    variant="link"
                    className="p-0 h-auto mt-2 text-blue-600"
                    asChild
                  >
                    <a
                      href={orderData.shipping_tracking.tracking_url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Track with carrier{' '}
                      <ExternalLink className="ml-1 h-3 w-3" />
                    </a>
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Order Items */}
          <Card>
            <CardHeader>
              <CardTitle>Order Items</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {orderData.items.map((item) => (
                  <div key={item.id} className="flex gap-4">
                    {item.product_image && (
                      <div className="relative w-16 h-16 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0">
                        <Image
                          src={item.product_image}
                          alt={item.product_name}
                          fill
                          className="object-cover"
                        />
                      </div>
                    )}
                    <div className="flex-1">
                      <p className="font-medium">{item.product_name}</p>
                      {item.variant_name && (
                        <p className="text-sm text-muted-foreground">
                          {item.variant_name}
                        </p>
                      )}
                      <p className="text-sm text-muted-foreground">
                        Qty: {item.quantity}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">
                        {formatCurrency(
                          item.total_price,
                          orderData.order.currency
                        )}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              <Separator className="my-4" />

              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>
                    {formatCurrency(
                      orderData.order.subtotal,
                      orderData.order.currency
                    )}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Shipping</span>
                  <span>
                    {formatCurrency(
                      orderData.order.shipping_cost,
                      orderData.order.currency
                    )}
                  </span>
                </div>
                {orderData.order.discount_amount > 0 && (
                  <div className="flex justify-between text-green-600">
                    <span>Discount</span>
                    <span>
                      -
                      {formatCurrency(
                        orderData.order.discount_amount,
                        orderData.order.currency
                      )}
                    </span>
                  </div>
                )}
                <Separator />
                <div className="flex justify-between font-medium text-base">
                  <span>Total</span>
                  <span>
                    {formatCurrency(
                      orderData.order.total,
                      orderData.order.currency
                    )}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Shipping & Contact */}
          <div className="grid gap-6 sm:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  Shipping Address
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="font-medium">{orderData.customer.name}</p>
                <p className="text-sm text-muted-foreground mt-1">
                  {orderData.shipping_address.address}
                </p>
                <p className="text-sm text-muted-foreground">
                  {orderData.shipping_address.city},{' '}
                  {orderData.shipping_address.state}
                </p>
                <p className="text-sm text-muted-foreground">
                  {orderData.shipping_address.country}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Need Help?</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {orderData.merchant.support_email && (
                  <a
                    href={`mailto:${orderData.merchant.support_email}`}
                    className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
                  >
                    <Mail className="h-4 w-4" />
                    {orderData.merchant.support_email}
                  </a>
                )}
                {orderData.merchant.support_phone && (
                  <a
                    href={`tel:${orderData.merchant.support_phone}`}
                    className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
                  >
                    <Phone className="h-4 w-4" />
                    {orderData.merchant.support_phone}
                  </a>
                )}
                {!orderData.merchant.support_email &&
                  !orderData.merchant.support_phone && (
                    <p className="text-sm text-muted-foreground">
                      Contact {orderData.merchant.name} for support
                    </p>
                  )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
