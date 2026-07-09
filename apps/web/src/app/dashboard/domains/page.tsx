import { Plus } from 'lucide-react';
import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { getMerchantForUser } from '@/lib/merchant-server';
import { createClient } from '@/lib/supabase/server';
import { ConnectDomainForm } from './components/connect-domain-form';
import { type Domain, DomainCard } from './components/domain-card';
import { DomainSearchPanel } from './components/domain-search-panel';
import { DomainsHeader } from './components/domains-header';

export const metadata: Metadata = {
  title: 'Domains | Baci',
  description: 'Manage your store domains and custom URLs',
};

export default async function DomainsPage({
  searchParams,
}: {
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { merchant } = await getMerchantForUser();

  if (!merchant) {
    redirect('/login');
  }

  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const resolvedSearchParams = await searchParams;

  // Handle tab from URL
  const tab =
    typeof resolvedSearchParams?.tab === 'string'
      ? resolvedSearchParams.tab
      : 'overview';

  const { data: domains, error: domainsError } = await supabase
    .from('domains')
    .select(
      'id, domain, tld, domain_type, status, is_primary, verification_token, verified_at, ssl_status, created_at, expires_at, auto_renew, purchase_price, renewal_price'
    )
    .eq('merchant_id', merchant.id)
    .order('is_primary', { ascending: false }) // Primary first
    .order('created_at', { ascending: false }); // Then newest

  // Handle error gracefully - show empty state instead of throwing
  if (domainsError) {
    console.error('Error fetching domains:', domainsError);
  }

  const domainsList: Domain[] = (
    domainsError || !domains
      ? []
      : domains.map((domainRow) => ({
          id: domainRow.id,
          domain: domainRow.domain,
          tld: domainRow.tld,
          domain_type: domainRow.domain_type,
          status: domainRow.status,
          is_primary: domainRow.is_primary,
          verification_token: domainRow.verification_token,
          verified_at: domainRow.verified_at,
          ssl_status: domainRow.ssl_status,
          created_at: domainRow.created_at,
          purchase_info: {
            expires_at: domainRow.expires_at ?? undefined,
            auto_renew: domainRow.auto_renew ?? undefined,
            cost_price: domainRow.purchase_price ?? undefined,
            sell_price: domainRow.renewal_price ?? undefined,
          },
        }))
  ) satisfies Domain[];

  // Empty state logic
  const hasDomains = domainsList.length > 0;

  return (
    <div className="container mx-auto p-6 space-y-6">
      <DomainsHeader />

      <Tabs defaultValue={tab} className="w-full">
        <TabsList className="bg-slate-100/80 dark:bg-slate-800/50 p-1">
          <TabsTrigger
            value="overview"
            className="data-[state=active]:bg-white dark:data-[state=active]:bg-slate-950 data-[state=active]:shadow-sm"
          >
            My Domains
          </TabsTrigger>
          <TabsTrigger
            value="search"
            className="data-[state=active]:bg-white dark:data-[state=active]:bg-slate-950 data-[state=active]:shadow-sm"
          >
            Search & Buy
          </TabsTrigger>
          <TabsTrigger
            value="custom"
            className="data-[state=active]:bg-white dark:data-[state=active]:bg-slate-950 data-[state=active]:shadow-sm"
          >
            Connect Existing Domain
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4 pt-4">
          {!hasDomains ? (
            <div className="flex flex-col items-center justify-center p-12 border-2 border-dashed rounded-xl bg-slate-50/50 dark:bg-slate-900/50">
              <div className="size-16 bg-blue-100 dark:bg-blue-900/20 rounded-full flex items-center justify-center mb-4">
                <Plus className="size-8 text-blue-600 dark:text-blue-400" />
              </div>
              <h2 className="text-xl font-semibold mb-2">No domains yet</h2>
              <p className="text-muted-foreground text-center max-w-md mb-6">
                Connect a custom domain or buy a new one to get started.
              </p>
              {/* Note: In a server component we can't easily switch tabs programmatically with a button click 
                  unless we use a client component wrapper. For empty state, users can click the tabs above. 
                  Or we could just render the Action Buttons here that link to query params? 
                  For now, simple instruction reference is fine. */}
            </div>
          ) : (
            <div className="space-y-4">
              {domainsList.map((domain) => (
                <DomainCard key={domain.id} domain={domain} />
              ))}
            </div>
          )}
        </TabsContent>

        {/* Search Tab */}
        <TabsContent value="search" className="pt-4">
          <div className="max-w-3xl mx-auto">
            <DomainSearchPanel />
          </div>
        </TabsContent>

        {/* Custom Tab */}
        <TabsContent value="custom" className="pt-4">
          <div className="max-w-2xl mx-auto">
            <ConnectDomainForm />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
