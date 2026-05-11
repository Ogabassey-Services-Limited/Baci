'use client';

import { StorefrontProductGrid } from '@/components/storefront/product-grid';
import type { TemplatePageProps } from '@/templates/registry';
import {
    Sparkles,
    Crown,
    Star,
    Heart,
    PlayCircle,
    Award,
    Truck,
    RefreshCw,
    Scissors
} from 'lucide-react';
import { useState } from 'react';

/**
 * Hair Extensions Template - "Glamour Hair Studio"
 * Luxury, glamorous design for hair extensions and wigs e-commerce
 * Color scheme: Rose Gold, Soft Black, Cream White, Blush Pink
 */
export function HairExtensionsTemplate({ children }: { children: React.ReactNode }) {
    return <div className="template-hair-extensions bg-[#1A1A1A]">{children}</div>;
}

export function HairExtensionsHome(props: TemplatePageProps) {
    const [selectedTexture, setSelectedTexture] = useState('All');
    const [selectedLength, setSelectedLength] = useState<string | null>(null);

    const merchant = props.merchant || {
        business_name: 'Glamour Hair Studio',
        logo_url: undefined,
        brand_colors: {
            primary: '#B76E79',
            background: '#1A1A1A',
            accent: '#F5D0C5',
        },
    };

    const textures = [
        { name: 'All Textures', value: 'All', emoji: '✨' },
        { name: 'Straight', value: 'Straight', emoji: '➖' },
        { name: 'Body Wave', value: 'Body Wave', emoji: '〰️' },
        { name: 'Deep Wave', value: 'Deep Wave', emoji: '🌊' },
        { name: 'Curly', value: 'Curly', emoji: '🔄' },
        { name: 'Kinky', value: 'Kinky', emoji: '💫' },
    ];

    const lengths = ['14"', '16"', '18"', '20"', '22"', '24"', '26"', '28"', '30"'];

    const trustBadges = [
        { icon: Award, title: '100% Virgin Hair', subtitle: 'Premium Quality' },
        { icon: Truck, title: 'Free Shipping', subtitle: 'Orders $100+' },
        { icon: RefreshCw, title: '30-Day Returns', subtitle: 'Easy Exchange' },
        { icon: Scissors, title: 'Custom Cuts', subtitle: 'Free Styling' },
    ];

    const transformations = [
        { before: 'Before', after: 'After', name: 'Jessica', style: 'Body Wave 22"' },
        { before: 'Before', after: 'After', name: 'Michelle', style: 'Straight 26"' },
        { before: 'Before', after: 'After', name: 'Tanya', style: 'Deep Wave 20"' },
    ];

    return (
        <div className="min-h-screen bg-[#1A1A1A] text-white">
            {/* Hero Section - Glamorous & Dramatic */}
            <section className="relative bg-linear-to-br from-[#1A1A1A] via-[#2D2D2D] to-[#1A1A1A] overflow-hidden">
                {/* Sparkle decorations */}
                <div className="absolute inset-0 overflow-hidden">
                    <div className="absolute top-20 left-20 text-[#B76E79] opacity-30">
                        <Sparkles className="w-8 h-8" />
                    </div>
                    <div className="absolute top-40 right-32 text-[#B76E79] opacity-20">
                        <Star className="w-6 h-6" />
                    </div>
                    <div className="absolute bottom-32 left-1/4 text-[#B76E79] opacity-25">
                        <Crown className="w-10 h-10" />
                    </div>
                </div>

                <div className="relative max-w-7xl mx-auto px-6 py-24">
                    <div className="max-w-3xl">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-14 h-14 bg-linear-to-br from-[#B76E79] to-[#F5D0C5] rounded-full flex items-center justify-center">
                                <Crown className="w-7 h-7 text-white" />
                            </div>
                            <div className="flex gap-2">
                                <span className="px-3 py-1 bg-[#B76E79] text-white text-xs font-semibold rounded-full">
                                    100% Virgin Hair
                                </span>
                                <span className="px-3 py-1 bg-white/10 text-white text-xs font-semibold rounded-full border border-white/20">
                                    Premium Quality
                                </span>
                            </div>
                        </div>

                        <h1 className="text-5xl md:text-6xl font-bold mb-6 leading-tight">
                            <span className="bg-linear-to-r from-[#B76E79] to-[#F5D0C5] bg-clip-text text-transparent">
                                Transform
                            </span>{' '}
                            Your Look<br />
                            Instantly
                        </h1>
                        <p className="text-xl text-gray-300 mb-8 leading-relaxed max-w-2xl">
                            Premium quality hair extensions and wigs. From natural to bold,
                            find your perfect match with our 100% virgin human hair collection.
                        </p>

                        <div className="flex flex-wrap gap-4">
                            <button
                                onClick={() => {
                                    document.getElementById('products')?.scrollIntoView({ behavior: 'smooth' });
                                }}
                                className="px-8 py-4 bg-linear-to-r from-[#B76E79] to-[#D4919B] text-white rounded-full font-semibold hover:opacity-90 transition-opacity shadow-lg shadow-[#B76E79]/30"
                            >
                                Shop Collection
                            </button>
                            <button className="px-8 py-4 bg-white/10 text-white rounded-full font-semibold hover:bg-white/20 transition-colors border border-white/20 flex items-center gap-2">
                                <PlayCircle className="w-5 h-5" />
                                Watch Tutorial
                            </button>
                        </div>
                    </div>
                </div>
            </section>

            {/* Trust Badges */}
            <section className="bg-[#1A1A1A] border-y border-[#333] py-8">
                <div className="max-w-7xl mx-auto px-6">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                        {trustBadges.map((badge, index) => {
                            const Icon = badge.icon;
                            return (
                                <div key={index} className="flex items-center gap-3">
                                    <div className="w-12 h-12 bg-linear-to-br from-[#B76E79]/20 to-[#B76E79]/10 rounded-full flex items-center justify-center shrink-0 border border-[#B76E79]/30">
                                        <Icon className="w-5 h-5 text-[#B76E79]" />
                                    </div>
                                    <div>
                                        <div className="font-semibold text-white text-sm">{badge.title}</div>
                                        <div className="text-xs text-gray-400">{badge.subtitle}</div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </section>

            {/* Shop by Texture */}
            <section className="py-16 bg-[#1A1A1A]">
                <div className="max-w-7xl mx-auto px-6">
                    <h2 className="text-3xl font-bold text-center mb-4">
                        Shop by <span className="text-[#B76E79]">Texture</span>
                    </h2>
                    <p className="text-gray-400 text-center mb-10 max-w-xl mx-auto">
                        Find the perfect texture to match your natural hair or try something new
                    </p>
                    <div className="flex flex-wrap justify-center gap-3">
                        {textures.map((texture) => {
                            const isActive = selectedTexture === texture.value;
                            return (
                                <button
                                    key={texture.value}
                                    onClick={() => setSelectedTexture(texture.value)}
                                    className={`px-6 py-3 rounded-full font-medium transition-all flex items-center gap-2 ${isActive
                                            ? 'bg-linear-to-r from-[#B76E79] to-[#D4919B] text-white shadow-lg shadow-[#B76E79]/30'
                                            : 'bg-white/5 text-gray-300 hover:bg-white/10 border border-white/10'
                                        }`}
                                >
                                    <span>{texture.emoji}</span>
                                    {texture.name}
                                </button>
                            );
                        })}
                    </div>
                </div>
            </section>

            {/* Length Guide */}
            <section className="py-12 bg-[#222]">
                <div className="max-w-7xl mx-auto px-6">
                    <h2 className="text-2xl font-bold text-center mb-8">
                        Choose Your <span className="text-[#B76E79]">Length</span>
                    </h2>
                    <div className="flex flex-wrap justify-center gap-2">
                        {lengths.map((length) => {
                            const isActive = selectedLength === length;
                            return (
                                <button
                                    key={length}
                                    onClick={() => setSelectedLength(isActive ? null : length)}
                                    className={`w-14 h-14 rounded-full font-bold transition-all ${isActive
                                            ? 'bg-[#B76E79] text-white shadow-lg'
                                            : 'bg-white/5 text-gray-400 hover:bg-white/10 border border-white/10'
                                        }`}
                                >
                                    {length}
                                </button>
                            );
                        })}
                    </div>
                    <p className="text-gray-500 text-center mt-4 text-sm">
                        Tip: Curly hair appears shorter than straight hair of the same length
                    </p>
                </div>
            </section>

            {/* Products Section */}
            <section
                id="products"
                className="py-16 bg-[#1A1A1A]"
                style={{
                    '--store-primary': '#B76E79',
                    '--store-primary-text': '#FFFFFF',
                    '--store-accent': '#F5D0C5',
                } as React.CSSProperties}
            >
                <div className="max-w-7xl mx-auto px-6">
                    <div className="text-center mb-12">
                        <h2 className="text-4xl font-bold mb-4">
                            Our <span className="text-[#B76E79]">Collection</span>
                        </h2>
                        <p className="text-lg text-gray-400 max-w-2xl mx-auto">
                            100% virgin human hair. Ethically sourced. Luxury quality.
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

            {/* Installation Tutorial CTA */}
            <section className="py-16 bg-linear-to-r from-[#B76E79] to-[#D4919B]">
                <div className="max-w-7xl mx-auto px-6">
                    <div className="grid md:grid-cols-2 gap-12 items-center">
                        <div>
                            <span className="text-white/80 text-sm font-semibold uppercase tracking-wider">
                                Learn from the Pros
                            </span>
                            <h2 className="text-4xl font-bold text-white mt-2 mb-4">
                                Installation Tutorials
                            </h2>
                            <p className="text-lg text-white/90 mb-6 leading-relaxed">
                                Watch step-by-step tutorials from professional stylists.
                                Learn how to install, style, and maintain your extensions
                                for the perfect look every time.
                            </p>
                            <ul className="space-y-3 mb-8">
                                {['Clip-in installation', 'Sew-in techniques', 'Lace front styling', 'Maintenance tips'].map((item, idx) => (
                                    <li key={idx} className="flex items-center gap-3 text-white">
                                        <div className="w-5 h-5 bg-white text-[#B76E79] rounded-full flex items-center justify-center text-xs font-bold">✓</div>
                                        <span>{item}</span>
                                    </li>
                                ))}
                            </ul>
                            <button className="px-8 py-4 bg-white text-[#B76E79] rounded-full font-semibold hover:bg-white/90 transition-colors shadow-lg flex items-center gap-2">
                                <PlayCircle className="w-5 h-5" />
                                Watch Tutorials
                            </button>
                        </div>
                        <div className="relative">
                            <div className="bg-white/10 backdrop-blur-xs rounded-3xl p-8 text-center border border-white/20">
                                <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <PlayCircle className="w-10 h-10 text-white" />
                                </div>
                                <div className="text-2xl font-bold text-white">50+ Videos</div>
                                <div className="text-white/70">Free tutorials</div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Transformations / Before After */}
            <section className="py-16 bg-[#1A1A1A]">
                <div className="max-w-7xl mx-auto px-6">
                    <div className="text-center mb-12">
                        <h2 className="text-4xl font-bold mb-4">
                            Real <span className="text-[#B76E79]">Transformations</span>
                        </h2>
                        <p className="text-lg text-gray-400">
                            See what our customers are creating
                        </p>
                    </div>
                    <div className="grid md:grid-cols-3 gap-8">
                        {transformations.map((t, idx) => (
                            <div key={idx} className="bg-[#222] rounded-2xl overflow-hidden border border-[#333] hover:border-[#B76E79]/50 transition-colors group">
                                <div className="grid grid-cols-2 h-48">
                                    <div className="bg-linear-to-br from-gray-700 to-gray-800 flex items-center justify-center text-gray-500">
                                        {t.before}
                                    </div>
                                    <div className="bg-linear-to-br from-[#B76E79]/20 to-[#F5D0C5]/20 flex items-center justify-center text-[#B76E79]">
                                        {t.after}
                                    </div>
                                </div>
                                <div className="p-4">
                                    <div className="flex items-center gap-2 mb-2">
                                        <Heart className="w-4 h-4 text-[#B76E79]" />
                                        <span className="font-semibold text-white">{t.name}</span>
                                    </div>
                                    <span className="text-sm text-gray-400">{t.style}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Bundle Deals */}
            <section className="py-16 bg-[#222]">
                <div className="max-w-7xl mx-auto px-6 text-center">
                    <span className="px-4 py-1 bg-[#B76E79] text-white text-sm font-semibold rounded-full">
                        Save More
                    </span>
                    <h2 className="text-4xl font-bold mt-4 mb-4">
                        Bundle <span className="text-[#B76E79]">Deals</span>
                    </h2>
                    <p className="text-gray-400 mb-10 max-w-xl mx-auto">
                        Get everything you need in one package and save up to 30%
                    </p>
                    <div className="grid md:grid-cols-3 gap-6">
                        {[
                            { name: 'Starter Bundle', items: '3 bundles + closure', price: '$299', save: '15%' },
                            { name: 'Glam Bundle', items: '4 bundles + frontal', price: '$449', save: '25%' },
                            { name: 'Queen Bundle', items: '5 bundles + frontal + care kit', price: '$599', save: '30%' },
                        ].map((bundle, idx) => (
                            <div key={idx} className={`p-6 rounded-2xl border transition-all ${idx === 1
                                    ? 'bg-linear-to-br from-[#B76E79]/20 to-[#F5D0C5]/10 border-[#B76E79]'
                                    : 'bg-[#1A1A1A] border-[#333] hover:border-[#B76E79]/50'
                                }`}>
                                {idx === 1 && (
                                    <span className="px-3 py-1 bg-[#B76E79] text-white text-xs font-semibold rounded-full mb-4 inline-block">
                                        Most Popular
                                    </span>
                                )}
                                <h3 className="text-xl font-bold text-white mb-2">{bundle.name}</h3>
                                <p className="text-gray-400 text-sm mb-4">{bundle.items}</p>
                                <div className="text-3xl font-bold text-[#B76E79] mb-1">{bundle.price}</div>
                                <div className="text-sm text-green-400">Save {bundle.save}</div>
                                <button className={`w-full mt-6 py-3 rounded-full font-semibold transition-all ${idx === 1
                                        ? 'bg-[#B76E79] text-white hover:bg-[#A05D68]'
                                        : 'bg-white/10 text-white hover:bg-white/20 border border-white/20'
                                    }`}>
                                    Shop Bundle
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Footer */}
            <footer className="bg-[#111] text-gray-400 py-12 border-t border-[#333]">
                <div className="max-w-7xl mx-auto px-6">
                    <div className="grid md:grid-cols-4 gap-8 mb-8">
                        <div>
                            <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                                <Crown className="w-5 h-5 text-[#B76E79]" />
                                {merchant.business_name}
                            </h3>
                            <p className="text-sm leading-relaxed mb-4">
                                Premium quality hair extensions. 100% virgin human hair.
                            </p>
                            <div className="flex gap-2">
                                <span className="px-2 py-1 bg-[#B76E79]/20 text-[#B76E79] text-xs rounded">Virgin Hair</span>
                                <span className="px-2 py-1 bg-white/10 text-white text-xs rounded">Premium</span>
                            </div>
                        </div>
                        <div>
                            <h4 className="font-semibold text-white mb-4">Shop</h4>
                            <ul className="space-y-2 text-sm">
                                <li><a href="#" className="hover:text-[#B76E79] transition-colors">Bundles</a></li>
                                <li><a href="#" className="hover:text-[#B76E79] transition-colors">Closures</a></li>
                                <li><a href="#" className="hover:text-[#B76E79] transition-colors">Frontals</a></li>
                                <li><a href="#" className="hover:text-[#B76E79] transition-colors">Wigs</a></li>
                            </ul>
                        </div>
                        <div>
                            <h4 className="font-semibold text-white mb-4">Help</h4>
                            <ul className="space-y-2 text-sm">
                                <li><a href="#" className="hover:text-[#B76E79] transition-colors">Length Guide</a></li>
                                <li><a href="#" className="hover:text-[#B76E79] transition-colors">Color Matching</a></li>
                                <li><a href="#" className="hover:text-[#B76E79] transition-colors">Care Instructions</a></li>
                                <li><a href="#" className="hover:text-[#B76E79] transition-colors">FAQs</a></li>
                            </ul>
                        </div>
                        <div>
                            <h4 className="font-semibold text-white mb-4">Contact</h4>
                            <ul className="space-y-2 text-sm">
                                <li><a href="#" className="hover:text-[#B76E79] transition-colors">Live Chat</a></li>
                                <li><a href="#" className="hover:text-[#B76E79] transition-colors">Email Us</a></li>
                                <li><a href="#" className="hover:text-[#B76E79] transition-colors">Instagram</a></li>
                                <li><a href="#" className="hover:text-[#B76E79] transition-colors">TikTok</a></li>
                            </ul>
                        </div>
                    </div>
                    <div className="border-t border-[#333] pt-6 text-center text-sm">
                        <p>© {new Date().getFullYear()} {merchant.business_name}. All rights reserved.</p>
                        <p className="mt-2 text-gray-500">
                            Slay every day ✨
                        </p>
                    </div>
                </div>
            </footer>
        </div>
    );
}
