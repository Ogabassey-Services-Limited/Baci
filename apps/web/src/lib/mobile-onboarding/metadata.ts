import type { User } from '@supabase/supabase-js';
import { z } from 'zod';
import type { BrandColors } from '@/types';

const brandColorsSchema = z.object({
  primary: z.string().trim().min(1),
  background: z.string().trim().min(1),
  accent: z.string().trim().min(1),
});

const metadataSchema = z
  .object({
    full_name: z.string().trim().min(1).optional(),
    first_name: z.string().trim().min(1).optional(),
    last_name: z.string().trim().min(1).optional(),
    business_name: z.string().trim().min(2).optional(),
    business_type: z.string().trim().min(1).optional(),
    other_business_type: z.string().trim().optional().nullable(),
    phone: z.string().trim().optional().nullable(),
    slug: z.string().trim().min(1).optional(),
    logo_url: z.string().trim().optional().nullable(),
  })
  .superRefine((data, ctx) => {
    if (!data.business_name || !data.business_type) {
      ctx.addIssue({
        code: 'custom',
        message:
          'Account setup details are missing. Please complete your profile.',
      });
    }
  });

export interface MobileOnboardingProfile {
  email: string;
  fullName: string | null;
  firstName: string | null;
  lastName: string | null;
  businessName: string;
  businessType: string;
  otherBusinessType: string | null;
  phone: string | null;
  slug: string;
  logoUrl: string | null;
  brandColors: BrandColors | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function getBrandColors(metadata: Record<string, unknown>): BrandColors | null {
  const rawValue = metadata.brand_colors;
  if (typeof rawValue === 'string') {
    try {
      const parsed = JSON.parse(rawValue) as unknown;
      const result = brandColorsSchema.safeParse(parsed);
      return result.success ? result.data : null;
    } catch {
      return null;
    }
  }

  const result = brandColorsSchema.safeParse(rawValue);
  return result.success ? result.data : null;
}

function buildSlug(businessName: string, providedSlug?: string): string {
  if (providedSlug?.trim()) {
    return providedSlug.trim();
  }

  return (
    businessName
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '') || 'store'
  );
}

export function readMobileOnboardingMetadata(
  user: Pick<User, 'email' | 'user_metadata'>
):
  | { success: true; data: MobileOnboardingProfile }
  | { success: false; error: string } {
  if (!user.email) {
    return {
      success: false,
      error: 'Authenticated user is missing an email address.',
    };
  }

  const rawMetadata = isRecord(user.user_metadata) ? user.user_metadata : {};
  const parsed = metadataSchema.safeParse(rawMetadata);

  if (!parsed.success) {
    return {
      success: false,
      error: 'Account setup details are missing. Please complete your profile.',
    };
  }

  const metadata = parsed.data;
  const businessName = metadata.business_name;
  const businessType = metadata.business_type;

  if (!businessName || !businessType) {
    return {
      success: false,
      error: 'Account setup details are missing. Please complete your profile.',
    };
  }

  const fullName = metadata.full_name ?? null;
  const firstName = metadata.first_name ?? null;
  const lastName = metadata.last_name ?? null;

  return {
    success: true,
    data: {
      email: user.email,
      fullName,
      firstName,
      lastName,
      businessName,
      businessType,
      otherBusinessType: metadata.other_business_type ?? null,
      phone: metadata.phone ?? null,
      slug: buildSlug(businessName, metadata.slug),
      logoUrl: metadata.logo_url?.trim() || null,
      brandColors: getBrandColors(rawMetadata),
    },
  };
}
