/**
 * Favicon upload API (mobile + web).
 *
 * Mobile admin cannot run the `sharp`-based favicon processing on-device, so it
 * POSTs the picked image here. The route authenticates via Bearer token (mobile)
 * or cookies (web), generates every favicon variant server-side with
 * `processFavicon`, and persists the URLs on the merchant record.
 *
 * Auth: `authenticateApiRequest` accepts a Bearer token (mobile) or cookies
 * (web). `checkCsrfProtection` enforces CSRF for cookie requests and is a no-op
 * for Bearer requests (tokens are not auto-sent, so CSRF does not apply).
 */

import { type NextRequest, NextResponse } from 'next/server';
import {
  authenticateApiRequest,
  getUserAccess,
  hasPermission,
  type UserAccess,
} from '@/lib/api-auth';
import { revalidateMerchant } from '@/lib/cache-revalidation';
import { checkCsrfProtection } from '@/lib/csrf';
import {
  FaviconValidationError,
  processFavicon,
} from '@/lib/favicon-processor';
import { checkRateLimit } from '@/lib/rate-limiter';

function canEditSettings(access: UserAccess) {
  return (
    hasPermission(access, 'settings', 'edit') ||
    hasPermission(access, 'settings', 'all') ||
    hasPermission(access, 'full_access', 'all')
  );
}

export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateApiRequest(request);
    if (auth.error || !auth.user || !auth.supabase) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { valid: csrfValid, response: csrfResponse } =
      await checkCsrfProtection(request);
    if (!csrfValid) {
      return (
        csrfResponse ??
        NextResponse.json({ error: 'CSRF validation failed' }, { status: 403 })
      );
    }

    // Resolve the merchant from the authenticated user — never trust a
    // client-supplied merchant id.
    const access = await getUserAccess(auth.supabase);
    if (!access) {
      return NextResponse.json(
        { error: 'Merchant not found' },
        { status: 404 }
      );
    }
    if (!canEditSettings(access)) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const allowed = await checkRateLimit(
      auth.supabase,
      auth.user.id,
      'merchant-favicon-upload',
      5,
      1
    );
    if (!allowed) {
      return NextResponse.json(
        { error: 'Rate limit exceeded', code: 'rate_limited' },
        { status: 429 }
      );
    }

    const formData = await request.formData();
    const file = formData.get('file');
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const merchantId = access.merchantId;
    const result = await processFavicon(file, merchantId, auth.supabase);

    const { error: updateError } = await auth.supabase
      .from('merchants')
      .update({
        // Raster uploads (PNG/JPEG/WEBP) produce no SVG variant, so explicitly
        // clear any previously stored SVG — an undefined value would be omitted
        // from the PATCH and leave the stale SVG favicon in place.
        favicon_svg_url: result.svg_url ?? null,
        favicon_png_32_url: result.png_32_url,
        favicon_png_192_url: result.png_192_url,
        favicon_apple_touch_url: result.apple_touch_url,
        favicon_uploaded_at: new Date().toISOString(),
      })
      .eq('id', merchantId);

    if (updateError) {
      throw updateError;
    }

    try {
      revalidateMerchant(merchantId);
    } catch (revalidationError) {
      console.warn('Merchant favicon cache revalidation failed:', {
        error: revalidationError,
        merchantId,
      });
    }

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    const isValidationError = error instanceof FaviconValidationError;
    const message =
      isValidationError && error instanceof Error
        ? error.message
        : 'Failed to update favicon';
    console.error('Favicon update failed:', error);
    return NextResponse.json(
      { error: message },
      { status: isValidationError ? 400 : 500 }
    );
  }
}
