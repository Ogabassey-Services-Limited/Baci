import { NextResponse } from 'next/server';
import { hasPermission } from '@/lib/api-auth';
import { generateDefaultConfig } from '@/lib/builder-defaults';
import {
  getMerchantForApiRequest,
  toUserAccess,
} from '@/lib/get-merchant-for-api-request';
import { getAuthenticatedUser } from '@/lib/supabase/mobile-auth';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const pageSlug = searchParams.get('slug') || 'home';

  // Support both cookie and Bearer token auth
  const auth = await getAuthenticatedUser(request);
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { user, supabase } = auth;

  // Resolve merchant context (supports both owners and staff)
  const merchantContext = await getMerchantForApiRequest(supabase, user.id);
  if (!merchantContext) {
    return NextResponse.json({ error: 'Merchant not found' }, { status: 404 });
  }

  // Permission check
  const access = toUserAccess(merchantContext);
  if (!hasPermission(access, 'builder', 'view')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const merchantId = merchantContext.merchantId;

  // Get merchant with full details for template generation
  const { data: merchant, error: merchantError } = await supabase
    .from('merchants')
    .select('*')
    .eq('id', merchantId)
    .single();

  if (merchantError || !merchant) {
    return NextResponse.json({ error: 'Merchant not found' }, { status: 404 });
  }

  // Get page config
  const { data: pageConfig, error: configError } = await supabase
    .from('page_configs')
    .select('*')
    .eq('merchant_id', merchantId)
    .eq('page_slug', pageSlug)
    .single();

  if (configError && configError.code !== 'PGRST116') {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }

  // Determine which config to load for editing
  let configToEdit = null;
  let isDefault = false;

  if (pageConfig?.draft_config) {
    // Use existing draft
    configToEdit = pageConfig.draft_config;
  } else if (pageConfig?.published_config) {
    // No draft exists, but published config exists - load it for editing
    configToEdit = pageConfig.published_config;
  } else {
    // No draft or published config - use default template
    configToEdit = await generateDefaultConfig(merchant);
    isDefault = true;
  }

  // If we're loading published config as draft (no draft exists), return it
  if (
    !pageConfig ||
    (!pageConfig.draft_config && !pageConfig.published_config)
  ) {
    return NextResponse.json({
      config: configToEdit,
      seo: pageConfig?.draft_seo || null,
      storeSettings: pageConfig?.draft_store_settings || null,
      setupSettings: pageConfig?.draft_setup_settings || null,
      publishedConfig: pageConfig?.published_config || null,
      isPublished: pageConfig?.is_published || false,
      isDefault: isDefault,
      lastUpdated: pageConfig?.updated_at || null,
    });
  }

  return NextResponse.json({
    config: configToEdit,
    seo: pageConfig?.draft_seo || null,
    storeSettings: pageConfig?.draft_store_settings || null,
    setupSettings: pageConfig?.draft_setup_settings || null,
    publishedConfig: pageConfig?.published_config || null,
    isPublished: pageConfig?.is_published || false,
    isDefault: isDefault,
    lastUpdated: pageConfig?.updated_at,
  });
}

export async function POST(request: Request) {
  const { slug, config, name, seo, storeSettings, setupSettings } =
    await request.json();

  // Support both cookie and Bearer token auth
  const auth = await getAuthenticatedUser(request);
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { user, supabase } = auth;

  // Resolve merchant context (supports both owners and staff)
  const merchantContext = await getMerchantForApiRequest(supabase, user.id);
  if (!merchantContext) {
    return NextResponse.json({ error: 'Merchant not found' }, { status: 404 });
  }

  // Permission check
  const access = toUserAccess(merchantContext);
  if (!hasPermission(access, 'builder', 'edit')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const merchantId = merchantContext.merchantId;

  // Upsert page config (save as draft)
  const { data, error } = await supabase
    .from('page_configs')
    .upsert(
      {
        merchant_id: merchantId,
        page_slug: slug || 'home',
        page_name: name || 'Home',
        draft_config: config,
        draft_seo: seo,
        draft_store_settings: storeSettings,
        draft_setup_settings: setupSettings,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: 'merchant_id,page_slug',
      }
    )
    .select()
    .single();

  if (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true, data });
}

export async function PUT(request: Request) {
  // Publish endpoint
  const { slug } = await request.json();

  // Support both cookie and Bearer token auth
  const auth = await getAuthenticatedUser(request);
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { user, supabase } = auth;

  // Resolve merchant context (supports both owners and staff)
  const merchantContext = await getMerchantForApiRequest(supabase, user.id);
  if (!merchantContext) {
    return NextResponse.json({ error: 'Merchant not found' }, { status: 404 });
  }

  // Permission check
  const access = toUserAccess(merchantContext);
  if (!hasPermission(access, 'builder', 'edit')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const merchantId = merchantContext.merchantId;
  const publishedAt = new Date().toISOString();

  // Get current draft
  const { data: currentConfig } = await supabase
    .from('page_configs')
    .select('*')
    .eq('merchant_id', merchantId)
    .eq('page_slug', slug)
    .single();

  if (!currentConfig || !currentConfig.draft_config) {
    return NextResponse.json({ error: 'No draft to publish' }, { status: 400 });
  }

  // 1. Save current published version to history (if exists)
  if (currentConfig.published_config) {
    const { error: historyError } = await supabase
      .from('page_config_history')
      .insert({
        page_config_id: currentConfig.id,
        config: currentConfig.published_config,
        version_note: `Published on ${publishedAt}`,
      });

    if (historyError) {
      console.error('Failed to save config history:', historyError);
      return NextResponse.json(
        { error: 'Failed to save config history' },
        { status: 500 }
      );
    }
  }

  // 2. Update page_config to publish all draft settings
  const { error } = await supabase
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
    .eq('id', currentConfig.id);

  if (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}
