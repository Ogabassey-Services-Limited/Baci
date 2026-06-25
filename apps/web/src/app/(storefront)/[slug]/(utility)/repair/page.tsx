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
    description: `Book phone, laptop, console and gadget repairs with ${merchant.business_name}. Check diagnosis, fault details, service expectations and support before submitting a repair request.`,
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

        <section className="mb-8 rounded-xl border bg-card p-5 text-card-foreground shadow-sm">
          <h2 className="text-xl font-semibold">Before you book a repair</h2>
          <div className="mt-3 space-y-3 text-sm leading-6 text-muted-foreground sm:text-base sm:leading-7">
            <p>
              Use this repair request to describe the device model, visible
              damage, fault symptoms and any recent repair attempts. Clear
              details help {merchant.business_name} estimate the right diagnosis
              path before you bring in or dispatch the device.
            </p>
            <p>
              For phones, laptops, tablets, consoles and accessories, back up
              important data where possible, remove passcodes only when support
              asks for them, and keep proof of purchase or warranty information
              available. Final pricing depends on inspection, parts availability
              and the confirmed fault.
            </p>
          </div>
        </section>

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
