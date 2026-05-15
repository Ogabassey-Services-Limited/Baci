'use client';

import { StorefrontProductGrid } from '@/components/storefront/product-grid';
import type { TemplatePageProps } from '@/templates/registry';
import {
    Sparkles,
    Droplet,
    Sun,
    Moon,
    Heart,
    ShieldCheck,
    Star
} from 'lucide-react';
import { useState } from 'react';

/**
 * Beauty Template - Minimalist luxury design for health & beauty e-commerce
 * Features: Soft pastels, skin quiz, ingredient transparency, customer results
 */
export function BeautyTemplate({ children }: { children: React.ReactNode }) {
    return <div className="template-beauty bg-[#FAF9F6]">{children}</div>;
}

export function BeautyHome(props: TemplatePageProps) {
    const [selectedConcern, setSelectedConcern] = useState('All');

    const merchant = props.merchant || {
        business_name: 'Radiant Beauty',
        logo_url: undefined,
        brand_colors: {
            primary: '#FFD6E8',
            background: '#FAF9F6',
            accent: '#B76E79',
        },
    };

    const skinConcerns = [
        { name: 'All Products', value: 'All', icon: Sparkles },
        { name: 'Hydration', value: 'Hydration', icon: Droplet },
        { name: 'Anti-Aging', value: 'Anti-Aging', icon: Sun },
        { name: 'Acne Care', value: 'Acne', icon: ShieldCheck },
        { name: 'Brightening', value: 'Brightening', icon: Star },
    ];

    const ingredients = [
        { name: 'Hyaluronic Acid', benefit: 'Deep hydration & plumping', icon: Droplet },
        { name: 'Vitamin C', benefit: 'Brightening & antioxidant', icon: Sun },
        { name: 'Niacinamide', benefit: 'Pore refining & calming', icon: ShieldCheck },
        { name: 'Retinol', benefit: 'Anti-aging powerhouse', icon: Sparkles },
    ];

    return (
        <div className="min-h-screen bg-gradient-to-b from-[#FAF9F6] to-white">
            {/* Hero Section - Soft & Elegant */}
            <section className="relative overflow-hidden bg-gradient-to-br from-pink-50 via-purple-50 to-blue-50">
                <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNGRkQ2RTgiIGZpbGwtb3BhY2l0eT0iMC4xIj48Y2lyY2xlIGN4PSIzMCIgY3k9IjMwIiByPSIyIi8+PC9nPjwvZz48L3N2Zz4=')] opacity-40" />

                <div className="relative max-w-7xl mx-auto px-6 py-24 text-center">
                    <div className="max-w-3xl mx-auto">
                        <div className="inline-block mb-6">
                            <span className="px-4 py-2 bg-white/80 backdrop-blur-sm rounded-full text-sm font-medium text-rose-800 shadow-sm">
                                ✨ Discover Your Perfect Skincare Routine
                            </span>
                        </div>

                        <h1 className="text-6xl font-serif font-light text-gray-900 mb-6 leading-tight">
                            Radiant Skin,
                            <br />
                            <span className="text-rose-600 font-medium">Naturally Yours</span>
                        </h1>

                        <p className="text-xl text-gray-600 mb-10 leading-relaxed font-light">
                            Clean, effective skincare powered by science and nature.
                            Discover products that work with your unique skin.
                        </p>

                        <div className="flex flex-wrap justify-center gap-4">
                            <button
                                type="button"
                                onClick={() => {
                                    document.getElementById('quiz')?.scrollIntoView({ behavior: 'smooth' });
                                }}
                                className="px-8 py-4 bg-rose-600 text-white rounded-full font-medium hover:bg-rose-700 transition-colors shadow-lg hover:shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-2"
                            >
                                Take Skin Quiz
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    document.getElementById('products')?.scrollIntoView({ behavior: 'smooth' });
                                }}
                                className="px-8 py-4 bg-white text-rose-600 rounded-full font-medium hover:bg-gray-50 transition-colors shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-2"
                            >
                                Shop Products
                            </button>
                        </div>
                    </div>
                </div>
            </section>

            {/* Skin Type Quiz CTA */}
            <section id="quiz" className="py-16 -mt-12 relative z-10">
                <div className="max-w-7xl mx-auto px-6">
                    <div className="bg-gradient-to-r from-purple-100 to-pink-100 rounded-3xl shadow-2xl p-12">
                        <div className="grid md:grid-cols-2 gap-12 items-center">
                            <div>
                                <h2 className="text-4xl font-serif font-light text-gray-900 mb-4">
                                    Find Your Perfect Match
                                </h2>
                                <p className="text-lg text-gray-700 mb-6 leading-relaxed">
                                    Take our personalized skin quiz to get product recommendations tailored to your unique skin type and concerns.
                                </p>
                                <ul className="space-y-3 mb-8">
                                    {[
                                        'Identify your skin type',
                                        'Discover your key concerns',
                                        'Get personalized recommendations',
                                        'Build your perfect routine'
                                    ].map((item, idx) => (
                                        <li key={idx} className="flex items-center gap-3 text-gray-700">
                                            <div className="w-6 h-6 bg-rose-500 text-white rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">
                                                {idx + 1}
                                            </div>
                                            <span>{item}</span>
                                        </li>
                                    ))}
                                </ul>
                                <button type="button" className="px-8 py-4 bg-rose-600 text-white rounded-full font-medium hover:bg-rose-700 transition-colors shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-2">
                                    Start Quiz (2 min)
                                </button>
                            </div>
                            <div className="relative h-96 bg-gradient-to-br from-white to-purple-50 rounded-2xl flex items-center justify-center shadow-inner">
                                <div className="text-center">
                                    <Sparkles className="w-20 h-20 text-rose-400 mx-auto mb-4" />
                                    <p className="text-gray-500">Interactive Quiz Placeholder</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Shop by Concern */}
            <section className="py-16">
                <div className="max-w-7xl mx-auto px-6">
                    <h2 className="text-4xl font-serif font-light text-center text-gray-900 mb-4">
                        Shop by Skin Concern
                    </h2>
                    <p className="text-center text-gray-600 mb-12 max-w-2xl mx-auto">
                        Targeted solutions for your unique skin needs
                    </p>

                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                        {skinConcerns.map((concern) => {
                            const Icon = concern.icon;
                            const isActive = selectedConcern === concern.value;
                            return (
                                <button
                                    key={concern.value}
                                    onClick={() => setSelectedConcern(concern.value)}
                                    className={`p-6 rounded-2xl border-2 transition-all ${isActive
                                        ? 'border-rose-400 bg-rose-50 shadow-lg scale-105'
                                        : 'border-gray-200 bg-white hover:border-rose-200 hover:shadow-md'
                                        }`}
                                >
                                    <Icon className={`w-8 h-8 mx-auto mb-3 ${isActive ? 'text-rose-600' : 'text-gray-400'}`} />
                                    <span className={`block text-sm font-medium ${isActive ? 'text-rose-900' : 'text-gray-700'}`}>
                                        {concern.name}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                </div>
            </section>

            {/* Products Section - With Custom Theme Styling */}
            <section
                id="products"
                className="py-16 bg-white"
                style={{
                    '--store-primary': '#B76E79',
                    '--store-primary-text': '#FFFFFF',
                    '--store-accent': '#E6E6FA',
                } as React.CSSProperties}
            >
                <div className="max-w-7xl mx-auto px-6">
                    <div className="text-center mb-12">
                        <h2 className="text-4xl font-serif font-light text-gray-900 mb-4">
                            Our Collection
                        </h2>
                        <p className="text-lg text-gray-600 max-w-2xl mx-auto">
                            Clean, effective formulas with transparent ingredients and proven results
                        </p>
                    </div>

                    {/* Custom styled filter bar that matches beauty theme */}
                    <div className="mb-8">
                        <div className="bg-gradient-to-r from-pink-50 to-purple-50 border border-pink-200 rounded-2xl p-4 shadow-sm">
                            <div className="flex flex-wrap justify-center gap-2">
                                {skinConcerns.map((concern) => {
                                    const isActive = selectedConcern === concern.value;
                                    return (
                                        <button
                                            key={concern.value}
                                            onClick={() => setSelectedConcern(concern.value)}
                                            className={`px-5 py-2.5 rounded-full text-sm font-medium transition-all ${isActive
                                                    ? 'bg-rose-500 text-white shadow-md scale-105'
                                                    : 'bg-white/80 hover:bg-white text-gray-700 hover:shadow-sm'
                                                }`}
                                        >
                                            {concern.name}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                    <StorefrontProductGrid
                        title=""
                        columns={4}
                        limit={12}
                        showFilters={false}
                    />
                </div>
            </section>

            {/* Ingredients We Love */}
            <section className="py-16 bg-gradient-to-b from-white to-purple-50">
                <div className="max-w-7xl mx-auto px-6">
                    <h2 className="text-4xl font-serif font-light text-center text-gray-900 mb-4">
                        Ingredients We Love
                    </h2>
                    <p className="text-center text-gray-600 mb-12 max-w-2xl mx-auto">
                        Science-backed actives that deliver real results
                    </p>

                    <div className="grid md:grid-cols-4 gap-6">
                        {ingredients.map((ingredient, idx) => {
                            const Icon = ingredient.icon;
                            return (
                                <div key={idx} className="p-8 bg-white rounded-2xl shadow-md hover:shadow-xl transition-shadow">
                                    <div className="w-16 h-16 bg-gradient-to-br from-rose-100 to-purple-100 rounded-full flex items-center justify-center mb-4 mx-auto">
                                        <Icon className="w-8 h-8 text-rose-600" />
                                    </div>
                                    <h3 className="text-lg font-semibold text-gray-900 text-center mb-2">
                                        {ingredient.name}
                                    </h3>
                                    <p className="text-sm text-gray-600 text-center">
                                        {ingredient.benefit}
                                    </p>
                                    <a href="#" className="block mt-4 text-center text-rose-600 text-sm font-medium hover:text-rose-700">
                                        Learn More →
                                    </a>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </section>

            {/* Customer Results */}
            <section className="py-16 bg-white">
                <div className="max-w-7xl mx-auto px-6">
                    <h2 className="text-4xl font-serif font-light text-center text-gray-900 mb-4">
                        Real Results, Real People
                    </h2>
                    <p className="text-center text-gray-600 mb-12 max-w-2xl mx-auto">
                        See the transformations our customers have achieved
                    </p>

                    <div className="grid md:grid-cols-3 gap-8">
                        {[1, 2, 3].map((idx) => (
                            <div key={idx} className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-2xl p-6 shadow-md hover:shadow-lg transition-shadow">
                                <div className="aspect-square bg-gradient-to-br from-white to-purple-100 rounded-xl mb-4 flex items-center justify-center">
                                    <div className="text-center">
                                        <Heart className="w-12 h-12 text-rose-300 mx-auto mb-2" />
                                        <p className="text-gray-500 text-sm">Before/After Photo</p>
                                    </div>
                                </div>
                                <div className="flex gap-1 mb-3">
                                    {[...Array(5)].map((_, i) => (
                                        <Star key={i} className="w-4 h-4 fill-rose-500 text-rose-500" />
                                    ))}
                                </div>
                                <p className="text-gray-700 mb-3 italic">
                                    "My skin has never looked better! The personalized routine really made a difference."
                                </p>
                                <p className="text-sm text-gray-600">
                                    - Sarah, Combination Skin
                                </p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Routine Builder */}
            <section className="py-16 bg-gradient-to-r from-purple-50 to-pink-50">
                <div className="max-w-6xl mx-auto px-6">
                    <h2 className="text-4xl font-serif font-light text-center text-gray-900 mb-12">
                        Build Your Perfect Routine
                    </h2>

                    <div className="grid md:grid-cols-3 gap-8">
                        {[
                            { time: 'Morning', icon: Sun, steps: ['Cleanser', 'Vitamin C Serum', 'Moisturizer', 'SPF'] },
                            { time: 'Evening', icon: Moon, steps: ['Cleanser', 'Retinol Serum', 'Night Cream', 'Eye Cream'] },
                            { time: 'Weekly', icon: Sparkles, steps: ['Exfoliator', 'Face Mask', 'Treatment', 'Extra Care'] },
                        ].map((routine, idx) => {
                            const Icon = routine.icon;
                            return (
                                <div key={idx} className="bg-white rounded-2xl p-8 shadow-lg">
                                    <div className="w-16 h-16 bg-gradient-to-br from-rose-100 to-purple-100 rounded-full flex items-center justify-center mb-4 mx-auto">
                                        <Icon className="w-8 h-8 text-rose-600" />
                                    </div>
                                    <h3 className="text-2xl font-serif text-center text-gray-900 mb-6">
                                        {routine.time} Routine
                                    </h3>
                                    <ul className="space-y-3">
                                        {routine.steps.map((step, stepIdx) => (
                                            <li key={stepIdx} className="flex items-center gap-3 text-gray-700">
                                                <span className="w-6 h-6 bg-rose-500 text-white rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">
                                                    {stepIdx + 1}
                                                </span>
                                                {step}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </section>

            {/* Footer */}
            <footer className="bg-gray-900 text-gray-300 py-12">
                <div className="max-w-7xl mx-auto px-6">
                    <div className="grid md:grid-cols-4 gap-8 mb-8">
                        <div>
                            <h3 className="text-xl font-serif text-white mb-4">
                                {merchant.business_name}
                            </h3>
                            <p className="text-sm leading-relaxed text-gray-400">
                                Clean beauty, powered by science. Your skin deserves the best.
                            </p>
                        </div>
                        <div>
                            <h4 className="font-semibold text-white mb-4">Shop</h4>
                            <ul className="space-y-2 text-sm">
                                <li><a href="#" className="hover:text-rose-400 transition-colors">All Products</a></li>
                                <li><a href="#" className="hover:text-rose-400 transition-colors">Bestsellers</a></li>
                                <li><a href="#" className="hover:text-rose-400 transition-colors">New Arrivals</a></li>
                                <li><a href="#" className="hover:text-rose-400 transition-colors">Gift Sets</a></li>
                            </ul>
                        </div>
                        <div>
                            <h4 className="font-semibold text-white mb-4">Learn</h4>
                            <ul className="space-y-2 text-sm">
                                <li><a href="#" className="hover:text-rose-400 transition-colors">Skin Quiz</a></li>
                                <li><a href="#" className="hover:text-rose-400 transition-colors">Ingredients</a></li>
                                <li><a href="#" className="hover:text-rose-400 transition-colors">Skincare Tips</a></li>
                                <li><a href="#" className="hover:text-rose-400 transition-colors">FAQs</a></li>
                            </ul>
                        </div>
                        <div>
                            <h4 className="font-semibold text-white mb-4">About</h4>
                            <ul className="space-y-2 text-sm">
                                <li><a href="#" className="hover:text-rose-400 transition-colors">Our Story</a></li>
                                <li><a href="#" className="hover:text-rose-400 transition-colors">Clean Beauty</a></li>
                                <li><a href="#" className="hover:text-rose-400 transition-colors">Sustainability</a></li>
                                <li><a href="#" className="hover:text-rose-400 transition-colors">Contact</a></li>
                            </ul>
                        </div>
                    </div>
                    <div className="border-t border-gray-800 pt-6 text-center text-sm text-gray-500">
                        <p>&copy; {new Date().getFullYear()} {merchant.business_name}. All rights reserved.</p>
                        <p className="mt-2">Made with ♥ for healthy, radiant skin</p>
                    </div>
                </div>
            </footer>
        </div>
    );
}
