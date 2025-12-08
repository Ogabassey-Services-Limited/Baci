import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import '../globals.css';
import { Toaster } from '@/components/ui/toaster';
import { PreviewProviders } from '@/contexts/preview-providers';

const inter = Inter({
    subsets: ['latin'],
    variable: '--font-sans',
    display: 'swap',
    preload: true,
});

export const metadata: Metadata = {
    title: 'Template Preview',
    description: 'Preview storefront templates',
    robots: {
        index: false,
        follow: false,
    },
};

export const viewport: Viewport = {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 5,
    userScalable: true,
    viewportFit: 'cover',
};

export default function PreviewLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="en" suppressHydrationWarning>
            <body className={inter.variable} suppressHydrationWarning>
                <PreviewProviders>
                    {children}
                    <Toaster />
                </PreviewProviders>
            </body>
        </html>
    );
}
