'use client';

import {
  SheetHeader,
  SheetTitle,
  SheetFooter,
  SheetClose,
} from '@/components/ui/sheet';
import { ThemedButton, ThemedSheetContent } from '@/components/themed';
import { useCart } from '@/hooks/use-cart';
import { useMerchant } from '@/hooks/use-merchant';
import Image from 'next/image';
import { ScrollArea } from '@/components/ui/scroll-area';
import { getCountryByCode } from '@/lib/countries';
import { Input } from './ui/input';
import { Button } from './ui/button';
import Link from 'next/link';
import { Minus, Plus, ShoppingBag } from 'lucide-react';

export function Cart() {
  const { cart, removeFromCart, updateQuantity, cartTotal, cartCount } = useCart();
  const { merchant } = useMerchant();

  const formatCurrency = (amount: number) => {
    const country = merchant?.country ? getCountryByCode(merchant.country) : undefined;
    const locale = country ? `en-${country.code}` : 'en-US';
    const currency = country ? country.currency : 'USD';

    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currency,
      currencyDisplay: 'symbol',
    }).format(amount);
  };

  return (
    <ThemedSheetContent
      className="flex w-full flex-col pr-0 sm:max-w-lg"
    >
      <SheetHeader className="px-6">
        <SheetTitle>Cart {cartCount > 0 && `(${cartCount})`}</SheetTitle>
      </SheetHeader>
      <div className="flex-1 overflow-y-auto">
        <ScrollArea className="h-full">
          {cart.length > 0 ? (
            <div className="px-6">
              {cart.map((item) => (
                <div key={item.id} className="flex items-start gap-4 py-4 border-b">
                  <Image
                    src={item.image}
                    alt={item.name}
                    width={64}
                    height={64}
                    className="rounded-md object-cover"
                  />
                  <div className="flex-1 space-y-2">
                    <p className="font-semibold">{item.name}</p>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => updateQuantity(item.id, item.quantity - 1)}
                        aria-label={`Decrease quantity of ${item.name}`}
                      >
                        <Minus className="h-4 w-4" aria-hidden="true" />
                      </Button>
                      <Input
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(e) => updateQuantity(item.id, parseInt(e.target.value, 10))}
                        className="w-12 h-8 text-center remove-arrow"
                        aria-label={`Quantity for ${item.name}`}
                      />
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => updateQuantity(item.id, item.quantity + 1)}
                        aria-label={`Increase quantity of ${item.name}`}
                      >
                        <Plus className="h-4 w-4" aria-hidden="true" />
                      </Button>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">{formatCurrency(item.price * item.quantity)}</p>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs h-auto p-0 text-red-500 hover:text-red-600"
                      onClick={() => removeFromCart(item.id)}
                      aria-label={`Remove ${item.name} from cart`}
                    >
                      Remove
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center px-6">
              <ShoppingBag className="w-20 h-20 text-muted-foreground/50 mb-4" />
              <p className="text-lg font-semibold">Your cart is empty</p>
              <p className="text-muted-foreground mt-2">
                Add some products to get started!
              </p>
            </div>
          )}
        </ScrollArea>
      </div>
      {cart.length > 0 && (
        <SheetFooter className="px-6 py-4 bg-background border-t">
          <div className="w-full space-y-4">
            <div className="flex justify-between font-semibold">
              <span>Subtotal</span>
              <span>{formatCurrency(cartTotal)}</span>
            </div>
            <SheetClose asChild>
              <Link href="/checkout" className="w-full">
                <ThemedButton
                  size="lg"
                  className="w-full"
                  colorRole="primary"
                >
                  Proceed to Checkout
                </ThemedButton>
              </Link>
            </SheetClose>
          </div>
        </SheetFooter>
      )}
    </ThemedSheetContent>
  );
}
