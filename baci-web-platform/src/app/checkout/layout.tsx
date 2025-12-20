import type { Metadata } from 'next';

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
  return <>{children}</>;
}
