
'use client';

import {
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { useCart } from '@/hooks/use-cart';
import { useMerchant } from '@/hooks/use-merchant';
import Image from 'next/image';
import { ScrollArea } from '@/components/ui/scroll-area';
import { getCountryByCode } from '@/lib/countries';
import { ThemedButton } from './themed';

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
    }).format(amount);
  };

  return (
    <SheetContent className="flex w-full flex-col pr-0 sm:max-w-lg">
      <SheetHeader className="px-6">
        <SheetTitle>Cart {cartCount > 0 && `(${cartCount})`}</SheetTitle>
      </SheetHeader>
      <div className="flex-1 overflow-y-auto">
        <ScrollArea className="h-full">
          {cart.length > 0 ? (
            <div className="px-6">
              {cart.map((item) => (
                <div key={item.id} className="flex items-center gap-4 py-4 border-b">
                  <Image
                    src={item.image}
                    alt={item.name}
                    width={64}
                    height={64}
                    className="rounded-md object-cover"
                  />
                  <div className="flex-1">
                    <p className="font-semibold">{item.name}</p>
                    <p className="text-sm text-muted-foreground">
                      Quantity: 
                       <input
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(e) => updateQuantity(item.id, parseInt(e.target.value, 10))}
                        className="w-12 ml-2 p-1 border rounded-md"
                        aria-label={`Quantity for ${item.name}`}
                      />
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">{formatCurrency(item.price * item.quantity)}</p>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs text-red-500 hover:text-red-600"
                      onClick={() => removeFromCart(item.id)}
                    >
                      Remove
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center px-6">
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
                <ThemedButton size="lg" className="w-full" colorRole="accent">
                    Proceed to Checkout
                </ThemedButton>
            </div>
        </SheetFooter>
      )}
    </SheetContent>
  );
}
