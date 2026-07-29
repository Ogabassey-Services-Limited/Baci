export const STORE_READINESS_ITEM_IDS = [
  'verify_kyc',
  'bank_account',
  'payment_method',
  'store_url',
  'first_product',
  'country',
  'contact_info',
  'about_page',
  'privacy_policy',
  'terms_conditions',
  'business_address',
  'hero_carousel',
  'social_media',
  'analytics',
  'multiple_products',
] as const;

export type StoreReadinessItemId = (typeof STORE_READINESS_ITEM_IDS)[number];

export const STORE_LAUNCH_READINESS_ITEM_IDS = [
  'verify_kyc',
  'bank_account',
  'payment_method',
  'store_url',
  'first_product',
  'country',
  'contact_info',
] as const satisfies readonly StoreReadinessItemId[];

export type StoreLaunchReadinessItemId =
  (typeof STORE_LAUNCH_READINESS_ITEM_IDS)[number];

export const STORE_READINESS_SURFACES = ['web', 'mobile'] as const;
export type StoreReadinessSurface = (typeof STORE_READINESS_SURFACES)[number];

export const MOBILE_STORE_READINESS_ITEM_IDS = [
  'verify_kyc',
  'bank_account',
  'payment_method',
  'store_url',
  'first_product',
  'country',
  'contact_info',
  'business_address',
  'hero_carousel',
  'social_media',
  'analytics',
  'multiple_products',
] as const satisfies readonly StoreReadinessItemId[];

export const WEB_STORE_READINESS_ITEM_IDS = STORE_READINESS_ITEM_IDS;

export type MobileStoreReadinessItemId =
  (typeof MOBILE_STORE_READINESS_ITEM_IDS)[number];
export type WebStoreReadinessItemId =
  (typeof WEB_STORE_READINESS_ITEM_IDS)[number];

export interface StoreReadinessItem<
  Id extends StoreReadinessItemId = StoreReadinessItemId,
> {
  id: Id;
  label: string;
  description: string;
  completed: boolean;
  priority: 'required' | 'recommended' | 'optional';
  category: 'payments' | 'products' | 'store' | 'legal' | 'marketing';
}

export interface StoreBuildStatus {
  starterStoreReady: boolean;
  aiStatus:
    | 'not_started'
    | 'pending'
    | 'processing'
    | 'ready'
    | 'applied'
    | 'failed';
  latestJobId: string | null;
  canApplyAiDraft: boolean;
  message: string;
}

interface StoreReadinessBase {
  merchantId: string;
  isReady: boolean;
  isPublished: boolean;
  completedRequired: number;
  totalRequired: number;
  completedRecommended: number;
  totalRecommended: number;
  overallProgress: number;
  storeBuild: StoreBuildStatus;
}

export interface MobileStoreReadiness extends StoreReadinessBase {
  surface: 'mobile';
  items: StoreReadinessItem<MobileStoreReadinessItemId>[];
}

export interface WebStoreReadiness extends StoreReadinessBase {
  surface: 'web';
  items: StoreReadinessItem<WebStoreReadinessItemId>[];
}

export type StoreReadiness = MobileStoreReadiness | WebStoreReadiness;

const STORE_READINESS_KEYS = [
  'merchantId',
  'surface',
  'isReady',
  'isPublished',
  'completedRequired',
  'totalRequired',
  'completedRecommended',
  'totalRecommended',
  'overallProgress',
  'items',
  'storeBuild',
] as const;
const STORE_READINESS_ITEM_KEYS = [
  'id',
  'label',
  'description',
  'completed',
  'priority',
  'category',
] as const;
const STORE_BUILD_STATUS_KEYS = [
  'starterStoreReady',
  'aiStatus',
  'latestJobId',
  'canApplyAiDraft',
  'message',
] as const;
const STORE_READINESS_ITEM_PRIORITIES = [
  'required',
  'recommended',
  'optional',
] as const;
const STORE_READINESS_ITEM_CATEGORIES = [
  'payments',
  'products',
  'store',
  'legal',
  'marketing',
] as const;
const STORE_BUILD_AI_STATUSES = [
  'not_started',
  'pending',
  'processing',
  'ready',
  'applied',
  'failed',
] as const;
function hasExactKeys(
  value: Record<string, unknown>,
  expectedKeys: readonly string[]
): boolean {
  const actualKeys = Reflect.ownKeys(value);

  return (
    actualKeys.length === expectedKeys.length &&
    actualKeys.every(
      (key) => typeof key === 'string' && expectedKeys.includes(key)
    )
  );
}
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function isNonNegativeCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

