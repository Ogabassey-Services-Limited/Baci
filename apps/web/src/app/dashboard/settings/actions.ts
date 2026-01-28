'use server';

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { processFavicon } from '@/lib/favicon-processor';
import { createClient } from '@/lib/supabase/server';

export async function uploadFavicon(formData: FormData, merchantId: string) {
  const file = formData.get('file') as File;
  if (!file) {
    return { success: false, error: 'No file provided' };
  }

  try {
    const result = await processFavicon(file, merchantId);

    // Update merchant record
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);
    const { error } = await supabase
      .from('merchants')
      .update({
        favicon_svg_url: result.svg_url,
        favicon_png_32_url: result.png_32_url,
        favicon_png_192_url: result.png_192_url,
        favicon_apple_touch_url: result.apple_touch_url,
        favicon_uploaded_at: new Date().toISOString(),
      })
      .eq('id', merchantId);

    if (error) throw error;

    revalidatePath('/dashboard/settings');
    return { success: true, result };
  } catch (error) {
    console.error('Favicon upload failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Upload failed',
    };
  }
}

// Zod schema for KYC validation - NIN and BVN are 11-digit numbers in Nigeria
// Transform empty strings to null before validation to handle form submissions gracefully
const kycSchema = z
  .object({
    nin: z
      .string()
      .transform((val) => (val === '' ? null : val))
      .nullable()
      .refine((val) => val === null || /^\d{11}$/.test(val), {
        message: 'NIN must be 11 digits',
      }),
    bvn: z
      .string()
      .transform((val) => (val === '' ? null : val))
      .nullable()
      .refine((val) => val === null || /^\d{11}$/.test(val), {
        message: 'BVN must be 11 digits',
      }),
    cac_number: z
      .string()
      .transform((val) => (val === '' ? null : val))
      .nullable()
      .refine((val) => val === null || /^(RC|BN)\s?\d{6,8}$/i.test(val), {
        message: 'CAC must be in format RC/BN followed by 6-8 digits',
      }),
  })
  .refine((data) => data.nin || data.bvn || data.cac_number, {
    message: 'At least one KYC field must be provided',
  });

type KycData = z.infer<typeof kycSchema>;

export async function submitKyc(data: KycData) {
  try {
    // Validate input with Zod schema
    const validatedData = kycSchema.parse(data);

    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    // Get merchant ID owned by user
    const { data: merchant, error: merchantError } = await supabase
      .from('merchants')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (merchantError || !merchant) {
      throw new Error('Merchant not found');
    }

    const { error } = await supabase
      .from('merchants')
      .update({
        nin: validatedData.nin,
        bvn: validatedData.bvn,
        cac_rc_number: validatedData.cac_number,
        kyc_status: 'pending',
      })
      .eq('id', merchant.id);

    if (error) throw error;

    revalidatePath('/dashboard/settings/kyc');
    revalidatePath('/dashboard/settings');
    return { success: true };
  } catch (error) {
    // Don't log the full error to avoid exposing sensitive KYC data (NIN, BVN)
    console.error('KYC submission failed');
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Submission failed',
    };
  }
}
