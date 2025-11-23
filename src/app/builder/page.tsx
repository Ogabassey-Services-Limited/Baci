
import BuilderClient from './builder-client';
import { Metadata } from 'next';
import { MerchantProvider } from '@/hooks/use-merchant';
import { StorefrontProvider } from '@/contexts/storefront-context';


export const metadata: Metadata = {
    title: 'Website Builder - Baci',
    description: 'Customize your storefront',
};

export default function BuilderPage() {
    // Force update
    return (
        <MerchantProvider>
            <StorefrontProvider>
                <BuilderClient />
            </StorefrontProvider>
        </MerchantProvider>
    );
}
