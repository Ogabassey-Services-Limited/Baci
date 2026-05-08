'use client';

import { StorefrontProductGrid } from '@/components/storefront/product-grid';
import type { TemplatePageProps } from '@/templates/registry';
import {
  Heart,
  Palette,
  Scissors,
  Clock,
  Star,
  Leaf,
  Package,
  MessageCircle,
} from 'lucide-react';
import { useState } from 'react';

/**
 * Handmade & Crafts Template - "The Artisan Collective"
 * Warm, authentic design for handcrafted and artisan products
 * Color scheme: Terracotta, Cream, Sage, Warm Brown
 */
function HandmadeTemplate({ children }: { children: React.ReactNode }) {
  return <div className="template-handmade bg-[#FAF6F1]">{children}</div>;
}

// Alias for backwards compatibility with business-types.ts
// Alias for backwards compatibility with business-types.ts
// Alias for backwards compatibility with business-types.ts
export const ArtisanTemplate = (props: { children: React.ReactNode }) => <HandmadeTemplate {...props} />;

export function HandmadeHome(props: TemplatePageProps) {
  const [selectedCategory, setSelectedCategory] = useState('All');

  const merchant = props.merchant || {
    business_name: 'The Artisan Collective',
    logo_url: undefined,
    brand_colors: {
      primary: '#C4785E',
      background: '#FAF6F1',
      accent: '#7D8B6C',
    },
  };

  const categories = [
    { name: 'All', value: 'All', emoji: '✨' },
    { name: 'Ceramics', value: 'Ceramics', emoji: '🏺' },
    { name: 'Textiles', value: 'Textiles', emoji: '🧶' },
    { name: 'Jewelry', value: 'Jewelry', emoji: '💍' },
    { name: 'Woodwork', value: 'Woodwork', emoji: '🪵' },
    { name: 'Art', value: 'Art', emoji: '🎨' },
  ];

  const trustBadges = [
    { icon: Heart, title: 'Made with Love', subtitle: 'Every piece is unique' },
    { icon: Clock, title: 'Takes Time', subtitle: '3-7 days to craft' },
    { icon: Leaf, title: 'Sustainable', subtitle: 'Eco-friendly materials' },
    { icon: Package, title: 'Gift Ready', subtitle: 'Beautiful packaging' },
  ];

  const materials = [
    { name: 'Natural Clay', emoji: '🏺', description: 'Hand-formed ceramics' },
    { name: 'Organic Cotton', emoji: '🧵', description: 'Sustainable textiles' },
    { name: 'Reclaimed Wood', emoji: '🪵', description: 'Eco-conscious crafts' },
    { name: 'Sterling Silver', emoji: '✨', description: 'Fine jewelry' },
  ];

  const testimonials = [
    { name: 'Sarah M.', text: 'The attention to detail is incredible. You can feel the love in every stitch.', product: 'Hand-woven Blanket' },
    { name: 'Michael T.', text: 'A truly unique piece. It\'s now the centerpiece of my living room.', product: 'Ceramic Vase' },
    { name: 'Emma L.', text: 'Custom order was exactly what I envisioned. Amazing communication!', product: 'Custom Portrait' },
  ];

  return (
    <div className="min-h-screen bg-[#FAF6F1]">
      {/* Hero Section - Warm & Authentic */}
      <section className="relative bg-linear-to-br from-[#FAF6F1] via-[#F5EDE3] to-[#EDDFD2] overflow-hidden">
        {/* Decorative elements */}
        <div className="absolute inset-0 overflow-hidden opacity-20">
          <div className="absolute top-10 right-20">
            <div className="w-32 h-32 rounded-full border-2 border-[#C4785E] border-dashed"></div>
          </div>
          <div className="absolute bottom-20 left-10">
            <div className="w-20 h-20 rotate-45 border-2 border-[#7D8B6C]"></div>
          </div>
        </div>

        <div className="relative max-w-7xl mx-auto px-6 py-20">
          <div className="max-w-3xl">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-14 h-14 bg-[#C4785E] rounded-full flex items-center justify-center">
                <Palette className="w-7 h-7 text-white" />
              </div>
              <div className="flex gap-2">
                <span className="px-3 py-1 bg-[#7D8B6C] text-white text-xs font-semibold rounded-full">
                  Handcrafted
                </span>
                <span className="px-3 py-1 bg-[#C4785E]/10 text-[#C4785E] text-xs font-semibold rounded-full border border-[#C4785E]/30">
                  One of a Kind
                </span>
              </div>
            </div>

            <h1 className="text-5xl md:text-6xl font-serif font-bold text-[#3D2F2F] mb-6 leading-tight">
              Crafted by Hand,<br />
              <span className="text-[#C4785E]">Made with Heart</span>
            </h1>
            <p className="text-xl text-[#5D4E4E] mb-8 leading-relaxed max-w-2xl">
              Discover unique, handmade treasures from passionate artisans.
              Each piece tells a story of craftsmanship, creativity, and care.
            </p>

            <div className="flex flex-wrap gap-4">
              <button
                onClick={() => {
                  document.getElementById('products')?.scrollIntoView({ behavior: 'smooth' });
                }}
                className="px-8 py-4 bg-[#C4785E] text-white rounded-full font-semibold hover:bg-[#B06A4F] transition-colors shadow-md"
              >
                Explore Collection
              </button>
              <button className="px-8 py-4 bg-white text-[#3D2F2F] rounded-full font-semibold hover:bg-gray-50 transition-colors shadow-md border border-[#E5DDD3] flex items-center gap-2">
                <MessageCircle className="w-5 h-5" />
                Custom Orders
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Trust Badges */}
      <section className="bg-white border-y border-[#E5DDD3] py-8">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {trustBadges.map((badge, index) => {
              const Icon = badge.icon;
              return (
                <div key={index} className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-[#C4785E]/10 rounded-full flex items-center justify-center shrink-0">
                    <Icon className="w-5 h-5 text-[#C4785E]" />
                  </div>
                  <div>
                    <div className="font-semibold text-[#3D2F2F] text-sm">{badge.title}</div>
                    <div className="text-xs text-[#8B7B7B]">{badge.subtitle}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Maker Story Section */}
      <section className="py-16 bg-[#FAF6F1]">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div className="bg-linear-to-br from-[#C4785E]/10 to-[#7D8B6C]/10 rounded-3xl h-80 flex items-center justify-center border border-[#E5DDD3]">
              <div className="text-center">
                <span className="text-8xl">👩‍🎨</span>
                <p className="text-[#8B7B7B] mt-4">The Maker at Work</p>
              </div>
            </div>
            <div>
              <span className="text-[#7D8B6C] text-sm font-semibold uppercase tracking-wider">
                Our Story
              </span>
              <h2 className="text-3xl font-serif font-bold text-[#3D2F2F] mt-2 mb-4">
                Where Every Piece Has a Soul
              </h2>
              <p className="text-[#5D4E4E] leading-relaxed mb-4">
                I started this journey in my small studio with a simple belief:
                that handmade goods carry something special that mass-produced
                items never can—a piece of the maker's heart.
              </p>
              <p className="text-[#5D4E4E] leading-relaxed mb-6">
                Each piece takes hours, sometimes days, to complete.
                The imperfections are part of the beauty—they tell the story
                of human hands at work.
              </p>
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-[#C4785E] rounded-full flex items-center justify-center text-white font-bold">
                  AC
                </div>
                <div>
                  <div className="font-semibold text-[#3D2F2F]">Anna Chen</div>
                  <div className="text-sm text-[#8B7B7B]">Founder & Lead Artisan</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Shop by Category */}
      <section className="py-12 bg-white border-y border-[#E5DDD3]">
        <div className="max-w-7xl mx-auto px-6">
          <h2 className="text-3xl font-serif font-bold text-center text-[#3D2F2F] mb-8">
            Shop by Craft
          </h2>
          <div className="flex flex-wrap justify-center gap-3">
            {categories.map((category) => {
              const isActive = selectedCategory === category.value;
              return (
                <button
                  key={category.value}
                  onClick={() => setSelectedCategory(category.value)}
                  className={`px-6 py-3 rounded-full font-medium transition-all flex items-center gap-2 ${isActive
                    ? 'bg-[#C4785E] text-white shadow-md'
                    : 'bg-[#FAF6F1] text-[#5D4E4E] hover:bg-[#F5EDE3] border border-[#E5DDD3]'
                    }`}
                >
                  <span>{category.emoji}</span>
                  {category.name}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* Products Section */}
      <section
        id="products"
        className="py-16 bg-[#FAF6F1]"
        style={{
          '--store-primary': '#C4785E',
          '--store-primary-text': '#FFFFFF',
          '--store-accent': '#7D8B6C',
        } as React.CSSProperties}
      >
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-serif font-bold text-[#3D2F2F] mb-4">
              Handcrafted Treasures
            </h2>
            <p className="text-lg text-[#5D4E4E] max-w-2xl mx-auto">
              Each item is made by hand with love and attention to detail
            </p>
          </div>

          <StorefrontProductGrid
            title=""
            columns={4}
            limit={12}
            showFilters={false}
          />
        </div>
      </section>

      {/* Materials Showcase */}
      <section className="py-16 bg-white border-y border-[#E5DDD3]">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-serif font-bold text-[#3D2F2F] mb-4">
              Quality Materials
            </h2>
            <p className="text-[#5D4E4E]">
              We source the finest sustainable materials for our creations
            </p>
          </div>
          <div className="grid md:grid-cols-4 gap-6">
            {materials.map((material, idx) => (
              <div key={idx} className="bg-[#FAF6F1] rounded-2xl p-6 text-center border border-[#E5DDD3] hover:shadow-md transition-shadow">
                <span className="text-4xl mb-4 block">{material.emoji}</span>
                <h3 className="font-semibold text-[#3D2F2F] mb-1">{material.name}</h3>
                <p className="text-sm text-[#8B7B7B]">{material.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Custom Orders CTA */}
      <section className="py-16 bg-linear-to-r from-[#C4785E] to-[#B06A4F] text-white">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <span className="text-white/80 text-sm font-semibold uppercase tracking-wider">
                Something Special in Mind?
              </span>
              <h2 className="text-4xl font-serif font-bold mt-2 mb-4">
                Custom Orders Welcome
              </h2>
              <p className="text-lg text-white/90 mb-6 leading-relaxed">
                Have a unique vision? I love bringing custom ideas to life.
                From personalized gifts to one-of-a-kind pieces, let's create
                something extraordinary together.
              </p>
              <ul className="space-y-3 mb-8">
                {['Personalized engravings', 'Custom sizes & colors', 'Bespoke designs', 'Gift commissions'].map((item, idx) => (
                  <li key={idx} className="flex items-center gap-3">
                    <div className="w-5 h-5 bg-white text-[#C4785E] rounded-full flex items-center justify-center text-xs font-bold">✓</div>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              <button className="px-8 py-4 bg-white text-[#C4785E] rounded-full font-semibold hover:bg-white/90 transition-colors shadow-lg flex items-center gap-2">
                <MessageCircle className="w-5 h-5" />
                Start a Custom Order
              </button>
            </div>
            <div className="relative">
              <div className="bg-white/10 backdrop-blur-xs rounded-3xl p-8 text-center border border-white/20">
                <Scissors className="w-16 h-16 text-white/80 mx-auto mb-4" />
                <div className="text-2xl font-bold">Made Just for You</div>
                <div className="text-white/70">Usually ready in 2-3 weeks</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-16 bg-[#FAF6F1]">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-serif font-bold text-[#3D2F2F] mb-4">
              What Customers Say
            </h2>
            <p className="text-[#5D4E4E]">
              Stories from our happy crafts collectors
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {testimonials.map((t, idx) => (
              <div key={idx} className="bg-white rounded-2xl p-6 shadow-sm border border-[#E5DDD3]">
                <div className="flex gap-1 mb-4">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="w-4 h-4 text-[#C4785E] fill-[#C4785E]" />
                  ))}
                </div>
                <p className="text-[#5D4E4E] mb-4 italic">"{t.text}"</p>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-[#C4785E]/10 rounded-full flex items-center justify-center text-[#C4785E] font-semibold">
                    {t.name.charAt(0)}
                  </div>
                  <div>
                    <div className="font-semibold text-[#3D2F2F]">{t.name}</div>
                    <div className="text-xs text-[#8B7B7B]">{t.product}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Sustainability */}
      <section className="py-12 bg-[#7D8B6C] text-white">
        <div className="max-w-5xl mx-auto px-6 text-center">
          <Leaf className="w-10 h-10 mx-auto mb-4" />
          <h2 className="text-2xl font-serif font-bold mb-4">
            Crafted with Care for Our Planet
          </h2>
          <p className="text-white/90 max-w-2xl mx-auto">
            We use sustainable materials, minimal packaging, and eco-friendly practices.
            Every purchase supports small-batch, ethical production.
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-[#3D2F2F] text-[#E5DDD3] py-12">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div>
              <h3 className="text-xl font-serif font-bold text-white mb-4 flex items-center gap-2">
                <Palette className="w-5 h-5 text-[#C4785E]" />
                {merchant.business_name}
              </h3>
              <p className="text-sm leading-relaxed mb-4">
                Handcrafted with love. Each piece tells a story.
              </p>
              <div className="flex gap-2">
                <span className="px-2 py-1 bg-[#7D8B6C]/30 text-[#7D8B6C] text-xs rounded">Handmade</span>
                <span className="px-2 py-1 bg-[#C4785E]/30 text-[#C4785E] text-xs rounded">Unique</span>
              </div>
            </div>
            <div>
              <h4 className="font-semibold text-white mb-4">Shop</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="#" className="hover:text-[#C4785E] transition-colors">All Products</a></li>
                <li><a href="#" className="hover:text-[#C4785E] transition-colors">Ceramics</a></li>
                <li><a href="#" className="hover:text-[#C4785E] transition-colors">Textiles</a></li>
                <li><a href="#" className="hover:text-[#C4785E] transition-colors">Jewelry</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-white mb-4">About</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="#" className="hover:text-[#C4785E] transition-colors">Our Story</a></li>
                <li><a href="#" className="hover:text-[#C4785E] transition-colors">Materials</a></li>
                <li><a href="#" className="hover:text-[#C4785E] transition-colors">Custom Orders</a></li>
                <li><a href="#" className="hover:text-[#C4785E] transition-colors">Care Guide</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-white mb-4">Connect</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="#" className="hover:text-[#C4785E] transition-colors">Contact</a></li>
                <li><a href="#" className="hover:text-[#C4785E] transition-colors">Instagram</a></li>
                <li><a href="#" className="hover:text-[#C4785E] transition-colors">Pinterest</a></li>
                <li><a href="#" className="hover:text-[#C4785E] transition-colors">Newsletter</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-[#5D4E4E] pt-6 text-center text-sm">
            <p>© {new Date().getFullYear()} {merchant.business_name}. All rights reserved.</p>
            <p className="mt-2 text-[#8B7B7B]">
              Made by hand, with love ♡
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
