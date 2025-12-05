import { MerchantProvider } from '@/hooks/use-merchant';
import { CartClient } from './cart-client';

interface PageProps {
    params: Promise<{
        slug: string;
    }>;
}

export default async function CartPage({ params }: PageProps) {
    const { slug } = await params;

    return (
        <MerchantProvider slug={slug}>
            <CartClient slug={slug} />
        </MerchantProvider>
    );
}
