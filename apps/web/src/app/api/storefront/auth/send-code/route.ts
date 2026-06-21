import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import z from 'zod';
import { createClient } from '@/lib/supabase/server';
import {
  resolveStorefrontAuthMerchant,
  type StorefrontAuthMerchant,
} from '../resolve-storefront-auth-merchant';

// Zod schema for email validation (2026 best practice: use Zod instead of custom validation)
const SendCodeSchema = z.object({
  email: z.email({ error: 'Invalid email format' }).max(254, 'Email too long'),
  merchantSlug: z.string().min(1, 'Merchant slug is required'),
});

function normalizeOrigin(value: string | null): string | null {
  if (!value) return null;

  try {
    const parsed = new URL(value);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return null;
    }

    return parsed.origin;
  } catch {
    return null;
  }
}

function getRequestOrigin(request: Request): string | null {
  const origin = normalizeOrigin(request.headers.get('origin'));
  if (origin) return origin;

  const referer = request.headers.get('referer');
  if (referer) {
    try {
      return normalizeOrigin(new URL(referer).origin);
    } catch {
      return null;
    }
  }

  return normalizeOrigin(request.url);
}

function buildStorefrontOrigins(merchant: StorefrontAuthMerchant): Set<string> {
  const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN || 'usebaci.com';
  const protocol = process.env.NODE_ENV === 'production' ? 'https' : 'http';
  const origins = new Set<string>();
  origins.add(`${protocol}://${merchant.slug}.${rootDomain}`);

  if (merchant.custom_domain) {
    origins.add(`https://${merchant.custom_domain.toLowerCase()}`);
  }

  return origins;
}

function isOtpRateLimitError(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const candidate = error as {
    code?: unknown;
    message?: unknown;
    status?: unknown;
  };

  const isRateLimitStatus =
    candidate.status === 429 || candidate.status === '429';

  if (isRateLimitStatus || candidate.code === 'over_email_send_rate_limit') {
    return true;
  }

  if (typeof candidate.message !== 'string') {
    return false;
  }

  const message = candidate.message.toLowerCase();
  return (
    message.includes('rate limit') ||
    message.includes('too many request') ||
    message.includes('429')
  );
}

function resolveOtpRedirectUrl(
  request: Request,
  merchant: StorefrontAuthMerchant
) {
  const storefrontOrigins = buildStorefrontOrigins(merchant);
  const requestOrigin = getRequestOrigin(request);

  if (requestOrigin && storefrontOrigins.has(requestOrigin)) {
    return `${requestOrigin}/account/verify`;
  }

  const preferredOrigin =
    merchant.custom_domain && process.env.NODE_ENV === 'production'
      ? `https://${merchant.custom_domain.toLowerCase()}`
      : Array.from(storefrontOrigins)[0];

  return `${preferredOrigin}/account/verify`;
}

/**
 * Customer OTP Authentication - Send Code
 *
 * Sends a 6-digit OTP code to the customer's email.
 * Uses Supabase's built-in signInWithOtp for passwordless auth.
 */

export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Validate input using Zod schema
    const parseResult = SendCodeSchema.safeParse(body);
    if (!parseResult.success) {
      const firstError = parseResult.error.issues[0];
      return NextResponse.json(
        { error: firstError?.message || 'Invalid request data' },
        { status: 400 }
      );
    }

    const { email, merchantSlug } = parseResult.data;

    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    const merchant = await resolveStorefrontAuthMerchant(
      supabase,
      merchantSlug
    );

    if (!merchant) {
      return NextResponse.json({ error: 'Store not found' }, { status: 404 });
    }

    if (!merchant.is_published) {
      return NextResponse.json(
        { error: 'Store is not available' },
        { status: 403 }
      );
    }

    // Keep auth redirects on the storefront origin the customer is using.
    const redirectUrl = resolveOtpRedirectUrl(request, merchant);

    // Send OTP using Supabase's built-in magic link/OTP system
    // We use signInWithOtp which sends a 6-digit code
    const { error: otpError } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: true,
        emailRedirectTo: redirectUrl,
        data: {
          role: 'customer',
          // Store merchant context for post-verification
          pending_merchant_id: merchant.id,
        },
      },
    });

    if (otpError) {
      console.error('OTP send error:', otpError);

      // Handle Supabase Auth rate limiting. Supabase exposes a stable
      // status/code pair; the human-readable message is not stable enough.
      if (isOtpRateLimitError(otpError)) {
        return NextResponse.json(
          { error: 'Too many requests. Please wait a moment and try again.' },
          { status: 429 }
        );
      }

      return NextResponse.json(
        { error: 'Failed to send verification code. Please try again.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Verification code sent to your email',
      email,
    });
  } catch (error) {
    console.error('Send code error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