function isStoreBuildStatus(value: unknown): value is StoreBuildStatus {
  if (!isRecord(value) || !hasExactKeys(value, STORE_BUILD_STATUS_KEYS)) {
    return false;
  }

  return (
    typeof value.starterStoreReady === 'boolean' &&
    typeof value.canApplyAiDraft === 'boolean' &&
    typeof value.message === 'string' &&
    (typeof value.latestJobId === 'string' || value.latestJobId === null) &&
    typeof value.aiStatus === 'string' &&
    STORE_BUILD_AI_STATUSES.includes(
      value.aiStatus as (typeof STORE_BUILD_AI_STATUSES)[number]
    )
  );
}

function isStoreReadinessItem(
  value: unknown,
  allowedItemIds: readonly StoreReadinessItemId[]
): value is StoreReadinessItem {
  if (!isRecord(value) || !hasExactKeys(value, STORE_READINESS_ITEM_KEYS)) {
    return false;
  }

  return (
    typeof value.id === 'string' &&
    allowedItemIds.includes(value.id as StoreReadinessItemId) &&
    typeof value.label === 'string' &&
    typeof value.description === 'string' &&
    typeof value.completed === 'boolean' &&
    typeof value.priority === 'string' &&
    STORE_READINESS_ITEM_PRIORITIES.includes(
      value.priority as (typeof STORE_READINESS_ITEM_PRIORITIES)[number]
    ) &&
    typeof value.category === 'string' &&
    STORE_READINESS_ITEM_CATEGORIES.includes(
      value.category as (typeof STORE_READINESS_ITEM_CATEGORIES)[number]
    )
  );
}

function hasConsistentReadinessMetrics(value: {
  completedRecommended: number;
  completedRequired: number;
  items: unknown[];
  overallProgress: number;
  totalRecommended: number;
  totalRequired: number;
}): boolean {
  const items: StoreReadinessItem[] = [];
  const itemIds = new Set<StoreReadinessItemId>();
  for (const item of value.items) {
    if (!isStoreReadinessItem(item, STORE_READINESS_ITEM_IDS)) return false;
    if (itemIds.has(item.id)) return false;
    itemIds.add(item.id);
    items.push(item);
  }

  const requiredItems = items.filter((item) => item.priority === 'required');
  const recommendedItems = items.filter(
    (item) => item.priority === 'recommended'
  );
  const completedItems = items.filter((item) => item.completed).length;
  const expectedProgress =
    items.length === 0 ? 0 : Math.round((completedItems / items.length) * 100);

  return (
    value.completedRequired ===
      requiredItems.filter((item) => item.completed).length &&
    value.totalRequired === requiredItems.length &&
    value.completedRecommended ===
      recommendedItems.filter((item) => item.completed).length &&
    value.totalRecommended === recommendedItems.length &&
    value.overallProgress === expectedProgress
  );
}

export function isStoreReadiness(value: unknown): value is StoreReadiness {
  if (!isRecord(value) || !hasExactKeys(value, STORE_READINESS_KEYS)) {
    return false;
  }

  if (
    typeof value.merchantId !== 'string' ||
    value.merchantId.trim() === '' ||
    typeof value.surface !== 'string' ||
    !STORE_READINESS_SURFACES.includes(
      value.surface as StoreReadinessSurface
    ) ||
    typeof value.isReady !== 'boolean' ||
    typeof value.isPublished !== 'boolean' ||
    !isNonNegativeCount(value.completedRequired) ||
    !isNonNegativeCount(value.totalRequired) ||
    !isNonNegativeCount(value.completedRecommended) ||
    !isNonNegativeCount(value.totalRecommended) ||
    value.completedRequired > value.totalRequired ||
    value.completedRecommended > value.totalRecommended ||
    typeof value.overallProgress !== 'number' ||
    !Number.isFinite(value.overallProgress) ||
    value.overallProgress < 0 ||
    value.overallProgress > 100 ||
    !Array.isArray(value.items) ||
    !isStoreBuildStatus(value.storeBuild)
  ) {
    return false;
  }

  const allowedItemIds =
    value.surface === 'mobile'
      ? MOBILE_STORE_READINESS_ITEM_IDS
      : WEB_STORE_READINESS_ITEM_IDS;

  return (
    value.items.every((item) => isStoreReadinessItem(item, allowedItemIds)) &&
    hasConsistentReadinessMetrics({
      completedRecommended: value.completedRecommended,
      completedRequired: value.completedRequired,
      items: value.items,
      overallProgress: value.overallProgress,
      totalRecommended: value.totalRecommended,
      totalRequired: value.totalRequired,
    })
  );
}
