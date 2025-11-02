
import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Toaster } from '@/components/ui/toaster';
import { CartProvider } from '@/hooks/use-cart';
import { MerchantProvider } from '@/hooks/use-merchant';
import { AuthProvider } from '@/contexts/auth-context';
import AppBody from '@/components/app-body';


const inter = Inter({ subsets: ['latin'], variable: '--font-sans' });

export const metadata: Metadata = {
  title: 'Baci - AI E-commerce Builder',
  description: 'Create your e-commerce store in seconds with AI.',
};

export const viewport: Viewport = {
  themeColor: '#3F51B5',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.variable}>
        <AuthProvider>
          <MerchantProvider>
            <CartProvider>
              <AppBody>{children}</AppBody>
            </CartProvider>
          </MerchantProvider>
        </AuthProvider>
        <Toaster />
      </body>
    </html>
  );
}
