
import React from 'react';
import { ArrowRight, BookOpen } from 'lucide-react';
import { Link } from 'react-router-dom';

interface BlogSnippetProps {
  category: string;
}

// Mock data mapping categories to blog posts
const BLOG_DATA: Record<string, { title: string; excerpt: string; image: string; readTime: string }> = {
  'Phones': {
    title: "iPhone 15 Pro vs 14 Pro: Is the Upgrade Worth It?",
    excerpt: "We break down the titanium design, A17 Pro chip, and camera improvements to help you decide if it's time to switch.",
    image: "https://images.unsplash.com/photo-1696446701796-da61225697cc?q=80&w=800&auto=format&fit=crop",
    readTime: "5 min read"
  },
  'Laptops': {
    title: "M3 MacBook Pro: The Ultimate Creator Tool?",
    excerpt: "Apple's latest silicon pushes the boundaries of performance. See how it handles 8K video editing and 3D rendering.",
    image: "https://images.unsplash.com/photo-1517336714731-489689fd1ca4?q=80&w=800&auto=format&fit=crop",
    readTime: "4 min read"
  },
  'Gaming': {
    title: "PS5 Slim vs Original: What's Actually Different?",
    excerpt: "It's smaller and lighter, but does the new design compromise on cooling or performance? Let's find out.",
    image: "https://images.unsplash.com/photo-1606144042614-b2417e99c4e3?q=80&w=800&auto=format&fit=crop",
    readTime: "6 min read"
  },
  'Accessories': {
    title: "Why The Apple Watch Ultra Is Overkill (And Why We Love It)",
    excerpt: "You probably don't need a dive computer on your wrist, but here is why the battery life alone makes it a winner.",
    image: "https://images.unsplash.com/photo-1434493789847-2f02dc6ca35d?q=80&w=800&auto=format&fit=crop",
    readTime: "3 min read"
  }
};

export const BlogSnippet: React.FC<BlogSnippetProps> = ({ category }) => {
  // Fallback to general post if category not found
  const post = BLOG_DATA[category] || {
    title: "Tech Trends 2024: What to Expect",
    excerpt: "From AI integration to foldable screens, here is what the tech world has in store for us this year.",
    image: "https://images.unsplash.com/photo-1519389950473-47ba0277781c?q=80&w=800&auto=format&fit=crop",
    readTime: "4 min read"
  };

  return (
    <section className="mt-16 mb-8">
      <div className="flex items-center gap-2 mb-6">
         <BookOpen className="text-red-600" size={20} />
         <h3 className="text-xl font-bold text-gray-900">From the Blog</h3>
      </div>
      
      <div className="group relative overflow-hidden rounded-2xl bg-white border border-gray-100 shadow-lg hover:shadow-xl transition-all duration-300">
        <div className="flex flex-col md:flex-row">
          {/* Image Section */}
          <div className="md:w-1/3 h-48 md:h-auto overflow-hidden relative">
            <img 
              src={post.image} 
              alt={post.title} 
              className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
            />
            <div className="absolute inset-0 bg-black/10 group-hover:bg-transparent transition-colors"></div>
            <div className="absolute top-4 left-4 bg-white/90 backdrop-blur text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider text-gray-800">
               {category}
            </div>
          </div>

          {/* Content Section */}
          <div className="p-6 md:p-8 flex-1 flex flex-col justify-center">
             <div className="flex items-center gap-2 text-xs text-gray-400 mb-2">
                <span>Ogabassey Editor</span>
                <span>•</span>
                <span>{post.readTime}</span>
             </div>
             <h4 className="text-2xl font-bold text-gray-900 mb-3 group-hover:text-red-600 transition-colors">
               {post.title}
             </h4>
             <p className="text-gray-600 mb-6 line-clamp-2 md:line-clamp-none">
               {post.excerpt}
             </p>
             
             <Link to="#" className="inline-flex items-center gap-2 text-sm font-bold text-red-600 hover:text-red-700 uppercase tracking-wider">
                Read Full Article <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
             </Link>
          </div>
        </div>
      </div>
    </section>
  );
};
