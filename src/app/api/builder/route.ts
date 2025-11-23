
import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { generateDefaultConfig } from '@/lib/builder-defaults';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const pageSlug = searchParams.get('slug') || 'home';
    const cookieStore = await cookies();

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                get(name: string) {
                    return cookieStore.get(name)?.value;
                },
            },
        }
    );

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get merchant with full details for template generation
    const { data: merchant, error: merchantError } = await supabase
        .from('merchants')
        .select('*')
        .eq('user_id', user.id)
        .single();

    if (merchantError || !merchant) {
        return NextResponse.json({ error: 'Merchant not found' }, { status: 404 });
    }

    // Get page config
    const { data: pageConfig, error: configError } = await supabase
        .from('page_configs')
        .select('*')
        .eq('merchant_id', merchant.id)
        .eq('page_slug', pageSlug)
        .single();

    if (configError && configError.code !== 'PGRST116') {
        return NextResponse.json({ error: configError.message }, { status: 500 });
    }

    // If no custom config exists, generate default from template
    if (!pageConfig || !pageConfig.draft_config) {
        const defaultConfig = generateDefaultConfig(merchant);
        return NextResponse.json({
            config: defaultConfig,
            publishedConfig: null,
            isPublished: false,
            isDefault: true,
            lastUpdated: null
        });
    }

    return NextResponse.json({
        config: pageConfig?.draft_config || null,
        publishedConfig: pageConfig?.published_config || null,
        isPublished: pageConfig?.is_published || false,
        isDefault: false,
        lastUpdated: pageConfig?.updated_at
    });
}

export async function POST(request: Request) {
    const { slug, config, name } = await request.json();
    const cookieStore = await cookies();

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                get(name: string) {
                    return cookieStore.get(name)?.value;
                },
            },
        }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: merchant } = await supabase
        .from('merchants')
        .select('id')
        .eq('user_id', user.id)
        .single();

    if (!merchant) {
        return NextResponse.json({ error: 'Merchant not found' }, { status: 404 });
    }

    // Upsert page config (save as draft)
    const { data, error } = await supabase
        .from('page_configs')
        .upsert({
            merchant_id: merchant.id,
            page_slug: slug || 'home',
            page_name: name || 'Home',
            draft_config: config,
            updated_at: new Date().toISOString()
        }, {
            onConflict: 'merchant_id,page_slug'
        })
        .select()
        .single();

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });
}

export async function PUT(request: Request) {
    // Publish endpoint
    const { slug } = await request.json();
    const cookieStore = await cookies();

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                get(name: string) {
                    return cookieStore.get(name)?.value;
                },
            },
        }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: merchant } = await supabase.from('merchants').select('id').eq('user_id', user.id).single();
    if (!merchant) return NextResponse.json({ error: 'Merchant not found' }, { status: 404 });

    // Get current draft
    const { data: currentConfig } = await supabase
        .from('page_configs')
        .select('*')
        .eq('merchant_id', merchant.id)
        .eq('page_slug', slug)
        .single();

    if (!currentConfig || !currentConfig.draft_config) {
        return NextResponse.json({ error: 'No draft to publish' }, { status: 400 });
    }

    // 1. Save current published version to history (if exists)
    if (currentConfig.published_config) {
        await supabase.from('page_config_history').insert({
            page_config_id: currentConfig.id,
            config: currentConfig.published_config,
            version_note: `Published on ${new Date().toLocaleString()}`
        });
    }

    // 2. Update page_config to set published_config = draft_config
    const { error } = await supabase
        .from('page_configs')
        .update({
            published_config: currentConfig.draft_config,
            is_published: true,
            published_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        })
        .eq('id', currentConfig.id);

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
}
