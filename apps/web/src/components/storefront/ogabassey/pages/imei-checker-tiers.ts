import {
  BadgeCheck,
  Globe,
  ShieldAlert,
  Sparkles,
  type LucideIcon,
} from 'lucide-react';
import {
  IMEI_SERVICE_TIERS,
  PRIMARY_IMEI_SERVICE_TIERS,
  type ImeiServiceTierKey,
} from '@baci/shared/imei';

const TIER_ICONS = {
  activation: Sparkles,
  blacklist: ShieldAlert,
  carrier: Globe,
  full: BadgeCheck,
} as const satisfies Record<PrimaryServiceTier, LucideIcon>;

const currencyFormatter = new Intl.NumberFormat('en-NG', {
  currency: 'NGN',
  maximumFractionDigits: 0,
  style: 'currency',
});

type PrimaryServiceTier = (typeof PRIMARY_IMEI_SERVICE_TIERS)[number];

type PublicServiceTier = {
  features: readonly string[];
  icon: LucideIcon;
  id: ImeiServiceTierKey;
  name: string;
  price: number;
  priceDisplay: string;
  recommended?: boolean;
  tagline: string;
};

function buildPublicServiceTier(tierKey: PrimaryServiceTier): PublicServiceTier {
  const tier = IMEI_SERVICE_TIERS[tierKey];

  return {
    features: tier.features,
    icon: TIER_ICONS[tierKey],
    id: tierKey,
    name: tier.name,
    price: tier.price,
    priceDisplay: currencyFormatter.format(tier.price),
    recommended: 'recommended' in tier ? tier.recommended : undefined,
    tagline: tier.tagline,
  };
}

export const SERVICE_TIERS = {
  full: buildPublicServiceTier('full'),
  activation: buildPublicServiceTier('activation'),
  blacklist: buildPublicServiceTier('blacklist'),
  carrier: buildPublicServiceTier('carrier'),
} as const satisfies Record<PrimaryServiceTier, PublicServiceTier>;

export type ServiceTier = keyof typeof SERVICE_TIERS;
