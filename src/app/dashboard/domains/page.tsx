import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import DomainsClient from './domains-client';

export const metadata = {
  title: 'Domains | Baci',
  description: 'Manage your custom domains and subdomains',
};

export default async function DomainsPage() {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // Get merchant ID
  const { data: merchant } = await supabase
    .from('merchants')
    .select('id')
    .eq('user_id', user.id)
    .single();

  if (!merchant) {
    redirect('/login');
  }

  // Fetch domains
  const { data: domains } = await supabase
    .from('domains')
    .select('*')
    .eq('merchant_id', merchant.id)
    .order('is_primary', { ascending: false }) // Primary first
    .order('created_at', { ascending: false });

  // Cast domains to match client expectations if types differ slightly
  // biome-ignore lint/suspicious/noExplicitAny: Domain type mismatch between server and client
  return (
    <DomainsClient
      initialDomains={(domains || []) as any[]}
      merchantId={merchant.id}
    />
  );
}
