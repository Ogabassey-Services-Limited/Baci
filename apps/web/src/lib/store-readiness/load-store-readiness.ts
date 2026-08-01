import 'server-only';

import type { StoreReadiness, StoreReadinessSurface } from '@baci/shared';
import type { SupabaseClient } from '@supabase/supabase-js';
import { hasPermission, type UserAccess } from '@/lib/api-auth';
import {
  buildStoreBuildStatus,
  type StorefrontBuildJob,
} from '@/lib/store-build-status';
import { unknownValueGuards } from '@/lib/unknown-value-guards';
import type { Database } from '@/types/supabase';
import { buildStoreReadiness } from './build-store-readiness';
import { hasActiveTemplateHero } from './has-active-template-hero';
import { hasPublishedHero } from './has-published-hero';
import { loadStoreLaunchReadiness } from './load-store-launch-readiness';

export interface LoadStoreReadinessInput {
  supabase: SupabaseClient<Database>;
  merchantId: string;
  access: UserAccess;
  surface: StoreReadinessSurface;
}

const WEB_OPTIONAL_MERCHANT_READINESS_COLUMNS =
  'is_published, pages, about_page, business_address, social_media, google_analytics_id, facebook_pixel_id, tiktok_pixel_id, snapchat_pixel_id, twitter_pixel_id, template_id, business_type';

const MOBILE_OPTIONAL_MERCHANT_READINESS_COLUMNS =
  'is_published, business_address, social_media, google_analytics_id, facebook_pixel_id, tiktok_pixel_id, snapchat_pixel_id, twitter_pixel_id, template_id, business_type';

type ReadinessOptionalMerchant = Pick<
  Database['public']['Tables']['merchants']['Row'],
  | 'business_address'
  | 'business_type'
  | 'about_page'
  | 'facebook_pixel_id'
  | 'google_analytics_id'
  | 'is_published'
  | 'pages'
  | 'snapchat_pixel_id'
  | 'social_media'
  | 'tiktok_pixel_id'
  | 'template_id'
  | 'twitter_pixel_id'
>;

function getOptionalMerchantReadinessColumns(surface: StoreReadinessSurface) {
  return surface === 'web'
    ? WEB_OPTIONAL_MERCHANT_READINESS_COLUMNS
    : MOBILE_OPTIONAL_MERCHANT_READINESS_COLUMNS;
}

function throwQueryError(source: string, error: { message: string }): never {
  throw new Error(`Failed to load ${source}: ${error.message}`);
}

function requireAuthorizedMerchantId(
  access: unknown,
  merchantId: unknown
): string {
  const normalizedMerchantId =
    typeof merchantId === 'string' ? merchantId.trim() : null;

  if (
    !normalizedMerchantId ||
    !unknownValueGuards.isRecord(access) ||
    access.merchantId !== normalizedMerchantId
  ) {
    throw new Error(
      'Store readiness merchant does not match the authorized merchant'
    );
  }

  return normalizedMerchantId;
}

async function loadReadinessOptionalMerchant(
  supabase: SupabaseClient<Database>,
  merchantId: string,
  surface: StoreReadinessSurface
) {
  const result = await supabase
    .from('merchants')
    .select(getOptionalMerchantReadinessColumns(surface))
    .eq('id', merchantId)
    .maybeSingle<ReadinessOptionalMerchant>();

  if (result.error) throwQueryError('merchant readiness details', result.error);
  if (!result.data) {
    throw new Error(
      'Failed to load merchant readiness details: merchant not found'
    );
  }

  return result.data;
}

async function loadHomePageConfig(
  supabase: SupabaseClient<Database>,
  merchantId: string
) {
  const result = await supabase
    .from('page_configs')
    .select('id, published_config, is_published')
    .eq('merchant_id', merchantId)
    .eq('page_slug', 'home')
    .maybeSingle();

  if (result.error) throwQueryError('home page configuration', result.error);
  return result.data;
}

async function loadLatestStorefrontJob(
  supabase: SupabaseClient<Database>,
  merchantId: string
) {
  const result = await supabase
    .from('ai_jobs')
    .select('id, status, result_applied_at')
    .eq('merchant_id', merchantId)
    .eq('type', 'storefront_layout_generation')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle<StorefrontBuildJob>();

  if (result.error) throwQueryError('storefront build status', result.error);
  return result.data;
}

/**
 * Builds the complete route-neutral DTO from the authorized caller's client.
 * Required launch facts deliberately flow through the shared launch loader.
 */
export async function loadStoreReadiness({
  supabase,
  merchantId,
  access,
  surface,
}: LoadStoreReadinessInput): Promise<StoreReadiness> {
  const authorizedMerchantId = requireAuthorizedMerchantId(access, merchantId);

  const [
    launchReadiness,
    optionalMerchant,
    homePageConfig,
    latestStorefrontJob,
  ] = await Promise.all([
    loadStoreLaunchReadiness({ supabase, merchantId: authorizedMerchantId }),
    loadReadinessOptionalMerchant(supabase, authorizedMerchantId, surface),
    loadHomePageConfig(supabase, authorizedMerchantId),
    loadLatestStorefrontJob(supabase, authorizedMerchantId),
  ]);

  const hasPublishedHomeConfig = homePageConfig?.is_published === true;
  const hasPublishedHomeHero = hasActiveTemplateHero(
    optionalMerchant.template_id,
    optionalMerchant.business_type
  )
    ? true
    : hasPublishedHomeConfig &&
      hasPublishedHero(homePageConfig?.published_config);

  return buildStoreReadiness(
    {
      ...launchReadiness.facts,
      isPublished: optionalMerchant.is_published === true,
      businessAddress: optionalMerchant.business_address,
      aboutPage:
        surface === 'web' ? (optionalMerchant.about_page ?? null) : null,
      templateId: optionalMerchant.template_id,
      pages:
        surface === 'web' && unknownValueGuards.isRecord(optionalMerchant.pages)
          ? optionalMerchant.pages
          : null,
      socialMedia: unknownValueGuards.isRecord(optionalMerchant.social_media)
        ? optionalMerchant.social_media
        : null,
      analyticsIds: [
        optionalMerchant.google_analytics_id,
        optionalMerchant.facebook_pixel_id,
        optionalMerchant.tiktok_pixel_id,
        optionalMerchant.snapchat_pixel_id,
        optionalMerchant.twitter_pixel_id,
      ],
      hasPublishedHero: hasPublishedHomeHero,
      storeBuild: buildStoreBuildStatus(
        Boolean(homePageConfig),
        latestStorefrontJob,
        hasPermission(access, 'builder', 'edit')
      ),
    },
    surface
  );
}
