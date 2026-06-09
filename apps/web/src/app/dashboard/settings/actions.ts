'use server';

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import type { StaffAccess } from '@/hooks/merchant';
import { processFavicon } from '@/lib/favicon-processor';
import { getMerchantForApiRequest } from '@/lib/get-merchant-for-api-request';
import { createClient } from '@/lib/supabase/server';

function canEditSettings(staffAccess: StaffAccess) {
  return (
    staffAccess.isOwner ||
    staffAccess.permissions?.full_access?.all === true ||
    staffAccess.permissions?.settings?.all === true ||
    staffAccess.permissions?.settings?.edit === true
  );
}

export async function uploadFavicon(formData: FormData, merchantId: string) {
  const file = formData.get('file') as File;
  if (!file) {
    return { success: false, error: 'No file provided' };
  }

  try {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { success: false, error: 'Unauthorized' };
    }

    const merchantContext = await getMerchantForApiRequest(supabase, user.id, {
      requestedMerchantId: merchantId,
    });

    if (
      !merchantContext ||
      merchantContext.merchantId !== merchantId ||
      !canEditSettings(merchantContext.staffAccess)
    ) {
      return { success: false, error: 'Merchant not found or access denied' };
    }

    const result = await processFavicon(file, merchantContext.merchantId);

    // Update merchant record
    const { error } = await supabase
      .from('merchants')
      .update({
        favicon_svg_url: result.svg_url,
        favicon_png_32_url: result.png_32_url,
        favicon_png_192_url: result.png_192_url,
        favicon_apple_touch_url: result.apple_touch_url,
        favicon_uploaded_at: new Date().toISOString(),
      })
      .eq('id', merchantContext.merchantId);

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
