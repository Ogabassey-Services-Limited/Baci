'use server';

import { cookies } from 'next/headers';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';

const incrementViewCountPostIdSchema = z.string().trim().min(1);

export async function incrementViewCount(postId: unknown) {
  const parsedPostId = incrementViewCountPostIdSchema.safeParse(postId);
  if (!parsedPostId.success) {
    return;
  }

  try {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    // Fire and forget update
    await supabase.rpc('increment_blog_post_views', {
      p_post_id: parsedPostId.data,
    });
  } catch (error) {
    console.error('Failed to increment view count:', error);
  }
}
