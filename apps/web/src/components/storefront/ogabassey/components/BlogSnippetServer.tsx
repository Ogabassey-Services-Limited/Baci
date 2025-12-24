/**
 * BlogSnippet Server Component
 *
 * Fetches semantically related blog posts based on product embeddings.
 * Falls back to category-based matching if no embedding match found.
 */

import { ArrowRight, BookOpen } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { createAdminClient } from '@/lib/supabase/admin';

interface BlogSnippetServerProps {
  productId: string;
  merchantId: string;
  category?: string;
  storeSlug: string;
}

interface BlogPost {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  featured_image_url: string | null;
  category: string | null;
  published_at: string | null;
  reading_time_minutes: number | null;
  similarity?: number;
}

export async function BlogSnippetServer({
  productId,
  merchantId,
  category,
  storeSlug,
}: BlogSnippetServerProps) {
  const supabase = createAdminClient();

  let post: BlogPost | null = null;

  // First, try semantic matching if product has embedding
  const { data: product } = await supabase
    .from('products')
    .select('content_embedding')
    .eq('id', productId)
    .single();

  if (product?.content_embedding) {
    // Use the semantic matching RPC function
    const { data: matches } = await supabase.rpc('match_blog_to_product', {
      product_embedding: product.content_embedding,
      merchant_id_filter: merchantId,
      match_threshold: 0.5, // Lower threshold to get more matches
      match_count: 1,
    });

    if (matches && matches.length > 0) {
      post = matches[0];
    }
  }

  // Fallback to category-based matching
  if (!post && category) {
    const { data: categoryPosts } = await supabase
      .from('blog_posts')
      .select(
        'id, title, slug, excerpt, featured_image_url, category, published_at, reading_time_minutes'
      )
      .eq('merchant_id', merchantId)
      .eq('status', 'published')
      .ilike('title', `%${category.split(' ')[0]}%`)
      .order('published_at', { ascending: false })
      .limit(1);

    if (categoryPosts && categoryPosts.length > 0) {
      post = categoryPosts[0];
    }
  }

  // Final fallback: get most recent post
  if (!post) {
    const { data: recentPosts } = await supabase
      .from('blog_posts')
      .select(
        'id, title, slug, excerpt, featured_image_url, category, published_at, reading_time_minutes'
      )
      .eq('merchant_id', merchantId)
      .eq('status', 'published')
      .order('published_at', { ascending: false })
      .limit(1);

    if (recentPosts && recentPosts.length > 0) {
      post = recentPosts[0];
    }
  }

  // No blog posts available
  if (!post) {
    return null;
  }

  const readTime = post.reading_time_minutes
    ? `${post.reading_time_minutes} min read`
    : '4 min read';

  return (
    <aside aria-label="Related Articles" className="mt-16 mb-8">
      <div className="flex items-center gap-2 mb-6">
        <BookOpen className="text-red-600" size={20} />
        <h3 className="text-xl font-bold text-gray-900">From the Blog</h3>
      </div>

      <Link href={`/${storeSlug}/blog/${post.slug}`} className="block">
        <div className="group relative overflow-hidden rounded-2xl bg-white border border-gray-100 shadow-lg hover:shadow-xl transition-all duration-300">
          <div className="flex flex-col md:flex-row">
            {/* Image Section */}
            <div className="md:w-1/3 h-48 md:h-auto overflow-hidden relative">
              <Image
                src={post.featured_image_url || '/placeholder.png'}
                alt={post.title}
                fill
                className="object-cover transition-transform duration-700 group-hover:scale-110"
                sizes="(max-width: 768px) 100vw, 33vw"
              />
              <div className="absolute inset-0 bg-black/10 group-hover:bg-transparent transition-colors" />
              {post.category && (
                <div className="absolute top-4 left-4 bg-white/90 backdrop-blur text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider text-gray-800">
                  {post.category}
                </div>
              )}
            </div>

            {/* Content Section */}
            <div className="p-6 md:p-8 flex-1 flex flex-col justify-center">
              <div className="flex items-center gap-2 text-xs text-gray-400 mb-2">
                <span>Ogabassey Editor</span>
                <span>•</span>
                <span>{readTime}</span>
              </div>
              <h4 className="text-2xl font-bold text-gray-900 mb-3 group-hover:text-red-600 transition-colors line-clamp-2">
                {post.title}
              </h4>
              {post.excerpt && (
                <p className="text-gray-600 mb-6 line-clamp-2 md:line-clamp-none">
                  {post.excerpt}
                </p>
              )}

              <span className="inline-flex items-center gap-2 text-sm font-bold text-red-600 hover:text-red-700 uppercase tracking-wider">
                Read Full Article{' '}
                <ArrowRight
                  size={16}
                  className="group-hover:translate-x-1 transition-transform"
                />
              </span>
            </div>
          </div>
        </div>
      </Link>
    </aside>
  );
}
