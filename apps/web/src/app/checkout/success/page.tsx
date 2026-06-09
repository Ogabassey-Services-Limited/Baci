import type { Metadata } from 'next';
import CheckoutSuccessClientPage from './client-page';

export const metadata: Metadata = {
  title: 'Order Confirmed - Baci Checkout',
  description: 'Confirmation details for a completed Baci checkout session.',
  robots: {
    index: false,
    follow: false,
  },
};

export default function SuccessPage() {
  return <CheckoutSuccessClientPage />;
}
