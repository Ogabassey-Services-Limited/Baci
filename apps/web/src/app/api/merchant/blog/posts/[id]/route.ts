import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';
import {
  authenticateApiRequest,
  getUserAccess,
  hasPermission,
} from '@/lib/api-auth';
import { getBlogEmbeddingText } from '@/lib/embeddings';
import { createClient } from '@/lib/supabase/server';

/**
 * Blog Post API - Single Post Operations
 *
 * GET: Get a single blog post by ID
 * PATCH: Update a blog post
 * DELETE: Delete a blog post
 */

// Validation schema for updating a blog post
import { blogPostSchema } from '@/lib/validations/blog';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// Calculate reading time based on word count
function calculateReadingTime(content: string): number {
  const wordsPerMinute = 200;
  const wordCount = calculateWordCount(content);
  return Math.ceil(wordCount / wordsPerMinute);
}

// Calculate word count
function calculateWordCount(content: string): number {
  if (!content) return 0;

  // Strip HTML tags if content is HTML
  const textOnly = content.replace(/<[^>]*>/g, ' ');
  return textOnly.split(/\s+/).filter(Boolean).length;
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const auth = await authenticateApiRequest(_request);
    if (auth.error || !auth.user) {
      return NextResponse.json(
        { error: auth.error || 'Unauthorized' },
        { status: 401 }
      );
    }

    const access = await getUserAccess(auth.user.id);
    if (!access) {
      return NextResponse.json(
        { error: 'Merchant not found' },
        { status: 404 }
      );
    }

    if (!hasPermission(access, 'marketing', 'view')) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
    }

    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    // Get blog post
    const { data: post, error } = await supabase
      .from('blog_posts')
      .select('*')
      .eq('id', id)
      .eq('merchant_id', access.merchantId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Post not found' }, { status: 404 });
      }
      console.error('Error fetching blog post:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(post);
  } catch (error) {
    console.error('Blog post GET error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const auth = await authenticateApiRequest(request);
    if (auth.error || !auth.user) {
      return NextResponse.json(
        { error: auth.error || 'Unauthorized' },
        { status: 401 }
      );
    }

    const access = await getUserAccess(auth.user.id);
    if (!access) {
      return NextResponse.json(
        { error: 'Merchant not found' },
        { status: 404 }
      );
    }

    if (!hasPermission(access, 'marketing', 'edit')) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
    }

    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    // Get existing post
    const { data: existingPost, error: fetchError } = await supabase
      .from('blog_posts')
      .select('*')
      .eq('id', id)
      .eq('merchant_id', access.merchantId)
      .single();

    if (fetchError || !existingPost) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    }

    // Parse and validate body
    const body = await request.json();
    const validated = blogPostSchema.safeParse(body);

    if (!validated.success) {
      return NextResponse.json(
        { error: 'Validation error', details: validated.error.flatten() },
        { status: 400 }
      );
    }

    const updateData: Record<string, unknown> = { ...validated.data };

    // Check if slug is being changed and already exists
    if (updateData.slug && updateData.slug !== existingPost.slug) {
      const { data: slugExists } = await supabase
        .from('blog_posts')
        .select('id')
        .eq('merchant_id', access.merchantId)
        .eq('slug', updateData.slug)
        .neq('id', id)
        .maybeSingle();

      if (slugExists) {
        return NextResponse.json(
          { error: 'A post with this slug already exists' },
          { status: 409 }
        );
      }
    }

    // Recalculate reading time and word count if content changed
    if (updateData.content) {
      updateData.word_count = calculateWordCount(updateData.content as string);
      updateData.reading_time_minutes = calculateReadingTime(
        updateData.content as string
      );
    }

    // Set published_at if status is changing to published and no date provided
    if (
      updateData.status === 'published' &&
      existingPost.status !== 'published' &&
      !updateData.published_at
    ) {
      updateData.published_at = new Date().toISOString();
    }

    // Update post
    const { data: updatedPost, error: updateError } = await supabase
      .from('blog_posts')
      .update(updateData)
      .eq('id', id)
      .eq('merchant_id', access.merchantId)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating blog post:', updateError);
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    // Regenerate embedding if content, title, or excerpt changed
    if (
      updatedPost &&
      (updateData.content || updateData.title || updateData.excerpt)
    ) {
      const embeddingText = getBlogEmbeddingText({
        title: updatedPost.title,
        excerpt: updatedPost.excerpt,
        content: updatedPost.content,
        category: updatedPost.category,
      });

      // Fire-and-forget: Call edge function to regenerate embedding
      fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/generate-embedding`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
          },
          body: JSON.stringify({
            type: 'blog',
            id: updatedPost.id,
            text: embeddingText,
          }),
        }
      ).catch((err) =>
        console.error('Failed to regenerate blog embedding:', err)
      );
    }

    return NextResponse.json(updatedPost);
  } catch (error) {
    console.error('Blog post PATCH error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const auth = await authenticateApiRequest(_request);
    if (auth.error || !auth.user) {
      return NextResponse.json(
        { error: auth.error || 'Unauthorized' },
        { status: 401 }
      );
    }

    const access = await getUserAccess(auth.user.id);
    if (!access) {
      return NextResponse.json(
        { error: 'Merchant not found' },
        { status: 404 }
      );
    }

    if (!hasPermission(access, 'marketing', 'edit')) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
    }

    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    // Delete post
    const { error: deleteError } = await supabase
      .from('blog_posts')
      .delete()
      .eq('id', id)
      .eq('merchant_id', access.merchantId);

    if (deleteError) {
      console.error('Error deleting blog post:', deleteError);
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Blog post DELETE error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
