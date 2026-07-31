import {
  MOBILE_STORE_READINESS_ITEM_IDS,
  SOCIAL_MEDIA_KEYS,
  type StoreBuildStatus,
  type StoreReadiness,
  type StoreReadinessItem,
  type StoreReadinessItemId,
  type StoreReadinessSurface,
  WEB_STORE_READINESS_ITEM_IDS,
} from '@baci/shared';
import type { LaunchPaymentRequirement } from '@/lib/checkout/payment-gateway-availability';
import {
  buildStoreLaunchReadiness,
  type StoreLaunchFacts,
} from './build-store-launch-readiness';
import { hasMeaningfulAboutPage } from './has-meaningful-about-page';

export interface StoreReadinessFacts extends StoreLaunchFacts {
  isPublished: boolean;
  businessAddress: string | null;
  aboutPage?: unknown;
  templateId?: string | null;
  pages: Record<string, unknown> | null;
  socialMedia: Record<string, unknown> | null;
  analyticsIds: readonly (string | null)[];
  hasPublishedHero: boolean;
  storeBuild: StoreBuildStatus;
  paymentRequirement: LaunchPaymentRequirement;
}

function hasText(value: unknown): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}

function hasNonEmptyValue(value: unknown): boolean {
  if (hasText(value)) return true;
  if (Array.isArray(value)) return value.length > 0;
  return (
    typeof value === 'object' && value !== null && Object.keys(value).length > 0
  );
}

function filterItems<Id extends StoreReadinessItemId>(
  items: readonly StoreReadinessItem[],
  allowedIds: readonly Id[]
): StoreReadinessItem<Id>[] {
  return items.filter((item): item is StoreReadinessItem<Id> =>
    allowedIds.includes(item.id as Id)
  );
}

function calculateReadinessMetrics(items: readonly StoreReadinessItem[]) {
  const requiredItems = items.filter((item) => item.priority === 'required');
  const recommendedItems = items.filter(
    (item) => item.priority === 'recommended'
  );
  const completedRequired = requiredItems.filter(
    (item) => item.completed
  ).length;
  const completedRecommended = recommendedItems.filter(
    (item) => item.completed
  ).length;
  const completedItems = items.filter((item) => item.completed).length;

  return {
    completedRequired,
    totalRequired: requiredItems.length,
    completedRecommended,
    totalRecommended: recommendedItems.length,
    overallProgress: Math.round((completedItems / items.length) * 100),
  };
}

export function buildStoreReadiness(
  facts: StoreReadinessFacts,
  surface: StoreReadinessSurface
): StoreReadiness {
  const launch = buildStoreLaunchReadiness(facts);
  const items: StoreReadinessItem[] = [
    ...launch.items,
    {
      id: 'about_page',
      label: 'Fill in About Us page',
      description: 'Tell your story and build trust with customers',
      completed:
        hasNonEmptyValue(facts.pages?.about) ||
        hasMeaningfulAboutPage(facts.aboutPage, facts.templateId),
      priority: 'recommended',
      category: 'legal',
    },
    {
      id: 'privacy_policy',
      label: 'Add Privacy Policy',
      description: 'Legal requirement for online stores',
      completed: hasNonEmptyValue(facts.pages?.privacy),
      priority: 'recommended',
      category: 'legal',
    },
    {
      id: 'terms_conditions',
      label: 'Add Terms & Conditions',
      description: 'Protect your business with clear terms',
      completed: hasNonEmptyValue(facts.pages?.terms),
      priority: 'recommended',
      category: 'legal',
    },
    {
      id: 'business_address',
      label: 'Add business address',
      description: 'Builds trust and may be legally required',
      completed: hasText(facts.businessAddress),
      priority: 'recommended',
      category: 'store',
    },
    {
      id: 'hero_carousel',
      label: 'Set up hero carousel',
      description: 'Add eye-catching banners to your homepage',
      completed: facts.hasPublishedHero,
      priority: 'recommended',
      category: 'marketing',
    },
    {
      id: 'social_media',
      label: 'Connect social media',
      description: 'Link your social profiles for better engagement',
      completed: SOCIAL_MEDIA_KEYS.some((key) =>
        hasText(facts.socialMedia?.[key])
      ),
      priority: 'optional',
      category: 'marketing',
    },
    {
      id: 'analytics',
      label: 'Set up analytics',
      description: 'Track visitors and conversions',
      completed: facts.analyticsIds.some(hasText),
      priority: 'optional',
      category: 'marketing',
    },
    {
      id: 'multiple_products',
      label: 'Add more products',
      description: 'Stores with 5+ published products convert better',
      completed: facts.activeProductCount >= 5,
      priority: 'optional',
      category: 'products',
    },
  ];
  const base = {
    merchantId: facts.merchantId,
    isReady: launch.isReady,
    isPublished: facts.isPublished,
    storeBuild: facts.storeBuild,
  };

  if (surface === 'mobile') {
    const mobileItems = filterItems(items, MOBILE_STORE_READINESS_ITEM_IDS);
    return {
      ...base,
      ...calculateReadinessMetrics(mobileItems),
      surface,
      items: mobileItems,
    };
  }

  const webItems = filterItems(items, WEB_STORE_READINESS_ITEM_IDS);
  return {
    ...base,
    ...calculateReadinessMetrics(webItems),
    surface,
    items: webItems,
  };
}
