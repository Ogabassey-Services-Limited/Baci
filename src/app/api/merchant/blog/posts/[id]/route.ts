import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';

/**
 * Blog Post API - Single Post Operations
 *
 * GET: Get a single blog post by ID
 * PATCH: Update a blog post
 * DELETE: Delete a blog post
 */

// Validation schema for updating a blog post
const updatePostSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  slug: z
    .string()
    .min(1)
    .max(200)
    .regex(/^[a-z0-9-]+$/)
    .optional(),
  content: z.string().min(1).optional(),
  excerpt: z.string().max(300).optional().nullable(),
  featured_image_url: z.string().url().optional().nullable(),
  featured_image_alt: z.string().max(200).optional().nullable(),
  category: z.string().max(100).optional().nullable(),
  tags: z.array(z.string()).optional(),
  keywords: z.array(z.string()).optional(),
  author_name: z.string().min(1).max(100).optional(),
  author_title: z.string().max(100).optional().nullable(),
  author_image_url: z.string().url().optional().nullable(),
  author_bio: z.string().max(500).optional().nullable(),
  status: z.enum(['draft', 'published', 'archived']).optional(),
  seo_title: z.string().max(70).optional().nullable(),
  seo_description: z.string().max(160).optional().nullable(),
  focus_keyword: z.string().max(50).optional().nullable(),
});

interface RouteParams {
  params: Promise<{ id: string }>;
}

// Calculate reading time based on word count
function calculateReadingTime(content: string): number {
  const wordsPerMinute = 200;
  const wordCount = content.split(/\s+/).length;
  return Math.ceil(wordCount / wordsPerMinute);
}

// Calculate word count
function calculateWordCount(content: string): number {
  return content.split(/\s+/).filter(Boolean).length;
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    // Get authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get merchant for user
    const { data: merchant, error: merchantError } = await supabase
      .from('merchants')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (merchantError || !merchant) {
      return NextResponse.json(
        { error: 'Merchant not found' },
        { status: 404 }
      );
    }

    // Get blog post
    const { data: post, error } = await supabase
      .from('blog_posts')
      .select('*')
      .eq('id', id)
      .eq('merchant_id', merchant.id)
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
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    // Get authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get merchant for user
    const { data: merchant, error: merchantError } = await supabase
      .from('merchants')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (merchantError || !merchant) {
      return NextResponse.json(
        { error: 'Merchant not found' },
        { status: 404 }
      );
    }

    // Get existing post
    const { data: existingPost, error: fetchError } = await supabase
      .from('blog_posts')
      .select('*')
      .eq('id', id)
      .eq('merchant_id', merchant.id)
      .single();

    if (fetchError || !existingPost) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    }

    // Parse and validate body
    const body = await request.json();
    const validated = updatePostSchema.safeParse(body);

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
        .eq('merchant_id', merchant.id)
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

    // Set published_at if status is changing to published
    if (
      updateData.status === 'published' &&
      existingPost.status !== 'published'
    ) {
      updateData.published_at = new Date().toISOString();
    }

    // Update post
    const { data: updatedPost, error: updateError } = await supabase
      .from('blog_posts')
      .update(updateData)
      .eq('id', id)
      .eq('merchant_id', merchant.id)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating blog post:', updateError);
      return NextResponse.json({ error: updateError.message }, { status: 500 });
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
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    // Get authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get merchant for user
    const { data: merchant, error: merchantError } = await supabase
      .from('merchants')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (merchantError || !merchant) {
      return NextResponse.json(
        { error: 'Merchant not found' },
        { status: 404 }
      );
    }

    // Delete post
    const { error: deleteError } = await supabase
      .from('blog_posts')
      .delete()
      .eq('id', id)
      .eq('merchant_id', merchant.id);

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
