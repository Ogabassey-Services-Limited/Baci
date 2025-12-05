import { MerchantProvider } from '@/hooks/use-merchant';
import { ProductClient } from './product-client';

interface PageProps {
    params: Promise<{
        slug: string;
        id: string;
    }>;
}

export default async function ProductPage({ params }: PageProps) {
    const { slug, id } = await params;

    return (
        <MerchantProvider slug={slug}>
            <ProductClient slug={slug} productId={id} />
        </MerchantProvider>
    );
}
