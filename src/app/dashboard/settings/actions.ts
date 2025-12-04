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
