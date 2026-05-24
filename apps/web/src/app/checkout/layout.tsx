import type { Metadata } from 'next';
import '@/app/globals.css';
import { CartProvider } from '@/hooks/use-cart';

export const metadata: Metadata = {
  title: 'Secure Checkout | Baci',
  description:
    'Complete your purchase securely. Fast and safe checkout process powered by Baci.',
  robots: {
    index: false, // Don't index checkout pages
    follow: false,
  },
};

export default function CheckoutLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <CartProvider>{children}</CartProvider>;
}
