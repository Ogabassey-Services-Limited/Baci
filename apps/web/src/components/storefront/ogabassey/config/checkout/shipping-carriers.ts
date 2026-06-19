interface CarrierBadgeConfig {
  readonly match: string;
  readonly label: string;
  readonly className: string;
}

const CARRIER_BADGES: readonly CarrierBadgeConfig[] = [
  {
    match: 'GIG',
    label: 'GIGL',
    className: 'bg-store-background-text text-store-background',
  },
  {
    match: 'Topship',
    label: 'Best Value',
    className: 'bg-store-primary text-store-primary-text',
  },
] as const;

export function getCarrierBadge(carrierName: string) {
  return CARRIER_BADGES.find((badge) => carrierName.includes(badge.match));
}
