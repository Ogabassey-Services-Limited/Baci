'use client';

import { ArrowRight, Battery, Calendar, User } from 'lucide-react';
import Link from 'next/link';
import type React from 'react';
import { useState } from 'react';
import type { TemplateBlogPageProps, BlogPostData } from '@/templates/registry';
import { AdUnit } from './ad-unit';

// Re-export BlogPost type for external use
export type BlogPost = BlogPostData;

interface OgabasseyBlogProps extends TemplateBlogPageProps {
  merchantSlug?: string; // Optional override, otherwise uses storeSlug
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
}) => {
  const slug = merchantSlug || storeSlug || 'ogabassey';
  const [activeCategory, setActiveCategory] = useState('All');


  // Extract unique categories from posts if not provided
  const categories = propCategories?.length
    ? ['All', ...propCategories]
    : ['All', ...new Set(posts.map((p) => p.category).filter(Boolean))];

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
              Ogabassey <span className="text-red-600">Insights</span>
            </h1>
            <p className="text-gray-500 max-w-2xl mx-auto text-lg">
              Expert reviews, maintenance tips, and sustainability guides to help
              you get the most out of your tech.
            </p>
          </div>
        </div>
        <div className="max-w-[1400px] mx-auto px-4 md:px-6">
          <div className="bg-white rounded-2xl p-12 text-center border border-gray-100">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">No posts yet</h2>
            <p className="text-gray-500 mb-6">
              Check back soon for expert reviews, tips, and guides!
            </p>
            <Link
              href={`/${slug}`}
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
      {/* Header */}
      <div className="bg-white border-b border-gray-100 pb-10 pt-8 mb-8">
        <div className="max-w-[1400px] mx-auto px-4 md:px-6 text-center">
          <h1 className="text-3xl md:text-5xl font-extrabold text-gray-900 mb-4 tracking-tight">
            Ogabassey <span className="text-red-600">Insights</span>
          </h1>
          <p className="text-gray-500 max-w-2xl mx-auto text-lg">
            Expert reviews, maintenance tips, and sustainability guides to help
            you get the most out of your tech.
          </p>
        </div>
      </div>

      <div className="max-w-[1400px] mx-auto px-4 md:px-6">
        {/* Featured Post */}
        {activeCategory === 'All' && featuredPost && (
          <Link
            href={`/${slug}/blog/${featuredPost.slug}`}
            className="block mb-16 rounded-3xl overflow-hidden shadow-xl relative group h-[400px] md:h-[500px]"
          >
            <img
              src={featuredPost.featured_image_url || 'https://images.unsplash.com/photo-1618412956275-c54d7e972d0a?q=80&w=1000'}
              alt={featuredPost.title}
              className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent" />
            <div className="absolute bottom-0 left-0 p-8 md:p-12 w-full md:w-2/3 text-white">
              <span className="bg-red-600 text-white text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider mb-4 inline-block">
                Featured
              </span>
              <h2 className="text-3xl md:text-5xl font-bold mb-4 leading-tight">
                {featuredPost.title}
              </h2>
              <p className="text-gray-200 text-lg mb-6 line-clamp-2">
                {featuredPost.excerpt}
              </p>
              <span className="flex items-center gap-2 font-bold text-white group-hover:text-red-400 transition-colors">
                Read Article <ArrowRight size={20} />
              </span>
            </div>
          </Link>
        )}

        {/* Categories */}
        <div className="flex overflow-x-auto gap-3 pb-4 mb-8 hide-scrollbar">
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setActiveCategory(cat)}
              className={`px-6 py-2.5 rounded-full text-sm font-bold whitespace-nowrap transition-all ${activeCategory === cat
                ? 'bg-gray-900 text-white shadow-lg'
                : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-100'
                }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Blog Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-12">
          {filteredPosts
            .filter((p) => p.id !== featuredPost?.id || activeCategory !== 'All')
            .map((post) => (
              <Link
                key={post.id}
                href={`/${slug}/blog/${post.slug}`}
                className="block"
              >
                <article className="bg-white rounded-2xl overflow-hidden border border-gray-100 shadow-sm hover:shadow-xl transition-all duration-300 group flex flex-col h-full">
                  <div className="h-56 overflow-hidden relative">
                    <img
                      src={post.featured_image_url || 'https://images.unsplash.com/photo-1618412956275-c54d7e972d0a?q=80&w=1000'}
                      alt={post.title}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                    />
                    {post.category && (
                      <div className="absolute top-4 left-4 bg-white/90 backdrop-blur-md px-3 py-1 rounded-full text-xs font-bold text-gray-900">
                        {post.category}
                      </div>
                    )}
                  </div>
                  <div className="p-6 flex flex-col flex-1">
                    <div className="flex items-center gap-4 text-xs text-gray-400 mb-3">
                      <span className="flex items-center gap-1">
                        <Calendar size={12} /> {formatDate(post.published_at)}
                      </span>
                      <span>•</span>
                      <span>{post.reading_time_minutes || 3} min read</span>
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 mb-3 line-clamp-2 group-hover:text-red-600 transition-colors">
                      {post.title}
                    </h3>
                    <p className="text-gray-500 text-sm mb-6 line-clamp-3 flex-1">
                      {post.excerpt}
                    </p>
                    <div className="flex items-center justify-between pt-6 border-t border-gray-50 mt-auto">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500">
                          <User size={14} />
                        </div>
                        <span className="text-xs font-bold text-gray-700">
                          {post.author_name || 'Ogabassey Team'}
                        </span>
                      </div>
                      <span className="text-red-600 group-hover:text-red-700 transition-colors">
                        <ArrowRight size={20} />
                      </span>
                    </div>
                  </div>
                </article>
              </Link>
            ))}
        </div>

        {/* Sustainability Tip Banner */}
        <div className="bg-green-50 rounded-2xl p-8 border border-green-100 flex flex-col md:flex-row items-center gap-8 mb-16">
          <div className="bg-white p-4 rounded-full shadow-sm text-green-600 shrink-0">
            <Battery size={32} />
          </div>
          <div className="flex-1 text-center md:text-left">
            <h3 className="text-xl font-bold text-gray-900 mb-2">
              Did you know?
            </h3>
            <p className="text-gray-600">
              Keeping your phone battery between 20% and 80% can double its
              lifespan. Read more tips in our{' '}
              <span className="font-bold text-green-700">Sustainability</span>{' '}
              section.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setActiveCategory('Sustainability')}
            className="bg-green-600 text-white font-bold py-3 px-6 rounded-xl hover:bg-green-700 transition-colors shadow-lg active:scale-95"
          >
            View Green Tips
          </button>
        </div>

        <AdUnit placementKey="FOOTER_BANNER" />
      </div>
    </div>
  );
};
