import type { Metadata } from 'next';
import './globals.css';
import { Toaster } from '@/components/ui/toaster';
import { fontBody } from '@/lib/fonts';

export const metadata: Metadata = {
  title: 'Baci - AI E-commerce Builder',
  description: 'Create your e-commerce store in seconds with AI.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head />
      <body className={`${fontBody.variable} font-body antialiased`}>
        {children}
        <Toaster />
      </body>
    </html>
  );
}
