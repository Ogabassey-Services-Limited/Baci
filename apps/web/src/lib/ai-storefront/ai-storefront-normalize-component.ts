import type { AiStorefrontComponent } from '@/schemas/ai-storefront-layout';
import {
  normalizeFooter,
  normalizeHeader,
  normalizeHero,
  normalizeProductGrid,
} from './ai-storefront-normalize-primary';
import {
  normalizeFeatures,
  normalizeNewsletter,
  normalizeTrustBadges,
} from './ai-storefront-normalize-support';
import {
  asRecord,
  KNOWN_COMPONENT_TYPES,
  type KnownComponentType,
} from './ai-storefront-normalize-types';

function isKnownComponentType(type: unknown): type is KnownComponentType {
  return (
    typeof type === 'string' &&
    KNOWN_COMPONENT_TYPES.includes(type as KnownComponentType)
  );
}

export function normalizeComponent(
  businessName: string,
  value: unknown,
  index: number
): AiStorefrontComponent | null {
  const record = asRecord(value);
  const props = asRecord(record.props);
  const type = record.type;

  if (!isKnownComponentType(type)) return null;

  switch (type) {
    case 'Header':
      return normalizeHeader(props, index);
    case 'Hero':
      return normalizeHero(businessName, props, index);
    case 'Features':
      return normalizeFeatures(props, index);
    case 'ProductGrid':
      return normalizeProductGrid(props, index);
    case 'TrustBadges':
      return normalizeTrustBadges(props, index);
    case 'Newsletter':
      return normalizeNewsletter(props, index);
    case 'Footer':
      return normalizeFooter(businessName, props, index);
    default:
      return null;
  }
}
