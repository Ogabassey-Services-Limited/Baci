import { NextRequest, NextResponse } from 'next/server';
import { regenerateHeroImagesForMerchant } from '@/services/hero-image-generator';
import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import { logger } from '@/lib/logger';

/**
 * API endpoint for merchants to regenerate their hero images
 * POST /api/merchant/regenerate-hero-images
 * 
 * Premium feature - requires appropriate subscription/feature flag
 */
export async function POST(request: NextRequest) {
    try {
        const cookieStore = await cookies();
        const supabase = createClient(cookieStore);

        // Get authenticated user
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            );
        }

        // Get merchant ID from user
        const { data: merchant, error: merchantError } = await supabase
            .from('merchants')
            .select('id, business_type, hero_images_regeneration_count')
            .eq('owner_id', user.id)
            .single();

        if (merchantError || !merchant) {
            return NextResponse.json(
                { error: 'Merchant not found' },
                { status: 404 }
            );
        }

        // TODO: Check if merchant has premium feature enabled
        // For MVP, allow 3 free regenerations, then require premium
        const FREE_REGENERATION_LIMIT = 3;

        if (merchant.hero_images_regeneration_count >= FREE_REGENERATION_LIMIT) {
            // Check for premium subscription/feature flag
            // For now, return error
            return NextResponse.json(
                {
                    error: 'Regeneration limit reached',
                    message: `You have reached the free regeneration limit (${FREE_REGENERATION_LIMIT}). Upgrade to premium to regenerate unlimited times.`,
                    requiresPremium: true
                },
                { status: 403 }
            );
        }

        logger.info({ message: 'Regenerating hero images for merchant', merchantId: merchant.id });

        const result = await regenerateHeroImagesForMerchant(merchant.id);

        if (!result.success) {
            return NextResponse.json(
                { error: result.error || 'Failed to regenerate images' },
                { status: 500 }
            );
        }

        return NextResponse.json({
            success: true,
            imageIds: result.imageIds,
            message: 'Hero images regenerated successfully',
            regenerationsRemaining: FREE_REGENERATION_LIMIT - (merchant.hero_images_regeneration_count + 1)
        });

    } catch (error) {
        logger.error({ message: 'Hero image regeneration API error', error });
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Internal server error' },
            { status: 500 }
        );
    }
}

/**
 * Get merchant's current hero images
 * GET /api/merchant/regenerate-hero-images
 */
export async function GET() {
    try {
        const cookieStore = await cookies();
        const supabase = createClient(cookieStore);

        // Get authenticated user
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            );
        }

        // Get merchant data
        const { data: merchant, error: merchantError } = await supabase
            .from('merchants')
            .select('id, hero_image_ids, hero_images_regeneration_count, hero_images_generated_at')
            .eq('owner_id', user.id)
            .single();

        if (merchantError || !merchant) {
            return NextResponse.json(
                { error: 'Merchant not found' },
                { status: 404 }
            );
        }

        // Get hero images details
        if (!merchant.hero_image_ids || merchant.hero_image_ids.length === 0) {
            return NextResponse.json({
                success: true,
                images: [],
                regenerationCount: merchant.hero_images_regeneration_count || 0,
                generatedAt: merchant.hero_images_generated_at
            });
        }

        const { data: images, error: imagesError } = await supabase
            .from('ai_hero_images')
            .select('id, image_url, style_variant, created_at')
            .in('id', merchant.hero_image_ids);

        if (imagesError) {
            return NextResponse.json(
                { error: imagesError.message },
                { status: 500 }
            );
        }

        return NextResponse.json({
            success: true,
            images,
            regenerationCount: merchant.hero_images_regeneration_count || 0,
            generatedAt: merchant.hero_images_generated_at,
            canRegenerate: (merchant.hero_images_regeneration_count || 0) < 3
        });

    } catch (error) {
        logger.error({ message: 'Get hero images API error', error });
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Internal server error' },
            { status: 500 }
        );
    }
}
