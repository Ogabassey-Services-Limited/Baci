import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';
import z from 'zod';
import {
  authenticateApiRequest,
  getUserAccess,
  hasPermission,
} from '@/lib/api-auth';
import { checkCsrfProtection } from '@/lib/csrf';
import { getBlogEmbeddingText } from '@/lib/embeddings';
import { createClient } from '@/lib/supabase/server';

/**
 * Blog Posts API - List and Create
 *
 * GET: List all blog posts for the authenticated merchant
 * POST: Create a new blog post
 */

// Validation schema for creating a blog post
const createPostSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200),
  slug: z
    .string()
    .min(1)
    .max(200)
    .regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens'),
  content: z.string().min(1, 'Content is required'),
  excerpt: z.string().max(300).optional(),
  featured_image_url: z.string().url().optional().nullable(),
  featured_image_alt: z.string().max(200).optional(),
  category: z.string().max(100).optional(),
  tags: z.array(z.string()).optional(),
  keywords: z.array(z.string()).optional(),
  author_name: z.string().min(1, 'Author name is required').max(100),
  author_title: z.string().max(100).optional(),
  author_image_url: z.string().url().optional().nullable(),
  author_bio: z.string().max(500).optional(),
  status: z.enum(['draft', 'published', 'archived']).optional(),
  seo_title: z.string().max(70).optional(),
  seo_description: z.string().max(160).optional(),
  focus_keyword: z.string().max(50).optional(),
});

// Calculate reading time based on word count
function calculateReadingTime(content: string): number {
  const wordsPerMinute = 200;
  const wordCount = calculateWordCount(content);
  return Math.ceil(wordCount / wordsPerMinute);
}

// Calculate word count
function calculateWordCount(content: string): number {
  return content.split(/\s+/).filter(Boolean).length;
}

// Generate slug from title
function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .substring(0, 200);
}

// Strip HTML tags from content for plain text extraction
function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Auto-generate SEO description from content
function generateSeoDescription(content: string, maxLength = 155): string {
  const plainText = stripHtml(content);
  if (plainText.length <= maxLength) return plainText;

  // Find the last complete word within maxLength
  const truncated = plainText.substring(0, maxLength);
  const lastSpace = truncated.lastIndexOf(' ');
  return lastSpace > 0
    ? `${truncated.substring(0, lastSpace)}...`
    : `${truncated}...`;
}

// Auto-generate excerpt from content
function generateExcerpt(content: string, maxLength = 300): string {
  const plainText = stripHtml(content);
  if (plainText.length <= maxLength) return plainText;

  const truncated = plainText.substring(0, maxLength);
  const lastSpace = truncated.lastIndexOf(' ');
  return lastSpace > 0
    ? `${truncated.substring(0, lastSpace)}...`
    : `${truncated}...`;
}

// Extract keywords from title and content
function extractKeywords(title: string, content: string): string[] {
  const plainText = stripHtml(content).toLowerCase();
  const titleWords = title.toLowerCase().split(/\s+/);

  // Common stop words to exclude
  const stopWords = new Set([
    'the',
    'a',
    'an',
    'and',
    'or',
    'but',
    'in',
    'on',
    'at',
    'to',
    'for',
    'of',
    'with',
    'by',
    'from',
    'is',
    'are',
    'was',
    'were',
    'be',
    'been',
    'being',
    'have',
    'has',
    'had',
    'do',
    'does',
    'did',
    'will',
    'would',
    'could',
    'should',
    'may',
    'might',
    'must',
    'shall',
    'can',
    'this',
    'that',
    'these',
    'those',
    'it',
    'its',
    'you',
    'your',
    'we',
    'our',
    'they',
    'their',
    'i',
    'my',
    'me',
    'he',
    'she',
    'him',
    'her',
    'as',
    'if',
    'then',
    'than',
    'so',
    'just',
    'only',
    'also',
    'very',
    'too',
  ]);

  // Get meaningful words from title (higher priority)
  const keywords = titleWords.filter(
    (word) => word.length > 3 && !stopWords.has(word)
  );

  // Add frequent words from content (limit to 10 total)
  const contentWords = plainText
    .split(/\s+/)
    .filter(
      (word) =>
        word.length > 4 && !stopWords.has(word) && !keywords.includes(word)
    );

  // Count word frequency
  const wordCount: Record<string, number> = {};
  contentWords.forEach((word) => {
    wordCount[word] = (wordCount[word] || 0) + 1;
  });

  // Sort by frequency and take top words
  const topContentWords = Object.entries(wordCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10 - keywords.length)
    .map(([word]) => word);

  return [...new Set([...keywords, ...topContentWords])].slice(0, 10);
}

