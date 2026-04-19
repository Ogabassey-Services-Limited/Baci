import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { RepairBookingWizard } from '@/components/storefront/RepairBookingWizard';
import {
  getCachedMerchant,
  getCachedMerchantByDomain,
} from '@/lib/cached-data';
import { isDomainIdentifier } from '@/lib/validation';

interface RepairPageProps {
  params: Promise<{
    slug: string;
  }>;
}

export async function generateMetadata({
  params,
}: RepairPageProps): Promise<Metadata> {
  const { slug } = await params;

  const merchant = isDomainIdentifier(slug)
    ? await getCachedMerchantByDomain(slug.toLowerCase())
    : await getCachedMerchant(slug.toLowerCase());

  if (!merchant) {
    return {
      title: 'Store Not Found',
    };
  }

  return {
    title: `Book a Repair - ${merchant.business_name}`,
    description: `Schedule a repair service with ${merchant.business_name}`,
  };
}

export default async function RepairPage({ params }: RepairPageProps) {
  const { slug } = await params;

  const merchant = isDomainIdentifier(slug)
    ? await getCachedMerchantByDomain(slug.toLowerCase())
    : await getCachedMerchant(slug.toLowerCase());

  if (!merchant) {
    notFound();
  }

  return (
    <div className="container mx-auto py-12 px-4">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold mb-4">Book a Repair Service</h1>
          <p className="text-muted-foreground text-lg">
            Have a broken device? Fill out the form below and we'll get it fixed
            for you.
          </p>
        </div>

        <div className="bg-card border rounded-xl shadow-sm overflow-hidden">
          <RepairBookingWizard
            merchantId={merchant.id}
            merchantName={merchant.business_name}
          />
        </div>
      </div>
    </div>
  );
}
