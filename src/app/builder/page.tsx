
import BuilderClient from '@/components/builder/builder-client';
import { Metadata } from 'next';
import { MerchantProvider } from '@/hooks/use-merchant';
import { ProductProvider } from '@/contexts/product-context';

export const metadata: Metadata = {
    title: 'Website Builder - Baci',
    description: 'Customize your storefront',
};

export default function BuilderPage() {
    return (
        <MerchantProvider>
            <ProductProvider>
                <BuilderClient />
            </ProductProvider>
        </MerchantProvider>
    );
}
