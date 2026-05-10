import type { SupabaseClient } from '@supabase/supabase-js';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { hasPermission } from '@/lib/api-auth';
import { generateDefaultConfig } from '@/lib/builder-defaults';
import {
  getMerchantForApiRequest,
  toUserAccess,
} from '@/lib/get-merchant-for-api-request';
import { getAuthenticatedUser } from '@/lib/supabase/mobile-auth';
import type {
  BuilderConfigInput,
  BuilderCreateInput,
  BuilderDegradedReason,
  BuilderPublishInput,
} from '@/schemas/builder';
import { builderConfigSchema } from '@/schemas/builder';

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

interface PageConfigMetaRecord {
  id: string;
  updated_at: string | null;
}

interface PageConfigRecord extends PageConfigMetaRecord {
  draft_config: BuilderConfigInput | null;
  published_config: BuilderConfigInput | null;
  draft_seo: unknown | null;
  draft_store_settings: unknown | null;
  draft_setup_settings: unknown | null;
  is_published: boolean | null;
}

interface PublishablePageConfigRecord extends PageConfigMetaRecord {
  draft_config: BuilderConfigInput | null;
  published_config: BuilderConfigInput | null;
  draft_seo: unknown | null;
  draft_store_settings: unknown | null;
  draft_setup_settings: unknown | null;
}

interface BuilderRequestContext {
  merchantId: string;
  supabase: SupabaseClient;
  canEdit: boolean;
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
}

export type BuilderLoadResult =
  | { response: NextResponse; data?: never }
  | { data: BuilderLoadPayload; response?: never };

type BuilderContextResult =
  | { context: BuilderRequestContext; response?: never }
  | { response: NextResponse; context?: never };

type MutationResult =
  | { response: NextResponse; data?: never; lastUpdated?: never }
  | {
      response?: never;
      data: Record<string, unknown>;
      lastUpdated: string | null;
    };

function createConflictResponse() {
  return NextResponse.json(
    {
      error: 'Builder draft is out of date',
      code: 'stale_builder_draft',
      message:
        'This builder draft changed in another session. Refresh the page to continue editing the latest version.',
    },
    { status: 409 }
  );
}

function createInternalServerErrorResponse(message = 'Internal server error') {
  return NextResponse.json({ error: message }, { status: 500 });
}

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

function getPageConfigMeta(
  supabase: SupabaseClient,
  merchantId: string,
  pageSlug: string
) {
  return supabase
    .from('page_configs')
    .select('id, updated_at')
    .eq('merchant_id', merchantId)
    .eq('page_slug', pageSlug)
    .maybeSingle<PageConfigMetaRecord>();
}

function getPublishablePageConfig(
  supabase: SupabaseClient,
  merchantId: string,
  pageSlug: string
) {
  return supabase
    .from('page_configs')
    .select(
      'id, draft_config, published_config, draft_seo, draft_store_settings, draft_setup_settings, updated_at'
    )
    .eq('merchant_id', merchantId)
    .eq('page_slug', pageSlug)
    .maybeSingle<PublishablePageConfigRecord>();
}

function isConflict(
  expectedLastUpdated: string | null | undefined,
  currentLastUpdated: string | null
) {
  return (
    expectedLastUpdated !== undefined &&
    expectedLastUpdated !== currentLastUpdated
  );
}

export async function getBuilderRequestContext(
  request: NextRequest,
  action: 'view' | 'edit'
): Promise<BuilderContextResult> {
  const auth = await getAuthenticatedUser(request);
  if (!auth) {
    return {
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    };
  }

  const { user, supabase } = auth;
  const merchantContext = await getMerchantForApiRequest(supabase, user.id);
  if (!merchantContext) {
    return {
      response: NextResponse.json(
        { error: 'Merchant not found' },
        { status: 404 }
      ),
    };
  }

  const access = toUserAccess(merchantContext);
  if (!hasPermission(access, 'builder', action)) {
    return {
      response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }),
    };
  }

  return {
    context: {
      merchantId: merchantContext.merchantId,
      supabase,
      canEdit: hasPermission(access, 'builder', 'edit'),
    },
  };
}

export async function loadBuilderPayload(
  supabase: SupabaseClient,
  merchantId: string,
  pageSlug: string,
  canEdit: boolean
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
    },
  };
}

