'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { ShoppingBag } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { ThemedButton, ThemedSheetContent } from '@/components/themed';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  SheetClose,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { useCart } from '@/hooks/use-cart';
import { useCurrency } from '@/hooks/use-currency';
import { useMerchant } from '@/hooks/use-merchant';
import { asRoute } from '@/lib/routes';
import { QuantityButton } from './ui/animated-icons';
import { Input } from './ui/input';

export function Cart() {
  const { cart, removeFromCart, updateQuantity, cartTotal, cartCount } =
    useCart();
  const { formatCurrency } = useCurrency();
  const { basePath } = useMerchant();

  return (
    <ThemedSheetContent className="glass-themed flex w-full flex-col pr-0 sm:max-w-lg">
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {cartCount > 0
          ? `Cart updated. ${cartCount} items in cart. Subtotal is ${formatCurrency(cartTotal)}.`
          : 'Cart is empty'}
      </div>
      <SheetHeader className="px-6">
        <SheetTitle>Cart {cartCount > 0 && `(${cartCount})`}</SheetTitle>
      </SheetHeader>
      <div className="flex-1 overflow-y-auto">
        <ScrollArea className="h-full">
          {cart.length > 0 ? (
            <div className="px-6">
              <AnimatePresence mode="popLayout">
                {cart.map((item) => (
                  <motion.div
                    key={item.id}
                    className="flex items-start gap-4 py-4 border-b"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.2 }}
                    layout
                  >
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
                        <QuantityButton
                          type="minus"
                          onClick={() =>
                            updateQuantity(item.id, item.quantity - 1)
                          }
                          disabled={item.quantity <= 1}
                          className="h-11 w-11 min-w-[44px] min-h-[44px]"
                        />
                        <Input
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={(e) =>
                            updateQuantity(
                              item.id,
                              Number.parseInt(e.target.value, 10)
                            )
                          }
                          className="w-14 h-11 text-center remove-arrow"
                          aria-label={`Quantity for ${item.name}`}
                        />
                        <QuantityButton
                          type="plus"
                          onClick={() =>
                            updateQuantity(item.id, item.quantity + 1)
                          }
                          className="h-11 w-11 min-w-[44px] min-h-[44px]"
                        />
                      </div>
                    </div>
                    <div className="text-right">
                      <motion.p
                        key={item.price * item.quantity}
                        className="font-semibold"
                        initial={{ scale: 1.1 }}
                        animate={{ scale: 1 }}
                        transition={{ duration: 0.2 }}
                      >
                        {formatCurrency(item.price * item.quantity)}
                      </motion.p>
                      <motion.button
                        type="button"
                        className="text-xs min-h-[44px] px-2 text-red-500 hover:text-red-600 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-sm"
                        onClick={() => removeFromCart(item.id)}
                        aria-label={`Remove ${item.name} from cart`}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                      >
                        Remove
                      </motion.button>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
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
              <Link href={asRoute(`${basePath}/checkout`)} className="w-full">
                <ThemedButton size="lg" className="w-full" colorRole="primary">
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
