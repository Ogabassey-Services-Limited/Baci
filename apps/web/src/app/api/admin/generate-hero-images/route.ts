import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';
import { checkCsrfProtection } from '@/lib/csrf';
import { logger } from '@/lib/logger';
import { getPlatformAdminAuth } from '@/lib/platform-admin-auth';
import { createClient } from '@/lib/supabase/server';
import { generateHeroImageBatch } from '@/services/hero-image-generator';

function toAuthErrorResponse(status: 'unauthenticated' | 'forbidden') {
  return status === 'unauthenticated'
    ? NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    : NextResponse.json({ error: 'Forbidden' }, { status: 403 });
}

/**
 * API endpoint to generate hero images for a specific category
 * POST /api/admin/generate-hero-images
 */
export async function POST(request: NextRequest) {
  const { valid, response } = await checkCsrfProtection(request);
  if (!valid) {
    return (
      response ??
      NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 })
    );
  }

  const auth = await getPlatformAdminAuth();
  if (auth.status !== 'authenticated') {
    return toAuthErrorResponse(auth.status);
  }

  try {
    const body = await request.json();
    const { category, count = 10 } = body;

    if (!category) {
      return NextResponse.json(
        { error: 'Category is required' },
        { status: 400 }
      );
    }

    const validCategories = [
      'fashion',
      'electronics',
      'hair-extensions',
      'home-goods',
      'health-beauty',
      'handmade',
      'food-beverage',
      'other',
    ];

    if (!validCategories.includes(category)) {
      return NextResponse.json(
        {
          error: `Invalid category. Must be one of: ${validCategories.join(', ')}`,
        },
        { status: 400 }
      );
    }

    if (count < 1 || count > 20) {
      return NextResponse.json(
        { error: 'Count must be between 1 and 20' },
        { status: 400 }
      );
    }

    logger.info({ message: 'Generating hero images batch', category, count });

    const result = await generateHeroImageBatch(category, count);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to generate images' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      imageIds: result.imageIds,
      count: result.imageIds?.length || 0,
      message: `Successfully generated ${result.imageIds?.length || 0} hero images for ${category}`,
    });
  } catch (error) {
    logger.error({ message: 'Hero image generation API error', error });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Get statistics about hero image pool
 * GET /api/admin/generate-hero-images
 */
export async function GET() {
  const auth = await getPlatformAdminAuth();
  if (auth.status !== 'authenticated') {
    return toAuthErrorResponse(auth.status);
  }

  try {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    // Get statistics per category
    const { data: stats, error: statsError } = await supabase
      .from('ai_hero_images')
      .select('category, usage_count')
      .eq('is_active', true);

    if (statsError) {
      return NextResponse.json({ error: statsError.message }, { status: 500 });
    }

    // Aggregate statistics
    const categoryStats = stats.reduce(
      (
        acc: Record<
          string,
          { total: number; avgUsage: number; totalUsage: number }
        >,
        img: { category: string; usage_count: number }
      ) => {
        if (!acc[img.category]) {
          acc[img.category] = { total: 0, avgUsage: 0, totalUsage: 0 };
        }
        acc[img.category].total += 1;
        acc[img.category].totalUsage += img.usage_count;
        return acc;
      },
      {} as Record<
        string,
        { total: number; avgUsage: number; totalUsage: number }
      >
    );

    // Calculate averages
    Object.keys(categoryStats).forEach((cat) => {
      categoryStats[cat].avgUsage =
        categoryStats[cat].totalUsage / categoryStats[cat].total;
    });

    return NextResponse.json({
      success: true,
      statistics: categoryStats,
      totalImages: stats.length,
    });
  } catch (error) {
    logger.error({ message: 'Hero image stats API error', error });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
