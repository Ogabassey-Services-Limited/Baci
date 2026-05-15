'use server';

import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { incrementViewCountPostIdSchema } from '@/schemas/blog-post-view-count';

export async function incrementViewCount(postId: unknown) {
  const parsedPostId = incrementViewCountPostIdSchema.safeParse(postId);
  if (!parsedPostId.success) {
    return;
  }

  try {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    // Fire and forget update
    const { error } = await supabase.rpc('increment_blog_post_views', {
      p_post_id: parsedPostId.data,
    });

    if (error) {
      console.error('Failed to increment view count:', error);
    }
  } catch (error) {
    console.error('Failed to increment view count:', error);
  }
}
