import { Metadata } from 'next';
import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { RewardsPageClient } from './rewards-page-client';

interface PageProps {
  params: Promise<{ slug: string }>;
}

async function getMerchant(slug: string) {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const { data: merchant, error } = await supabase
    .from('merchants')
    .select('*')
    .eq('slug', slug)
    .single();

  if (error || !merchant) {
    return null;
  }

  return merchant;
}

async function getLoyaltySettings(merchantId: string) {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const { data: settings } = await supabase
    .from('loyalty_settings')
    .select('*')
    .eq('merchant_id', merchantId)
    .single();

  return settings;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const merchant = await getMerchant(slug);

  if (!merchant) {
    return {
      title: 'Rewards',
    };
  }

  const settings = await getLoyaltySettings(merchant.id);
  const programName = settings?.program_name || 'Rewards Program';

  return {
    title: `${programName} | ${merchant.business_name}`,
    description: `Join our ${programName} and earn points on every purchase. Redeem for exclusive discounts and rewards at ${merchant.business_name}.`,
    openGraph: {
      title: `${programName} | ${merchant.business_name}`,
      description: `Earn points and unlock exclusive rewards at ${merchant.business_name}.`,
      type: 'website',
      ...(merchant.logo_url && { images: [{ url: merchant.logo_url }] }),
    },
  };
}

export default async function RewardsPage({ params }: PageProps) {
  const { slug } = await params;
  const merchant = await getMerchant(slug);

  if (!merchant) {
    notFound();
  }

  const settings = await getLoyaltySettings(merchant.id);

  // If loyalty program is not enabled, show not found
  if (!settings?.enabled) {
    notFound();
  }

  return (
    <RewardsPageClient
      merchant={merchant}
      settings={settings}
    />
  );
}
