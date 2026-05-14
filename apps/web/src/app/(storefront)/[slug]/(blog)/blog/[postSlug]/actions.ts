'use server';

import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';

export async function incrementViewCount(postId: string) {
  try {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    // Fire and forget update
    await supabase.rpc('increment_blog_post_views', { p_post_id: postId });
  } catch (error) {
    console.error('Failed to increment view count:', error);
  }
}
