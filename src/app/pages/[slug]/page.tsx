import { MerchantProvider } from '@/hooks/use-merchant';
import { ClientPage } from './client-page';

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
    const { slug } = await params;
    return (
        <MerchantProvider>
            <ClientPage slug={slug} />
        </MerchantProvider>
    );
}
