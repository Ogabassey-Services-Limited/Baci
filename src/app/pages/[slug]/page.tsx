import { MerchantProvider } from '@/hooks/use-merchant';
import { ClientPage } from './client-page';

export default async function Page({ params }: { params: { slug: string } }) {
    const { slug } = params;
    return (
        <MerchantProvider>
            <ClientPage slug={slug} />
        </MerchantProvider>
    );
}
