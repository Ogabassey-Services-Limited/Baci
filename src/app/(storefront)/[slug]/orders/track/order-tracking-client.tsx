'use client';

import { useState, useEffect } from 'react';
import {
  Package,
  Truck,
  CheckCircle2,
  Clock,
  MapPin,
  Phone,
  Mail,
  ExternalLink,
  Search,
  AlertCircle,
  XCircle,
  RefreshCw,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

interface OrderEvent {
  status: string;
  description: string;
  timestamp: string;
  location?: string;
}

interface OrderItem {
  id: string;
  product_id: string;
  product_name: string;
  variant_name?: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  image_url?: string;
}

interface ShippingDetails {
  provider?: string;
  tracking_number?: string;
  tracking_url?: string;
  estimated_delivery?: string;
}

interface OrderData {
  id: string;
  orderNumber: string;
  status: string;
  statusInfo: {
    label: string;
    description: string;
    color: string;
  };
  total: number;
  subtotal: number;
  shippingFee: number;
  discountAmount: number;
  currency: string;
  createdAt: string;
  updatedAt: string;
  shippingAddress: {
    name?: string;
    address?: string;
    city?: string;
    state?: string;
    postal_code?: string;
    country?: string;
    phone?: string;
  } | null;
  items: OrderItem[];
  merchant: {
    name?: string;
    slug?: string;
    phone?: string;
    email?: string;
  };
}

interface TrackingResponse {
  order: OrderData;
  shipping: ShippingDetails | null;
  timeline: OrderEvent[];
  currentStatus: string;
}

interface Merchant {
  id: string;
  business_name: string;
  slug: string;
  logo_url?: string;
  phone?: string;
  email?: string;
}

interface OrderTrackingClientProps {
  merchant: Merchant;
  initialOrderNumber?: string;
  initialEmail?: string;
}

const STATUS_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  placed: Package,
  confirmed: CheckCircle2,
  processing: Clock,
  shipped: Truck,
  fulfilled: Truck,
  out_for_delivery: Truck,
  delivered: CheckCircle2,
  cancelled: XCircle,
  refunded: RefreshCw,
};

const STATUS_COLORS: Record<string, string> = {
  yellow: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  blue: 'bg-blue-100 text-blue-800 border-blue-300',
  purple: 'bg-purple-100 text-purple-800 border-purple-300',
  green: 'bg-green-100 text-green-800 border-green-300',
  red: 'bg-red-100 text-red-800 border-red-300',
  gray: 'bg-gray-100 text-gray-800 border-gray-300',
};

