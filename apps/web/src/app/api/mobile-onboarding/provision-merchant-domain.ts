/**
 * Provisions the merchant's storefront subdomain.
 *
 * Extracted from route.ts so the provisioning + repair workflow is testable on
 * its own and the route stops accumulating inline provisioning paths.
 *
 * Always runs on the CALLER-SCOPED client, never the service-role one. A denial
 * here is the same class of bug this endpoint's own outage was (an RLS policy
 * that owners cannot satisfy); forcing it through with a privileged client
 * would hide that misconfiguration instead of surfacing it, and this route is
 * not one of the narrowly authorized service-role edges.
 */

/** 23505 = the domain row already exists, which is success for our purposes. */
const UNIQUE_VIOLATION = '23505';

interface DomainInsertResult {
  error: { code?: string } | null;
}

export interface DomainProvisionClient {
  from: (table: 'domains') => {
    insert: (row: Record<string, unknown>) => PromiseLike<DomainInsertResult>;
  };
}

export interface ProvisionMerchantDomainInput {
  merchantId: string;
  merchantSlug: string;
  rootDomain: string;
}

export interface ProvisionMerchantDomainResult {
  provisioned: boolean;
  /** Present only when provisioning failed; carries the Postgres error shape. */
  error?: unknown;
}

export async function provisionMerchantDomain(
  client: DomainProvisionClient,
  { merchantId, merchantSlug, rootDomain }: ProvisionMerchantDomainInput
): Promise<ProvisionMerchantDomainResult> {
  const { error } = await client.from('domains').insert({
    merchant_id: merchantId,
    domain: `${merchantSlug}.${rootDomain}`,
    tld: `.${rootDomain}`,
    domain_type: 'subdomain',
    status: 'active',
    is_primary: true,
  });

  if (!error || error.code === UNIQUE_VIOLATION) {
    return { provisioned: true };
  }

  return { provisioned: false, error };
}
