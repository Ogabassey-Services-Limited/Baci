import type {
  MerchantTrustProfile,
  MerchantTrustProfileReturnFee,
  MerchantTrustProfileReturnMethod,
  MerchantTrustProfileShippingFeeType,
} from '@/lib/storefront-trust/merchant-trust-profile-types';

export type TrustPolicyKind = 'returns' | 'shipping' | 'warranty';

export interface TrustPolicyPageClientProps {
  kind: TrustPolicyKind;
  merchantName: string;
  contactHref?: string;
  trustProfile: MerchantTrustProfile;
}

function formatReturnMethod(method?: MerchantTrustProfileReturnMethod): string {
  switch (method) {
    case 'mail':
      return 'Mail';
    case 'in_store':
      return 'In store';
    case 'carrier_dropoff':
      return 'Carrier drop-off';
    default:
      return 'Not specified';
  }
}

function formatReturnFee(fee?: MerchantTrustProfileReturnFee): string {
  switch (fee) {
    case 'free':
      return 'Free';
    case 'customer_pays':
      return 'Customer pays';
    case 'original_shipping_deducted':
      return 'Original shipping deducted';
    default:
      return 'Not specified';
  }
}

function formatShippingFeeType(
  feeType?: MerchantTrustProfileShippingFeeType
): string {
  switch (feeType) {
    case 'free':
      return 'Free';
    case 'flat_rate':
      return 'Flat rate';
    case 'calculated':
      return 'Calculated';
    default:
      return 'Not specified';
  }
}

function formatDayRange(min?: number, max?: number): string {
  if (min != null && max != null) {
    return min === max ? `${min} business days` : `${min}-${max} business days`;
  }

  if (min != null) {
    return `${min} business days`;
  }

  if (max != null) {
    return `${max} business days`;
  }

  return 'Not specified';
}

function getPolicyTitle(kind: TrustPolicyKind): string {
  switch (kind) {
    case 'returns':
      return 'Returns Policy';
    case 'shipping':
      return 'Shipping Policy';
    case 'warranty':
      return 'Warranty Policy';
  }
}

function getPolicySummary(
  kind: TrustPolicyKind,
  trustProfile: MerchantTrustProfile
): string {
  switch (kind) {
    case 'returns':
      return trustProfile.returnPolicy?.summary || '';
    case 'shipping':
      return trustProfile.shippingPolicy?.summary || '';
    case 'warranty':
      return trustProfile.warrantyPolicy?.summary || '';
  }
}

function getPolicyFacts(
  kind: TrustPolicyKind,
  trustProfile: MerchantTrustProfile
): Array<{ label: string; value: string }> {
  switch (kind) {
    case 'returns':
      return [
        {
          label: 'Return window',
          value:
            trustProfile.returnPolicy?.windowDays != null
              ? `${trustProfile.returnPolicy.windowDays} days`
              : 'Not specified',
        },
        {
          label: 'Return method',
          value: formatReturnMethod(trustProfile.returnPolicy?.returnMethod),
        },
        {
          label: 'Return fees',
          value: formatReturnFee(trustProfile.returnPolicy?.returnFees),
        },
      ];
    case 'shipping':
      return [
        {
          label: 'Regions',
          value:
            trustProfile.shippingPolicy?.regions?.join(', ') || 'Not specified',
        },
        {
          label: 'Handling time',
          value: formatDayRange(
            trustProfile.shippingPolicy?.handlingDaysMin,
            trustProfile.shippingPolicy?.handlingDaysMax
          ),
        },
        {
          label: 'Transit time',
          value: formatDayRange(
            trustProfile.shippingPolicy?.transitDaysMin,
            trustProfile.shippingPolicy?.transitDaysMax
          ),
        },
        {
          label: 'Shipping fees',
          value: formatShippingFeeType(
            trustProfile.shippingPolicy?.shippingFeeType
          ),
        },
      ];
    case 'warranty':
      return [
        {
          label: 'Coverage',
          value: trustProfile.warrantyPolicy?.summary || 'Not specified',
        },
      ];
  }
}

export function TrustPolicyPageClient({
  kind,
  merchantName,
  contactHref,
  trustProfile,
}: TrustPolicyPageClientProps) {
  const summary = getPolicySummary(kind, trustProfile);
  const facts = getPolicyFacts(kind, trustProfile);

  return (
    <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16 lg:py-20">
      <section className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-neutral-500">
          {merchantName}
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-neutral-950 sm:text-4xl">
          {getPolicyTitle(kind)}
        </h1>
        {summary ? (
          <p className="mt-4 text-base leading-7 text-neutral-700">{summary}</p>
        ) : null}

        <dl className="mt-8 grid gap-4 sm:grid-cols-2">
          {facts.map((fact) => (
            <div
              key={fact.label}
              className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4"
            >
              <dt className="text-sm font-medium text-neutral-500">
                {fact.label}
              </dt>
              <dd className="mt-2 text-base font-medium text-neutral-900">
                {fact.value}
              </dd>
            </div>
          ))}
        </dl>

        {contactHref ? (
          <div className="mt-8">
            <a
              href={contactHref}
              className="inline-flex items-center rounded-full border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-900 transition-colors hover:border-neutral-400 hover:bg-neutral-100"
            >
              Contact us
            </a>
          </div>
        ) : null}
      </section>
    </main>
  );
}
