import { Metadata } from 'next';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { OrderTrackingClient } from './order-tracking-client';

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

async function getMerchant(slug: string) {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const { data: merchant, error } = await supabase
    .from('merchants')
    .select('id, business_name, slug, logo_url, phone, email')
    .eq('slug', slug)
    .single();

  if (error || !merchant) {
    return null;
  }

  return merchant;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const merchant = await getMerchant(slug);

  if (!merchant) {
    return {
      title: 'Track Your Order',
    };
  }

  return {
    title: `Track Your Order | ${merchant.business_name}`,
    description: `Track your order status at ${merchant.business_name}. Enter your order number and email to see real-time updates.`,
    openGraph: {
      title: `Track Your Order | ${merchant.business_name}`,
      description: `Track your order status and delivery updates.`,
      type: 'website',
      ...(merchant.logo_url && { images: [{ url: merchant.logo_url }] }),
    },
  };
}

export default async function OrderTrackingPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const resolvedSearchParams = await searchParams;
  const merchant = await getMerchant(slug);

  if (!merchant) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <p>Store not found.</p>
      </div>
    );
  }

  // Get order number and email from URL if provided (e.g., from email link)
  const orderNumber = typeof resolvedSearchParams.order === 'string'
    ? resolvedSearchParams.order
    : undefined;
  const email = typeof resolvedSearchParams.email === 'string'
    ? resolvedSearchParams.email
    : undefined;

  return (
    <OrderTrackingClient
      merchant={merchant}
      initialOrderNumber={orderNumber}
      initialEmail={email}
    />
  );
}