export async function saveBuilderDraft(
  supabase: SupabaseClient,
  merchantId: string,
  input: BuilderCreateInput
): Promise<MutationResult> {
  const {
    slug,
    config,
    name,
    seo,
    storeSettings,
    setupSettings,
    expectedLastUpdated,
  } = input;

  const { data: currentConfig, error: currentConfigError } =
    await getPageConfigMeta(supabase, merchantId, slug);

  if (currentConfigError && currentConfigError.code !== 'PGRST116') {
    return {
      response: createInternalServerErrorResponse(),
    };
  }

  if (isConflict(expectedLastUpdated, currentConfig?.updated_at || null)) {
    return { response: createConflictResponse() };
  }

  const updatedAt = new Date().toISOString();

  if (currentConfig) {
    const { data, error } = await supabase
      .from('page_configs')
      .update({
        page_name: name,
        draft_config: config,
        draft_seo: seo,
        draft_store_settings: storeSettings,
        draft_setup_settings: setupSettings,
        updated_at: updatedAt,
      })
      .eq('id', currentConfig.id)
      .eq('updated_at', currentConfig.updated_at)
      .select(
        'id, merchant_id, page_slug, draft_config, draft_seo, draft_store_settings, draft_setup_settings, updated_at'
      )
      .maybeSingle();

    if (error) {
      console.error('Failed to update builder draft:', {
        merchantId,
        slug,
        error,
      });
      return {
        response: createInternalServerErrorResponse(),
      };
    }

    if (!data) {
      return { response: createConflictResponse() };
    }

    return { data, lastUpdated: data.updated_at ?? null };
  }

  if (expectedLastUpdated !== undefined && expectedLastUpdated !== null) {
    return { response: createConflictResponse() };
  }

  const { data, error } = await supabase
    .from('page_configs')
    .upsert(
      {
        merchant_id: merchantId,
        page_slug: slug,
        page_name: name,
        draft_config: config,
        draft_seo: seo,
        draft_store_settings: storeSettings,
        draft_setup_settings: setupSettings,
        updated_at: updatedAt,
      },
      { onConflict: 'merchant_id,page_slug', ignoreDuplicates: true }
    )
    .select(
      'id, merchant_id, page_slug, draft_config, draft_seo, draft_store_settings, draft_setup_settings, updated_at'
    )
    .maybeSingle();

  if (error) {
    console.error('Failed to insert builder draft:', {
      merchantId,
      slug,
      error,
    });
    return {
      response: createInternalServerErrorResponse(),
    };
  }

  if (!data) {
    return { response: createConflictResponse() };
  }

  return { data, lastUpdated: data.updated_at ?? null };
}

export async function publishBuilderDraft(
  supabase: SupabaseClient,
  merchantId: string,
  input: BuilderPublishInput
): Promise<MutationResult> {
  const { slug, expectedLastUpdated } = input;
  const publishedAt = new Date().toISOString();

  const { data: currentConfig, error: draftError } =
    await getPublishablePageConfig(supabase, merchantId, slug);

  if (draftError) {
    return {
      response: createInternalServerErrorResponse(),
    };
  }

  if (!currentConfig?.draft_config) {
    return {
      response: NextResponse.json(
        { error: 'No draft to publish' },
        { status: 400 }
      ),
    };
  }

  if (isConflict(expectedLastUpdated, currentConfig.updated_at || null)) {
    return { response: createConflictResponse() };
  }

  const { data, error } = await supabase
    .from('page_configs')
    .update({
      published_config: currentConfig.draft_config,
      published_seo: currentConfig.draft_seo,
      published_store_settings: currentConfig.draft_store_settings,
      published_setup_settings: currentConfig.draft_setup_settings,
      is_published: true,
      published_at: publishedAt,
      updated_at: publishedAt,
    })
    .eq('id', currentConfig.id)
    .eq('updated_at', currentConfig.updated_at)
    .select('id, updated_at')
    .maybeSingle();

  if (error) {
    return {
      response: createInternalServerErrorResponse(),
    };
  }

  if (!data) {
    return { response: createConflictResponse() };
  }

  if (currentConfig.published_config) {
    const { error: historyError } = await supabase
      .from('page_config_history')
      .insert({
        page_config_id: currentConfig.id,
        config: currentConfig.published_config,
        version_note: `Published on ${publishedAt}`,
      });

    if (historyError) {
      console.error('Failed to save config history after publish:', {
        merchantId,
        slug,
        error: historyError,
      });
    }
  }

  return { data, lastUpdated: data.updated_at ?? null };
}
