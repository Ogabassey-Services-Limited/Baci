'use client';

import { StorefrontProductGrid } from '@/components/storefront/product-grid';
import type { TemplatePageProps } from '@/templates/registry';
import { Home as HomeIcon, Sofa, Utensils, Bed } from 'lucide-react';
import { useState } from 'react';

/**
 * Home Goods Template - Warm, lifestyle-focused design for furniture and decor stores
 * Features: Room-based navigation, warm earthy tones, lifestyle imagery
 */
export function HomeGoodsTemplate({ children }: { children: React.ReactNode }) {
    return <div className="template-home-goods bg-stone-50">{children}</div>;
}

export function HomeGoodsHome(props: TemplatePageProps) {
    const [selectedCategory, setSelectedCategory] = useState('All');

    const merchant = props.merchant || {
        business_name: 'Haven Home',
        logo_url: undefined,
        brand_colors: {
            primary: '#8B4513',
            background: '#FAF8F5',
            accent: '#D4A574',
        },
    };

    const rooms = [
        { name: 'Living Room', icon: Sofa, category: 'Living' },
        { name: 'Bedroom', icon: Bed, category: 'Bedroom' },
        { name: 'Dining', icon: Utensils, category: 'Dining' },
        { name: 'All Rooms', icon: HomeIcon, category: 'All' },
    ];

    return (
        <div className="min-h-screen bg-stone-50">
                {/* Hero Section - Warm & Inviting */}
                <section className="relative h-[70vh] overflow-hidden bg-linear-to-br from-amber-50 to-stone-100">
                    <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiM5OTk5OTkiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PHBhdGggZD0iTTM2IDM0djItaDJ2LTJoLTJ6bTAgNHYyaDJ2LTJoLTJ6bS0yIDJoLTJ2Mmgydi0yek0zMiAzOGgtMnYyaDJ2LTJ6bTAgNGgtMnYyaDJ2LTJ6bS0yIDJoLTJ2Mmgydi0yek0yOCA0MmgtMnYyaDJ2LTJ6bTAgNGgtMnYyaDJ2LTJ6Ii8+PC9nPjwvZz48L3N2Zz4=')] opacity-30" />

                    <div className="relative max-w-7xl mx-auto h-full flex items-center px-6">
                        <div className="max-w-2xl">
                            <h1 className="text-6xl font-serif font-bold text-stone-800 mb-6 leading-tight">
                                Transform Your Space
                                <span className="block text-amber-700">Into A Haven</span>
                            </h1>
                            <p className="text-xl text-stone-600 mb-8 leading-relaxed">
                                Curated furniture and decor to make every room feel like home. Quality craftsmanship, timeless design.
                            </p>
                            <button
                                onClick={() => {
                                    document.getElementById('products')?.scrollIntoView({ behavior: 'smooth' });
                                }}
                                className="px-8 py-4 bg-amber-800 text-white rounded-full font-medium hover:bg-amber-900 transition-colors shadow-lg hover:shadow-xl"
                            >
                                Explore Collection
                            </button>
                        </div>
                    </div>
                </section>

                {/* Room Navigation */}
                <section className="py-12 bg-white border-y border-stone-200">
                    <div className="max-w-7xl mx-auto px-6">
                        <h2 className="text-3xl font-serif font-bold text-center text-stone-800 mb-8">
                            Shop By Room
                        </h2>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            {rooms.map((room) => {
                                const Icon = room.icon;
                                const isActive = selectedCategory === room.category;
                                return (
                                    <button
                                        key={room.name}
                                        onClick={() => setSelectedCategory(room.category)}
                                        className={`p-6 rounded-2xl border-2 transition-all ${isActive
                                            ? 'border-amber-700 bg-amber-50 shadow-lg'
                                            : 'border-stone-200 bg-white hover:border-amber-300 hover:shadow-md'
                                            }`}
                                    >
                                        <Icon
                                            className={`w-10 h-10 mx-auto mb-3 ${isActive ? 'text-amber-700' : 'text-stone-400'
                                                }`}
                                        />
                                        <span
                                            className={`block text-center font-medium ${isActive ? 'text-amber-900' : 'text-stone-700'
                                                }`}
                                        >
                                            {room.name}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </section>

                {/* Featured Banner */}
                <section className="py-16 bg-linear-to-r from-stone-100 to-amber-50">
                    <div className="max-w-7xl mx-auto px-6">
                        <div className="grid md:grid-cols-2 gap-12 items-center">
                            <div>
                                <h2 className="text-4xl font-serif font-bold text-stone-800 mb-4">
                                    Quality That Lasts Generations
                                </h2>
                                <p className="text-lg text-stone-600 mb-6 leading-relaxed">
                                    Every piece is carefully selected for durability, comfort, and timeless appeal.
                                    From solid wood furniture to artisan textiles, we believe your home deserves the best.
                                </p>
                                <div className="flex gap-4">
                                    <div className="flex-1 p-4 bg-white rounded-lg border border-stone-200">
                                        <div className="text-2xl font-bold text-amber-800">5+ Years</div>
                                        <div className="text-sm text-stone-600">Warranty</div>
                                    </div>
                                    <div className="flex-1 p-4 bg-white rounded-lg border border-stone-200">
                                        <div className="text-2xl font-bold text-amber-800">100%</div>
                                        <div className="text-sm text-stone-600">Sustainable</div>
                                    </div>
                                    <div className="flex-1 p-4 bg-white rounded-lg border border-stone-200">
                                        <div className="text-2xl font-bold text-amber-800">Free</div>
                                        <div className="text-sm text-stone-600">Delivery</div>
                                    </div>
                                </div>
                            </div>
                            <div className="relative h-96 rounded-2xl overflow-hidden shadow-2xl">
                                <div className="absolute inset-0 bg-linear-to-br from-amber-200 to-stone-300 flex items-center justify-center">
                                    <div className="text-center">
                                        <HomeIcon className="w-24 h-24 text-white/50 mx-auto mb-4" />
                                        <p className="text-white/70 text-sm">Lifestyle Image Placeholder</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Products Section */}
                <section id="products" className="py-16 bg-white">
                    <div className="max-w-7xl mx-auto px-6">
                        <div className="text-center mb-12">
                            <h2 className="text-4xl font-serif font-bold text-stone-800 mb-4">
                                Our Collection
                            </h2>
                            <p className="text-lg text-stone-600 max-w-2xl mx-auto">
                                Handpicked furniture and decor to create the perfect atmosphere in every room
                            </p>
                        </div>

                        <StorefrontProductGrid
                            title=""
                            columns={4}
                            limit={12}
                            showFilters={true}
                        />
                    </div>
                </section>

                {/* Design Philosophy */}
                <section className="py-16 bg-stone-100">
                    <div className="max-w-4xl mx-auto px-6 text-center">
                        <h2 className="text-3xl font-serif font-bold text-stone-800 mb-6">
                            Designed For Living
                        </h2>
                        <p className="text-lg text-stone-600 leading-relaxed mb-8">
                            We believe furniture should tell a story. Each piece is chosen not just for how it looks,
                            but for how it makes you feel. Comfort meets style in every corner of your home.
                        </p>
                        <div className="flex justify-center gap-8 text-stone-700">
                            <div>
                                <div className="text-4xl font-serif font-bold text-amber-800">500+</div>
                                <div className="text-sm mt-1">Happy Homes</div>
                            </div>
                            <div className="w-px bg-stone-300" />
                            <div>
                                <div className="text-4xl font-serif font-bold text-amber-800">15+</div>
                                <div className="text-sm mt-1">Years Experience</div>
                            </div>
                            <div className="w-px bg-stone-300" />
                            <div>
                                <div className="text-4xl font-serif font-bold text-amber-800">4.9</div>
                                <div className="text-sm mt-1">Customer Rating</div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Footer */}
                <footer className="bg-stone-800 text-stone-300 py-12">
                    <div className="max-w-7xl mx-auto px-6">
                        <div className="grid md:grid-cols-4 gap-8 mb-8">
                            <div>
                                <h3 className="font-serif text-xl font-bold text-white mb-4">
                                    {merchant.business_name}
                                </h3>
                                <p className="text-sm leading-relaxed">
                                    Creating beautiful, lasting spaces for modern living.
                                </p>
                            </div>
                            <div>
                                <h4 className="font-medium text-white mb-4">Shop</h4>
                                <ul className="space-y-2 text-sm">
                                    <li><a href="#" className="hover:text-amber-400 transition-colors">Living Room</a></li>
                                    <li><a href="#" className="hover:text-amber-400 transition-colors">Bedroom</a></li>
                                    <li><a href="#" className="hover:text-amber-400 transition-colors">Dining</a></li>
                                    <li><a href="#" className="hover:text-amber-400 transition-colors">All Products</a></li>
                                </ul>
                            </div>
                            <div>
                                <h4 className="font-medium text-white mb-4">Support</h4>
                                <ul className="space-y-2 text-sm">
                                    <li><a href="#" className="hover:text-amber-400 transition-colors">Contact Us</a></li>
                                    <li><a href="#" className="hover:text-amber-400 transition-colors">Delivery Info</a></li>
                                    <li><a href="#" className="hover:text-amber-400 transition-colors">Returns</a></li>
                                    <li><a href="#" className="hover:text-amber-400 transition-colors">FAQ</a></li>
                                </ul>
                            </div>
                            <div>
                                <h4 className="font-medium text-white mb-4">Company</h4>
                                <ul className="space-y-2 text-sm">
                                    <li><a href="#" className="hover:text-amber-400 transition-colors">About Us</a></li>
                                    <li><a href="#" className="hover:text-amber-400 transition-colors">Sustainability</a></li>
                                    <li><a href="#" className="hover:text-amber-400 transition-colors">Blog</a></li>
                                    <li><a href="#" className="hover:text-amber-400 transition-colors">Careers</a></li>
                                </ul>
                            </div>
                        </div>
                        <div className="border-t border-stone-700 pt-6 text-center text-sm">
                            <p>&copy; {new Date().getFullYear()} {merchant.business_name}. All rights reserved.</p>
                        </div>
                    </div>
                </footer>
            </div>
    );
}
