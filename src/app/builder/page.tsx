
import BuilderClient from '@/components/builder/builder-client';
import { Metadata } from 'next';
import { MerchantProvider } from '@/hooks/use-merchant';

export const metadata: Metadata = {
    title: 'Website Builder - Baci',
    description: 'Customize your storefront',
};

export default function BuilderPage() {
    return (
        <MerchantProvider>
            <BuilderClient />
        </MerchantProvider>
    );
}
