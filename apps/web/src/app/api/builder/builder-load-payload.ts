import type { SupabaseClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { generateDefaultConfig } from '@/lib/builder-defaults';
import type {
  BuilderConfigInput,
  BuilderDegradedReason,
} from '@/schemas/builder';
import { builderConfigSchema } from '@/schemas/builder';
import { loadAiStorefrontDraftPreview } from './ai-draft-preview';

const MINIMAL_BUILDER_CONFIG: BuilderConfigInput = {
  content: [],
  root: { title: 'Home' },
  zones: {},
};

interface MerchantTemplateData extends Record<string, unknown> {
  id: string;
  business_name: string | null;
  business_type: string | null;
  brand_colors: Record<string, unknown> | null;
  logo_url: string | null;
  hero_image_ids: string[] | null;
}

interface PageConfigRecord {
  draft_config: BuilderConfigInput | null;
  published_config: BuilderConfigInput | null;
  draft_seo: unknown | null;
  draft_store_settings: unknown | null;
  draft_setup_settings: unknown | null;
  is_published: boolean | null;
  updated_at: string | null;
}

export interface BuilderLoadPayload {
  config: BuilderConfigInput;
  seo: unknown | null;
  storeSettings: unknown | null;
  setupSettings: unknown | null;
  publishedConfig: BuilderConfigInput | null;
  isPublished: boolean;
  isDefault: boolean;
  lastUpdated: string | null;
  degraded: boolean;
  degradedReason: BuilderDegradedReason | null;
  canEdit: boolean;
  previewMode: 'ai_draft' | null;
  aiDraftJobId: string | null;
  canApplyAiDraft: boolean;
}

export type BuilderLoadResult =
  | { response: NextResponse; data?: never }
  | { data: BuilderLoadPayload; response?: never };

async function resolveDefaultBuilderConfig(
  merchant: MerchantTemplateData
): Promise<{
  config: BuilderConfigInput;
  degradedReason: BuilderDegradedReason | null;
}> {
  try {
    const generatedConfig = await generateDefaultConfig(merchant);
    const validatedConfig = builderConfigSchema.safeParse(generatedConfig);
    if (!validatedConfig.success) {
      console.error(
        'Generated default builder config failed validation:',
        validatedConfig.error.flatten()
      );
      return {
        config: MINIMAL_BUILDER_CONFIG,
        degradedReason: 'default_generation_failed',
      };
    }

    return {
      config: validatedConfig.data,
      degradedReason: null,
    };
  } catch (error) {
    console.error('Failed to generate default builder config:', error);
    return {
      config: MINIMAL_BUILDER_CONFIG,
      degradedReason: 'default_generation_failed',
    };
  }
}

function getMerchantTemplateData(supabase: SupabaseClient, merchantId: string) {
  return supabase
    .from('merchants')
    .select(
      'id, business_name, business_type, brand_colors, logo_url, hero_image_ids'
    )
    .eq('id', merchantId)
    .single<MerchantTemplateData>();
}

function getPageConfig(
  supabase: SupabaseClient,
  merchantId: string,
  pageSlug: string
) {
  return supabase
    .from('page_configs')
    .select(
      'id, draft_config, published_config, draft_seo, draft_store_settings, draft_setup_settings, is_published, updated_at'
    )
    .eq('merchant_id', merchantId)
    .eq('page_slug', pageSlug)
    .maybeSingle<PageConfigRecord>();
}

export async function loadBuilderPayload(
  supabase: SupabaseClient,
  merchantId: string,
  pageSlug: string,
  canEdit: boolean,
  aiDraftJobId?: string
): Promise<BuilderLoadResult> {
  const { data: merchant, error: merchantError } =
    await getMerchantTemplateData(supabase, merchantId);

  if (merchantError || !merchant) {
    return {
      response: NextResponse.json(
        { error: 'Merchant not found' },
        { status: 404 }
      ),
    };
  }

  if (aiDraftJobId) {
    return loadAiStorefrontDraftPreview(
      supabase,
      merchantId,
      aiDraftJobId,
      canEdit
    );
  }

  const { data: pageConfig, error: configError } = await getPageConfig(
    supabase,
    merchantId,
    pageSlug
  );

  let degradedReason: BuilderDegradedReason | null = null;
  if (configError && configError.code !== 'PGRST116') {
    console.error('Failed to load page config, falling back to default:', {
      merchantId,
      pageSlug,
      code: configError.code,
      message: configError.message,
    });
    degradedReason = 'config_load_failed';
  }

  let configToEdit: BuilderConfigInput | null = null;
  let isDefault = false;

  if (pageConfig?.draft_config) {
    configToEdit = pageConfig.draft_config;
  } else if (pageConfig?.published_config) {
    configToEdit = pageConfig.published_config;
  } else {
    const defaultResult = await resolveDefaultBuilderConfig(merchant);
    configToEdit = defaultResult.config;
    degradedReason = degradedReason ?? defaultResult.degradedReason;
    isDefault = true;
  }

  return {
    data: {
      config: configToEdit ?? MINIMAL_BUILDER_CONFIG,
      seo: pageConfig?.draft_seo || null,
      storeSettings: pageConfig?.draft_store_settings || null,
      setupSettings: pageConfig?.draft_setup_settings || null,
      publishedConfig: pageConfig?.published_config || null,
      isPublished: pageConfig?.is_published || false,
      isDefault,
      lastUpdated: pageConfig?.updated_at || null,
      degraded: degradedReason !== null,
      degradedReason,
      canEdit: degradedReason === null && canEdit,
      previewMode: null,
      aiDraftJobId: null,
      canApplyAiDraft: false,
    },
  };
}
