'use client';

import { CheckCircle, Star } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ThemedButton } from '@/components/themed';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { MerchantProvider, useMerchant } from '@/hooks/use-merchant-client';
import { getCountryByCode } from '@/lib/countries';
import { BACI_GOOGLE_REVIEW_URL } from '@/lib/post-purchase-actions';

interface OrderData {
  order_id?: string;
  order_number?: string;
  shipping: {
    firstName: string;
    lastName: string;
    email: string;
    address: string;
    city: string;
    state: string;
  };
  items: Array<{
    id: string;
    name: string;
    price: number;
    quantity: number;
    image: string;
  }>;
  subtotal?: number;
  shipping_fee?: number;
  total?: number;
}

function SuccessPageContent() {
  const [order, setOrder] = useState<OrderData | null>(null);
  const { merchant } = useMerchant();

  useEffect(() => {
    const orderData = sessionStorage.getItem('lastOrder');
    if (orderData) {
      setOrder(JSON.parse(orderData));
    }
  }, []);

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

  const subtotal =
    order?.subtotal ||
    order?.items.reduce((acc, item) => acc + item.price * item.quantity, 0) ||
    0;
  const shippingFee = order?.shipping_fee || 10.0;
  const total = order?.total || subtotal + shippingFee;

  return (
    <div className="container mx-auto max-w-2xl py-12 px-4">
      <Card>
        <CardHeader className="text-center">
          <div className="mx-auto bg-green-100 rounded-full p-3 w-fit">
            <CheckCircle className="h-12 w-12 text-green-600" />
          </div>
          <CardTitle className="text-3xl mt-4">Order Confirmed!</CardTitle>
          {order?.order_number && (
            <p className="text-lg font-medium text-muted-foreground mt-2">
              Order {order.order_number}
            </p>
          )}
          <p className="text-muted-foreground">
            Thank you for your purchase, {order?.shipping.firstName}! A
            confirmation has been sent to {order?.shipping.email}.
          </p>
        </CardHeader>
        <CardContent>
          {order && (
            <div className="space-y-6">
              <div>
                <h3 className="font-semibold mb-2">Shipping To</h3>
                <p className="text-sm text-muted-foreground">
                  {order.shipping.firstName} {order.shipping.lastName}
                  <br />
                  {order.shipping.address}
                  <br />
                  {order.shipping.city}, {order.shipping.state}
                </p>
              </div>
              <Separator />
              <div>
                <h3 className="font-semibold mb-4">Order Summary</h3>
                <div className="space-y-4">
                  {order.items.map((item) => (
                    <div key={item.id} className="flex items-center gap-4">
                      <Image
                        src={item.image}
                        alt={item.name}
                        width={64}
                        height={64}
                        className="rounded-md object-cover"
                      />
                      <div className="flex-1">
                        <p className="font-medium">{item.name}</p>
                        <p className="text-sm text-muted-foreground">
                          Qty: {item.quantity}
                        </p>
                      </div>
                      <p className="font-medium">
                        {formatCurrency(item.price * item.quantity)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
              <Separator />
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>{formatCurrency(subtotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Shipping</span>
                  <span>{formatCurrency(shippingFee)}</span>
                </div>
                <div className="flex justify-between font-bold text-lg">
                  <span>Total</span>
                  <span>{formatCurrency(total)}</span>
                </div>
              </div>
            </div>
          )}
          <div className="mt-8 text-center">
            <div className="flex flex-col items-center gap-3">
              <Link href="/">
                <ThemedButton colorRole="primary">
                  Continue Shopping
                </ThemedButton>
              </Link>
              <a
                href={BACI_GOOGLE_REVIEW_URL}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 text-sm font-medium text-foreground/80 hover:text-foreground"
              >
                <Star className="h-4 w-4" />
                Leave a Google Review
              </a>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function SuccessPage() {
  return (
    <MerchantProvider>
      <SuccessPageContent />
    </MerchantProvider>
  );
}