export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateApiRequest(request);
    if (auth.error || !auth.user || !auth.supabase) {
      return NextResponse.json(
        { error: auth.error || 'Unauthorized' },
        { status: 401 }
      );
    }

    const access = await getUserAccess(auth.supabase);
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

    // Parse query params
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const category = searchParams.get('category');
    const search = searchParams.get('search');
    const limit = Number.parseInt(searchParams.get('limit') || '20', 10);
    const offset = Number.parseInt(searchParams.get('offset') || '0', 10);
    const sortBy = searchParams.get('sortBy') || 'created_at';
    const sortOrder = searchParams.get('sortOrder') === 'asc';

    // Build query
    let query = supabase
      .from('blog_posts')
      .select('*', { count: 'exact' })
      .eq('merchant_id', access.merchantId);

    // Apply filters
    if (status) {
      query = query.eq('status', status);
    }

    if (category) {
      query = query.eq('category', category);
    }

    if (search) {
      // Sanitize search input to prevent filter injection (escape %, _, \)
      const sanitized = search.replace(/[%_\\]/g, '\\$&');
      query = query.or(
        `title.ilike.%${sanitized}%,content.ilike.%${sanitized}%`
      );
    }

    // Apply sorting
    query = query.order(sortBy, { ascending: sortOrder });

    // Apply pagination
    query = query.range(offset, offset + limit - 1);

    // Execute posts query and counts in parallel for maximum performance
    const [
      { data: posts, error: postsError, count },
      { count: totalCount },
      { count: publishedCount },
      { count: draftCount },
      { count: archivedCount },
    ] = await Promise.all([
      // 1. Fetch posts with filters and pagination
      query,
      // 2. Fetch total count
      supabase
        .from('blog_posts')
        .select('*', { count: 'exact', head: true })
        .eq('merchant_id', access.merchantId),
      // 3. Fetch published count
      supabase
        .from('blog_posts')
        .select('*', { count: 'exact', head: true })
        .eq('merchant_id', access.merchantId)
        .eq('status', 'published'),
      // 4. Fetch draft count
      supabase
        .from('blog_posts')
        .select('*', { count: 'exact', head: true })
        .eq('merchant_id', access.merchantId)
        .eq('status', 'draft'),
      // 5. Fetch archived count
      supabase
        .from('blog_posts')
        .select('*', { count: 'exact', head: true })
        .eq('merchant_id', access.merchantId)
        .eq('status', 'archived'),
    ]);

    if (postsError) {
      console.error('Error fetching blog posts:', postsError);
      return NextResponse.json({ error: postsError.message }, { status: 500 });
    }

    return NextResponse.json({
      posts: posts || [],
      total: count || 0,
      limit,
      offset,
      hasMore: (count || 0) > offset + limit,
      counts: {
        total: totalCount || 0,
        published: publishedCount || 0,
        draft: draftCount || 0,
        archived: archivedCount || 0,
      },
    });
  } catch (error) {
    console.error('Blog posts GET error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { valid, response } = await checkCsrfProtection(request);
    if (!valid && response) return response;

    const auth = await authenticateApiRequest(request);
    if (auth.error || !auth.user || !auth.supabase) {
      return NextResponse.json(
        { error: auth.error || 'Unauthorized' },
        { status: 401 }
      );
    }

    const access = await getUserAccess(auth.supabase);
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

    // Get merchant business name if needed (optional, or we can use metadata)
    const { data: merchantData } = await supabase
      .from('merchants')
      .select('business_name')
      .eq('id', access.merchantId)
      .single();

    const merchant = {
      id: access.merchantId,
      business_name: merchantData?.business_name || 'Store Owner',
    };

    // Check if blog feature is enabled
    const { data: features } = await supabase
      .from('merchant_feature_settings')
      .select('blog_enabled')
      .eq('merchant_id', merchant.id)
      .single();

    if (!features?.blog_enabled) {
      return NextResponse.json(
        {
          error:
            'Blog feature is not enabled. Enable it in Settings > Features.',
        },
        { status: 403 }
      );
    }

    // Parse and validate body
    const body = await request.json();

    // Auto-generate slug if not provided
    if (!body.slug && body.title) {
      body.slug = generateSlug(body.title);
    }

    // Set default author name if not provided
    if (!body.author_name) {
      body.author_name = merchant.business_name;
    }

    const validated = createPostSchema.safeParse(body);
    if (!validated.success) {
      return NextResponse.json(
        { error: 'Validation error', details: validated.error.flatten() },
        { status: 400 }
      );
    }

    const postData = validated.data;

    // Check if slug already exists for this merchant
    const { data: existingPost } = await supabase
      .from('blog_posts')
      .select('id')
      .eq('merchant_id', merchant.id)
      .eq('slug', postData.slug)
      .maybeSingle();

    if (existingPost) {
      return NextResponse.json(
        { error: 'A post with this slug already exists' },
        { status: 409 }
      );
    }

    // Calculate reading time and word count
    const wordCount = calculateWordCount(postData.content);
    const readingTime = calculateReadingTime(postData.content);

    // Auto-generate SEO fields if not provided
    const autoExcerpt = postData.excerpt || generateExcerpt(postData.content);
    const autoSeoTitle = postData.seo_title || postData.title.substring(0, 70);
    const autoSeoDescription =
      postData.seo_description || generateSeoDescription(postData.content);
    const autoKeywords = postData.keywords?.length
      ? postData.keywords
      : extractKeywords(postData.title, postData.content);
    const autoFocusKeyword =
      postData.focus_keyword ||
      (autoKeywords.length > 0 ? autoKeywords[0] : undefined);

    // Prepare insert data
    const insertData = {
      merchant_id: merchant.id,
      title: postData.title,
      slug: postData.slug,
      content: postData.content,
      excerpt: autoExcerpt,
      featured_image_url: postData.featured_image_url,
      featured_image_alt: postData.featured_image_alt,
      category: postData.category,
      tags: postData.tags || [],
      keywords: autoKeywords,
      author_name: postData.author_name,
      author_title: postData.author_title,
      author_image_url: postData.author_image_url,
      author_bio: postData.author_bio,
      status: postData.status || 'draft',
      seo_title: autoSeoTitle,
      seo_description: autoSeoDescription,
      focus_keyword: autoFocusKeyword,
      word_count: wordCount,
      reading_time_minutes: readingTime,
      published_at:
        postData.status === 'published' ? new Date().toISOString() : null,
    };

    const { data: newPost, error: insertError } = await supabase
      .from('blog_posts')
      .insert(insertData)
      .select()
      .single();

    if (insertError) {
      console.error('Error creating blog post:', insertError);
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    // Generate embedding asynchronously (non-blocking)
    if (newPost?.id) {
      const embeddingText = getBlogEmbeddingText({
        title: postData.title,
        excerpt: autoExcerpt,
        content: postData.content,
        category: postData.category,
      });

      // Fire-and-forget: Call edge function to generate embedding
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
            id: newPost.id,
            text: embeddingText,
          }),
        }
      ).catch((err) =>
        console.error('Failed to generate blog embedding:', err)
      );
    }

    return NextResponse.json(newPost, { status: 201 });
  } catch (error) {
    console.error('Blog posts POST error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
