
import React, { useEffect, useState } from 'react';
import { BookOpen, Calendar, User, ArrowRight, Tag, Battery, Smartphone, Shield } from 'lucide-react';
import { AdUnit } from './AdUnit';

interface BlogPost {
  id: number;
  title: string;
  excerpt: string;
  category: string;
  author: string;
  date: string;
  image: string;
  readTime: string;
  featured?: boolean;
}

const BLOG_POSTS: BlogPost[] = [
  {
    id: 1,
    title: "5 Simple Ways to Extend Your iPhone's Battery Life",
    excerpt: "Stop charging to 100% overnight. Here is why optimized charging and heat management are the keys to a long-lasting battery.",
    category: "Tips & Tricks",
    author: "Ogabassey Tech Team",
    date: "May 15, 2024",
    image: "https://images.unsplash.com/photo-1618412956275-c54d7e972d0a?q=80&w=1000&auto=format&fit=crop",
    readTime: "4 min read",
    featured: true
  },
  {
    id: 2,
    title: "Don't Replace It Yet: The Magic of Port Cleaning",
    excerpt: "Think your phone is broken? It might just be lint. We explain how simple maintenance can save you thousands of Naira.",
    category: "Sustainability",
    author: "Repair Lab",
    date: "May 10, 2024",
    image: "https://images.unsplash.com/photo-1591196752762-df2252b47424?q=80&w=1000&auto=format&fit=crop",
    readTime: "3 min read"
  },
  {
    id: 3,
    title: "iPhone 15 Pro vs 14 Pro: Is the Upgrade Worth It?",
    excerpt: "We break down the titanium design, A17 Pro chip, and camera improvements to help you decide if it's time to switch.",
    category: "Reviews",
    author: "Editor's Desk",
    date: "April 28, 2024",
    image: "https://images.unsplash.com/photo-1696446701796-da61225697cc?q=80&w=1000&auto=format&fit=crop",
    readTime: "6 min read"
  },
  {
    id: 4,
    title: "Understanding Screen Protection: Glass vs. Hydrogel",
    excerpt: "Which one actually saves your screen from a fall? We tested both so you don't have to.",
    category: "Guides",
    author: "Ogabassey Tech Team",
    date: "April 15, 2024",
    image: "https://images.unsplash.com/photo-1605236453806-6ff36851218e?q=80&w=1000&auto=format&fit=crop",
    readTime: "5 min read"
  },
  {
    id: 5,
    title: "The Environmental Impact of Buying Used Tech",
    excerpt: "How choosing a UK Used device contributes to a circular economy and reduces e-waste globally.",
    category: "Sustainability",
    author: "Green Initiative",
    date: "March 22, 2024",
    image: "https://images.unsplash.com/photo-1532601224476-15c79f2f7a51?q=80&w=1000&auto=format&fit=crop",
    readTime: "4 min read"
  }
];

export const BlogPage: React.FC = () => {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const [activeCategory, setActiveCategory] = useState('All');
  const categories = ['All', 'Tips & Tricks', 'Reviews', 'Sustainability', 'Guides'];

  const filteredPosts = activeCategory === 'All' 
    ? BLOG_POSTS 
    : BLOG_POSTS.filter(post => post.category === activeCategory);

  const featuredPost = BLOG_POSTS.find(p => p.featured);

  return (
    <div className="min-h-screen bg-gray-50 pb-20 pt-4">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 pb-10 pt-8 mb-8">
        <div className="max-w-[1400px] mx-auto px-4 md:px-6 text-center">
            <h1 className="text-3xl md:text-5xl font-extrabold text-gray-900 mb-4 tracking-tight">
                Ogabassey <span className="text-red-600">Insights</span>
            </h1>
            <p className="text-gray-500 max-w-2xl mx-auto text-lg">
                Expert reviews, maintenance tips, and sustainability guides to help you get the most out of your tech.
            </p>
        </div>
      </div>

      <div className="max-w-[1400px] mx-auto px-4 md:px-6">
        
        {/* Featured Post */}
        {activeCategory === 'All' && featuredPost && (
            <div className="mb-16 rounded-3xl overflow-hidden shadow-xl relative group h-[400px] md:h-[500px]">
                <img 
                    src={featuredPost.image} 
                    alt={featuredPost.title} 
                    className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent"></div>
                <div className="absolute bottom-0 left-0 p-8 md:p-12 w-full md:w-2/3 text-white">
                    <span className="bg-red-600 text-white text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider mb-4 inline-block">
                        Featured
                    </span>
                    <h2 className="text-3xl md:text-5xl font-bold mb-4 leading-tight">{featuredPost.title}</h2>
                    <p className="text-gray-200 text-lg mb-6 line-clamp-2">{featuredPost.excerpt}</p>
                    <button className="flex items-center gap-2 font-bold text-white hover:text-red-400 transition-colors">
                        Read Article <ArrowRight size={20} />
                    </button>
                </div>
            </div>
        )}

        {/* Categories */}
        <div className="flex overflow-x-auto gap-3 pb-4 mb-8 hide-scrollbar">
            {categories.map(cat => (
                <button
                    key={cat}
                    onClick={() => setActiveCategory(cat)}
                    className={`px-6 py-2.5 rounded-full text-sm font-bold whitespace-nowrap transition-all ${
                        activeCategory === cat 
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
            {filteredPosts.filter(p => !p.featured || activeCategory !== 'All').map((post) => (
                <article key={post.id} className="bg-white rounded-2xl overflow-hidden border border-gray-100 shadow-sm hover:shadow-xl transition-all duration-300 group flex flex-col h-full">
                    <div className="h-56 overflow-hidden relative">
                        <img 
                            src={post.image} 
                            alt={post.title} 
                            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                        />
                        <div className="absolute top-4 left-4 bg-white/90 backdrop-blur-md px-3 py-1 rounded-full text-xs font-bold text-gray-900">
                            {post.category}
                        </div>
                    </div>
                    <div className="p-6 flex flex-col flex-1">
                        <div className="flex items-center gap-4 text-xs text-gray-400 mb-3">
                            <span className="flex items-center gap-1"><Calendar size={12} /> {post.date}</span>
                            <span>•</span>
                            <span>{post.readTime}</span>
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
                                <span className="text-xs font-bold text-gray-700">{post.author}</span>
                            </div>
                            <button className="text-red-600 hover:text-red-700 transition-colors">
                                <ArrowRight size={20} />
                            </button>
                        </div>
                    </div>
                </article>
            ))}
        </div>

        {/* Sustainability Tip Banner */}
        <div className="bg-green-50 rounded-2xl p-8 border border-green-100 flex flex-col md:flex-row items-center gap-8 mb-16">
            <div className="bg-white p-4 rounded-full shadow-sm text-green-600 shrink-0">
                <Battery size={32} />
            </div>
            <div className="flex-1 text-center md:text-left">
                <h3 className="text-xl font-bold text-gray-900 mb-2">Did you know?</h3>
                <p className="text-gray-600">
                    Keeping your phone battery between 20% and 80% can double its lifespan. Read more tips in our <span className="font-bold text-green-700">Sustainability</span> section.
                </p>
            </div>
            <button 
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