export function OrderTrackingClient({
  merchant,
  initialOrderNumber = '',
  initialEmail = '',
}: OrderTrackingClientProps) {
  const [orderNumber, setOrderNumber] = useState(initialOrderNumber);
  const [email, setEmail] = useState(initialEmail);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [trackingData, setTrackingData] = useState<TrackingResponse | null>(null);

  // Auto-track if both order number and email are provided in URL
  useEffect(() => {
    if (initialOrderNumber && initialEmail) {
      handleTrack();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleTrack = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    if (!orderNumber || !email) {
      setError('Please enter both order number and email');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        orderNumber,
        email,
        merchantId: merchant.id,
      });

      const response = await fetch(`/api/storefront/orders/track?${params}`);
      const result = await response.json();

      if (!response.ok) {
        setError(result.error || 'Order not found');
        setTrackingData(null);
        return;
      }

      setTrackingData(result);
    } catch (_err) {
      setError('Failed to track order. Please try again.');
      setTrackingData(null);
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const formatCurrency = (amount: number, currency: string = 'NGN') => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency,
    }).format(amount);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20 py-8 px-4">
      <div className="container mx-auto max-w-4xl">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center h-16 w-16 rounded-full bg-primary/10 mb-4">
            <Package className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-3xl font-bold">Track Your Order</h1>
          <p className="text-muted-foreground mt-2">
            Enter your order details to track your shipment
          </p>
        </div>

        {/* Search Form */}
        <Card className="mb-8">
          <CardContent className="pt-6">
            <form onSubmit={handleTrack} className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="orderNumber">Order Number</Label>
                  <Input
                    id="orderNumber"
                    placeholder="e.g., ORD-12345"
                    value={orderNumber}
                    onChange={(e) => setOrderNumber(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email Address</Label>
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

              {error && (
                <div className="flex items-center gap-2 p-3 bg-destructive/10 text-destructive rounded-md">
                  <AlertCircle className="h-4 w-4" />
                  <span className="text-sm">{error}</span>
                </div>
              )}

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    Tracking...
                  </>
                ) : (
                  <>
                    <Search className="mr-2 h-4 w-4" />
                    Track Order
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Tracking Results */}
        {trackingData && (
          <div className="space-y-6">
            {/* Status Header */}
            <Card>
              <CardContent className="pt-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Order Number</p>
                    <p className="text-xl font-bold">{trackingData.order.orderNumber}</p>
                    <p className="text-sm text-muted-foreground">
                      Placed on {formatDate(trackingData.order.createdAt)}
                    </p>
                  </div>
                  <Badge
                    variant="outline"
                    className={cn(
                      'text-sm px-4 py-2',
                      STATUS_COLORS[trackingData.order.statusInfo.color] || STATUS_COLORS.gray
                    )}
                  >
                    {trackingData.order.statusInfo.label}
                  </Badge>
                </div>

                <p className="mt-4 text-muted-foreground">
                  {trackingData.order.statusInfo.description}
                </p>

                {/* Estimated Delivery */}
                {trackingData.shipping?.estimated_delivery && (
                  <div className="mt-4 p-4 bg-muted rounded-lg">
                    <p className="text-sm text-muted-foreground">Estimated Delivery</p>
                    <p className="text-lg font-semibold">
                      {formatDate(trackingData.shipping.estimated_delivery)}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Timeline */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Tracking Timeline</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="relative">
                  {trackingData.timeline.map((event, index) => {
                    const Icon = STATUS_ICONS[event.status] || Clock;
                    const isLatest = index === trackingData.timeline.length - 1;

                    return (
                      <div key={index} className="flex gap-4 pb-6 last:pb-0">
                        {/* Line */}
                        <div className="flex flex-col items-center">
                          <div
                            className={cn(
                              'flex h-10 w-10 items-center justify-center rounded-full',
                              isLatest
                                ? 'bg-primary text-primary-foreground'
                                : 'bg-muted text-muted-foreground'
                            )}
                          >
                            <Icon className="h-5 w-5" />
                          </div>
                          {index < trackingData.timeline.length - 1 && (
                            <div className="w-0.5 flex-1 bg-border mt-2" />
                          )}
                        </div>

                        {/* Content */}
                        <div className="flex-1 pt-1">
                          <p className={cn('font-medium', isLatest && 'text-primary')}>
                            {event.description}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {formatDateTime(event.timestamp)}
                          </p>
                          {event.location && (
                            <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                              <MapPin className="h-3 w-3" />
                              {event.location}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Shipping Info */}
            {trackingData.shipping && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Shipping Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {trackingData.shipping.provider && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Carrier</span>
                      <span className="font-medium">{trackingData.shipping.provider}</span>
                    </div>
                  )}
                  {trackingData.shipping.tracking_number && (
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Tracking Number</span>
                      <span className="font-mono font-medium">
                        {trackingData.shipping.tracking_number}
                      </span>
                    </div>
                  )}
                  {trackingData.shipping.tracking_url && (
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => window.open(trackingData.shipping!.tracking_url, '_blank')}
                    >
                      <ExternalLink className="mr-2 h-4 w-4" />
                      Track on Carrier Website
                    </Button>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Delivery Address */}
            {trackingData.order.shippingAddress && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Delivery Address</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-start gap-3">
                    <MapPin className="h-5 w-5 text-muted-foreground mt-0.5" />
                    <div>
                      {trackingData.order.shippingAddress.name && (
                        <p className="font-medium">{trackingData.order.shippingAddress.name}</p>
                      )}
                      <p className="text-muted-foreground">
                        {trackingData.order.shippingAddress.address}
                      </p>
                      <p className="text-muted-foreground">
                        {[
                          trackingData.order.shippingAddress.city,
                          trackingData.order.shippingAddress.state,
                          trackingData.order.shippingAddress.postal_code,
                        ]
                          .filter(Boolean)
                          .join(', ')}
                      </p>
                      {trackingData.order.shippingAddress.phone && (
                        <p className="text-muted-foreground flex items-center gap-1 mt-1">
                          <Phone className="h-3 w-3" />
                          {trackingData.order.shippingAddress.phone}
                        </p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Order Items */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Order Items</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {trackingData.order.items.map((item) => (
                    <div key={item.id} className="flex gap-4">
                      {item.image_url && (
                        <div className="h-16 w-16 rounded-md bg-muted overflow-hidden flex-shrink-0">
                          <img
                            src={item.image_url}
                            alt={item.product_name}
                            className="h-full w-full object-cover"
                          />
                        </div>
                      )}
                      <div className="flex-1">
                        <p className="font-medium">{item.product_name}</p>
                        {item.variant_name && (
                          <p className="text-sm text-muted-foreground">{item.variant_name}</p>
                        )}
                        <p className="text-sm text-muted-foreground">Qty: {item.quantity}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-medium">
                          {formatCurrency(item.total_price, trackingData.order.currency)}
                        </p>
                      </div>
                    </div>
                  ))}

                  <Separator />

                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Subtotal</span>
                      <span>
                        {formatCurrency(trackingData.order.subtotal, trackingData.order.currency)}
                      </span>
                    </div>
                    {trackingData.order.shippingFee > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Shipping</span>
                        <span>
                          {formatCurrency(trackingData.order.shippingFee, trackingData.order.currency)}
                        </span>
                      </div>
                    )}
                    {trackingData.order.discountAmount > 0 && (
                      <div className="flex justify-between text-sm text-green-600">
                        <span>Discount</span>
                        <span>
                          -{formatCurrency(trackingData.order.discountAmount, trackingData.order.currency)}
                        </span>
                      </div>
                    )}
                    <Separator />
                    <div className="flex justify-between font-medium">
                      <span>Total</span>
                      <span>
                        {formatCurrency(trackingData.order.total, trackingData.order.currency)}
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Need Help */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Need Help?</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground mb-4">
                  If you have any questions about your order, please contact the store:
                </p>
                <div className="space-y-2">
                  {merchant.phone && (
                    <a
                      href={`tel:${merchant.phone}`}
                      className="flex items-center gap-2 text-sm hover:text-primary"
                    >
                      <Phone className="h-4 w-4" />
                      {merchant.phone}
                    </a>
                  )}
                  {merchant.email && (
                    <a
                      href={`mailto:${merchant.email}`}
                      className="flex items-center gap-2 text-sm hover:text-primary"
                    >
                      <Mail className="h-4 w-4" />
                      {merchant.email}
                    </a>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}

export default OrderTrackingClient;
