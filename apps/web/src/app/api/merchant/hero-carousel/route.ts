import { NextResponse } from 'next/server';
import { hasPermission } from '@/lib/api-auth';
import {
  getMerchantForApiRequest,
  toUserAccess,
} from '@/lib/get-merchant-for-api-request';
import { normalizeHeroSlidesForStorage } from '@/lib/hero-carousel-config';
import { logger } from '@/lib/logger';
import { getAuthenticatedUser } from '@/lib/supabase/mobile-auth';
import { heroCarouselUpdateRequestSchema } from '@/schemas/hero-carousel';

function canViewCarousel(access: ReturnType<typeof toUserAccess>): boolean {
  return (
    hasPermission(access, 'builder', 'view') ||
    hasPermission(access, 'settings', 'view') ||
    hasPermission(access, 'dashboard', 'view')
  );
}

function canEditCarousel(access: ReturnType<typeof toUserAccess>): boolean {
  return (
    hasPermission(access, 'builder', 'edit') ||
    hasPermission(access, 'settings', 'edit')
  );
}

async function resolveMerchantContext(request: Request) {
  const auth = await getAuthenticatedUser(request);
  if (!auth) {
    return {
      error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    };
  }

  const { user, supabase } = auth;
  const merchantContext = await getMerchantForApiRequest(supabase, user.id);

  if (!merchantContext) {
    return {
      error: NextResponse.json(
        { error: 'Merchant not found' },
        { status: 404 }
      ),
    };
  }

  return {
    supabase,
    merchantContext,
    access: toUserAccess(merchantContext),
  };
}

export async function GET(request: Request) {
  try {
    const context = await resolveMerchantContext(request);
    if ('error' in context) return context.error;

    if (!canViewCarousel(context.access)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const merchantId = context.merchantContext.merchantId;

    const { data: merchant, error: merchantError } = await context.supabase
      .from('merchants')
      .select('id, mobile_hero_slides')
      .eq('id', merchantId)
      .single();

    if (merchantError || !merchant) {
      return NextResponse.json(
        { error: 'Merchant not found' },
        { status: 404 }
      );
    }

    const slides = normalizeHeroSlidesForStorage(merchant.mobile_hero_slides);
    const source = slides.length > 0 ? 'mobile_hero_slides' : 'none';

    return NextResponse.json({
      slides,
      source,
      driftDetected: false,
    });
  } catch (error) {
    logger.error({
      error: error instanceof Error ? error : new Error(String(error)),
      message: 'Failed to load hero carousel settings',
    });

    return NextResponse.json(
      { error: 'Failed to load hero carousel settings' },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  try {
    const context = await resolveMerchantContext(request);
    if ('error' in context) return context.error;

    if (!canEditCarousel(context.access)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const parsedBody = heroCarouselUpdateRequestSchema.safeParse(body);

    if (!parsedBody.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsedBody.error.flatten() },
        { status: 400 }
      );
    }

    const merchantId = context.merchantContext.merchantId;
    const normalizedSlides = normalizeHeroSlidesForStorage(
      parsedBody.data.slides
    );

    const { data: merchant, error: merchantError } = await context.supabase
      .from('merchants')
      .select('id')
      .eq('id', merchantId)
      .single();

    if (merchantError || !merchant) {
      return NextResponse.json(
        { error: 'Merchant not found' },
        { status: 404 }
      );
    }

    const { error: merchantUpdateError } = await context.supabase
      .from('merchants')
      .update({ mobile_hero_slides: normalizedSlides })
      .eq('id', merchantId);

    if (merchantUpdateError) {
      return NextResponse.json(
        { error: merchantUpdateError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, slides: normalizedSlides });
  } catch (error) {
    logger.error({
      error: error instanceof Error ? error : new Error(String(error)),
      message: 'Failed to update hero carousel settings',
    });

    return NextResponse.json(
      { error: 'Failed to update hero carousel settings' },
      { status: 500 }
    );
  }
}
