'use server';

import { cookies } from 'next/headers';
import { ensureActionRateLimit } from '@/lib/ensure-action-rate-limit';
import { createClient } from '@/lib/supabase/server';
import { incrementViewCountPostIdSchema } from '@/schemas/blog-post-view-count';

export async function incrementViewCount(postId: unknown) {
  // Anonymous fire-and-forget counter: counting views requires anonymity,
  // so abuse control is a per user/IP rate limit instead of a login gate.
  const allowed = await ensureActionRateLimit('blog-view-count', {
    requests: 30,
    windowMs: 60_000,
  });
  if (!allowed) {
    return;
  }

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
