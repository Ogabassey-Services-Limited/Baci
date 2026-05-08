'use client';

import { ArrowRight, Battery, Calendar, User, Search } from 'lucide-react';
import Link from 'next/link';
import type React from 'react';
import { useState } from 'react';
import { useMerchantSafe } from '@/hooks/use-merchant';
import { HeroImage, ProductCardImage } from '@/components/optimized-image';
import { asRoute } from '@/lib/routes';
import type { TemplateBlogPageProps, BlogPostData } from '@/templates/registry';
import { AdUnit } from './ad-unit';

// Re-export BlogPost type for external use
export type BlogPost = BlogPostData;

interface OgabasseyBlogProps extends TemplateBlogPageProps {
  merchantSlug?: string; // Optional override, otherwise uses storeSlug
  searchQuery?: string; // Optional search query for filtering
}

// Format date helper
function formatDate(dateString: string): string {
  try {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return dateString;
  }
}

export const OgabasseyV2Blog: React.FC<OgabasseyBlogProps> = ({
  posts = [],
  storeSlug,
  merchantSlug,
  categories: propCategories,
  searchQuery,
}) => {
  const merchantContext = useMerchantSafe();
  const basePath = merchantContext?.basePath ?? (storeSlug || '');
  const [activeCategory, setActiveCategory] = useState('All');
  const isSearching = !!searchQuery;


  // Use predefined categories as requested
  const categories = [
    'All',
    'Mobile Gadgets',
    'Laptops',
    'Tips and Tricks',
    'Reviews',
    'Tech News',
    'How to Guides',
    'Buying Guides',
    'Smartphone Comparisons',
    'Product Guides',
  ];

  const filteredPosts =
    activeCategory === 'All'
      ? posts
      : posts.filter((post) => post.category === activeCategory);

  const featuredPost = posts.find((p) => p.featured) || posts[0];

  // Empty state
  if (posts.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 pb-20 pt-4">
        <div className="bg-white border-b border-gray-100 pb-10 pt-8 mb-8">
          <div className="max-w-[1400px] mx-auto px-4 md:px-6 text-center">
            <h1 className="text-3xl md:text-5xl font-extrabold text-gray-900 mb-4 tracking-tight">
              The Ogabassey Blog
            </h1>
            <p className="text-gray-500 text-lg">No posts found.</p>
          </div>
        </div>
        <div className="max-w-[1400px] mx-auto px-4 md:px-6">
          <div className="bg-white rounded-2xl p-12 text-center border border-gray-100">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">No posts yet</h2>
            <p className="text-gray-500 mb-6">
              Check back soon for expert reviews, tips, and guides!
            </p>
            <Link
              href={asRoute(basePath || '/')}
              className="inline-flex items-center gap-2 bg-red-600 text-white font-bold py-3 px-6 rounded-xl hover:bg-red-700 transition-colors"
            >
              Back to Store <ArrowRight size={20} />
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20 pt-4">
      <div className="max-w-[1400px] mx-auto px-4 md:px-6 pt-8 md:pt-12">
        {/* 1. Featured Post - Moved to Top */}
        {!isSearching && activeCategory === 'All' && featuredPost && (
          <Link
            href={asRoute(`${basePath}/blog/${featuredPost.slug}`)}
            className="group relative block mb-12 rounded-4xl overflow-hidden shadow-2xl h-[400px] md:h-[500px] transform transition-all hover:shadow-[0_20px_50px_rgba(0,0,0,0.15)]"
          >
            <div className="absolute inset-0 bg-gray-900">
              <HeroImage
                src={featuredPost.featured_image_url || '/placeholder.png'}
                alt={featuredPost.title}
                className="object-cover opacity-90 transition-transform duration-1000 group-hover:scale-105"
                fill
              />
              <div className="absolute inset-0 bg-linear-to-t from-gray-900 via-gray-900/20 to-transparent" />
            </div>

            <div className="absolute bottom-0 left-0 p-8 md:p-12 w-full md:w-3/4 lg:w-2/3">
              <div className="flex items-center gap-3 mb-4">
                <span className="bg-red-600 text-white text-[10px] md:text-xs font-black px-3 py-1.5 rounded uppercase tracking-widest shadow-sm">
                  Featured Story
                </span>
                {featuredPost.category && (
                  <span className="text-white/80 text-xs font-bold uppercase tracking-wider px-2 py-1 border border-white/20 rounded backdrop-blur-xs">
                    {featuredPost.category}
                  </span>
                )}
              </div>

              <h2 className="text-3xl md:text-5xl lg:text-6xl font-black text-white mb-4 leading-none transition-colors group-hover:text-red-50">
                {featuredPost.title}
              </h2>

              <p className="text-gray-300 text-lg md:text-xl mb-6 line-clamp-2 max-w-2xl leading-relaxed">
                {featuredPost.excerpt}
              </p>

              <div className="flex items-center gap-4 text-white font-medium">
                <span className="flex items-center gap-2 group-hover:gap-4 transition-all duration-300 border-b border-white/30 pb-0.5 group-hover:border-white">
                  Read Article <ArrowRight size={20} />
                </span>
                <span className="text-white/40">•</span>
                <span className="text-white/80 text-sm">
                  {formatDate(featuredPost.published_at)}
                </span>
              </div>
            </div>
          </Link>
        )}

        {/* 2. Simplified Header - Moved Middle */}
        <div className="flex flex-col justify-center items-center text-center mb-12">
          {isSearching ? (
            <div className="max-w-3xl text-left w-full">
              <div className="flex items-center gap-2 mb-4 text-sm font-medium text-red-600 uppercase tracking-wider">
                <Search size={16} /> Search Results
              </div>
              <h1 className="text-4xl md:text-6xl font-black text-gray-900 mb-6 tracking-tight leading-none">
                For "{searchQuery}"
              </h1>
              <Link
                href={asRoute(`${basePath}/blog`)}
                className="inline-flex items-center gap-2 text-gray-500 hover:text-gray-900 border-b border-gray-300 hover:border-gray-900 transition-colors pb-0.5"
              >
                <ArrowRight size={16} className="rotate-180" />
                Clear search
              </Link>
            </div>
          ) : (
            <div className="w-full text-center">
              <h1 className="text-4xl md:text-7xl font-black text-gray-900 mb-4 tracking-tight leading-[0.9]">
                The Ogabassey Blog
              </h1>
              <p className="text-gray-500 text-lg md:text-xl w-full mx-auto leading-relaxed">
                Tech reviews, sustainability guides, and the latest from the world
                of gadgets.
              </p>
            </div>
          )}
        </div>
        {/* 3. Categories as Filter Bar - Above Grid */}
        <div className="sticky top-20 z-30 bg-gray-50/95 backdrop-blur-xs pt-2 pb-6 border-b border-gray-200/50 mb-10 -mx-4 px-4 md:px-0 md:mx-0">
          <div className="flex overflow-x-auto gap-2 md:gap-3 hide-scrollbar items-center">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-widest mr-2 shrink-0">
              Filter By:
            </span>
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setActiveCategory(cat)}
                className={`px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap transition-all border ${activeCategory === cat
                  ? 'bg-gray-900 text-white border-gray-900 shadow-md transform scale-105'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400 hover:bg-gray-100'
                  }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* 4. Blog Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-12">
          {filteredPosts
            .filter((p) => p.id !== featuredPost?.id || activeCategory !== 'All')
            .map((post) => (
              <Link
                key={post.id}
                href={asRoute(`${basePath}/blog/${post.slug}`)}
                className="block h-full"
              >
                <article className="bg-white rounded-2xl overflow-hidden border border-gray-100 shadow-sm hover:shadow-xl transition-all duration-300 group flex flex-col h-full hover:-translate-y-1">
                  <div className="h-64 overflow-hidden relative">
                    <ProductCardImage
                      src={post.featured_image_url || '/placeholder.png'}
                      alt={post.title}
                      className="object-cover transition-transform duration-700 group-hover:scale-110"
                      fill
                      category={post.category}
                    />
                    {post.category && (
                      <div className="absolute top-4 left-4 bg-white/95 backdrop-blur-md px-3 py-1 rounded text-xs font-black uppercase tracking-wider text-gray-900 border border-gray-100 shadow-sm">
                        {post.category}
                      </div>
                    )}
                  </div>
                  <div className="p-6 flex flex-col flex-1">
                    <div className="flex items-center gap-4 text-xs font-bold text-gray-400 mb-4 uppercase tracking-wider">
                      <span className="flex items-center gap-1">
                        <Calendar size={12} className="text-red-500" /> {formatDate(post.published_at)}
                      </span>
                      <span className="w-1 h-1 rounded-full bg-gray-300"></span>
                      <span>{post.reading_time_minutes || 3} MIN READ</span>
                    </div>

                    <h3 className="text-xl md:text-2xl font-black text-gray-900 mb-3 line-clamp-2 leading-tight group-hover:text-red-600 transition-colors">
                      {post.title}
                    </h3>

                    <p className="text-gray-500 text-sm md:text-base mb-6 line-clamp-3 flex-1 leading-relaxed">
                      {post.excerpt}
                    </p>

                    <div className="flex items-center justify-between pt-6 border-t border-gray-50 mt-auto">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 border border-gray-200">
                          <User size={14} />
                        </div>
                        <span className="text-xs font-bold text-gray-700">
                          {post.author_name || 'Ogabassey Team'}
                        </span>
                      </div>
                      <span className="text-red-600 group-hover:text-red-700 transition-transform group-hover:translate-x-1">
                        <ArrowRight size={20} />
                      </span>
                    </div>
                  </div>
                </article>
              </Link>
            ))}
        </div>

        {/* Sustainability Tip Banner */}
        <div className="bg-linear-to-br from-green-50 to-emerald-50 rounded-3xl p-8 md:p-12 border border-green-100 flex flex-col md:flex-row items-center gap-8 mb-16 shadow-lg">
          <div className="bg-white p-6 rounded-2xl shadow-md text-green-600 shrink-0 transform rotate-3">
            <Battery size={40} />
          </div>
          <div className="flex-1 text-center md:text-left">
            <h3 className="text-2xl font-black text-gray-900 mb-3">
              Extend Your Tech's Life
            </h3>
            <p className="text-gray-600 text-lg">
              Keeping your phone battery between 20% and 80% can double its
              lifespan. Read more tips in our{' '}
              <span className="font-bold text-green-700">Sustainability</span>{' '}
              section.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setActiveCategory('Sustainability')}
            className="bg-green-600 text-white font-bold py-4 px-8 rounded-xl hover:bg-green-700 transition-all shadow-xl hover:shadow-2xl hover:-translate-y-1 active:scale-95"
          >
            View Green Tips
          </button>
        </div>

        <AdUnit placementKey="FOOTER_BANNER" />
      </div>
    </div>
  );
};
