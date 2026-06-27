import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'Track Order',
  description: 'Track an existing order securely with your order details.',
  robots: { index: false, follow: false },
};

export default function TrackOrderLayout({
  children,
}: {
  children: ReactNode;
}) {
  return <>{children}</>;
}
