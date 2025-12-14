'use server';

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
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

type KycData = {
  nin: string | null;
  bvn: string | null;
  cac_number: string | null;
};

export async function submitKyc(data: KycData) {
  try {
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
    const { data: merchant } = await supabase
      .from('merchants')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (!merchant) {
      throw new Error('Merchant not found');
    }

    const { error } = await supabase
      .from('merchants')
      .update({
        nin: data.nin,
        bvn: data.bvn,
        cac_number: data.cac_number,
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
