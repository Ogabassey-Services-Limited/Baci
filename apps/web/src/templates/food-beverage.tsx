'use client';

import { StorefrontProductGrid } from '@/components/storefront/product-grid';
import type { TemplatePageProps } from '@/templates/registry';
import {
    Leaf,
    Wheat,
    Milk,
    Apple,
    Coffee,
    ChefHat,
    Truck,
    Award,
    Clock,
    Heart
} from 'lucide-react';
import { useState } from 'react';

/**
 * Food & Beverage Template - "Artisan Kitchen"
 * Warm, rustic, handcrafted design for gourmet food e-commerce
 * Color scheme: Burnt Orange, Cream, Deep Olive, Rich Brown
 */
export function FoodBeverageTemplate({ children }: { children: React.ReactNode }) {
    return <div className="template-food-beverage bg-[#FFF8E7]">{children}</div>;
}

export function FoodBeverageHome(props: TemplatePageProps) {
    const [selectedCategory, setSelectedCategory] = useState('All');
    const [selectedDiet, setSelectedDiet] = useState<string | null>(null);

    const merchant = props.merchant || {
        business_name: 'Artisan Kitchen',
        logo_url: undefined,
        brand_colors: {
            primary: '#D2691E',
            background: '#FFF8E7',
            accent: '#556B2F',
        },
    };

    const { primary, background, accent } = merchant.brand_colors || {
        primary: '#D2691E',
        background: '#FFF8E7',
        accent: '#556B2F',
    };

    const categories = [
        { name: 'All', value: 'All', icon: ChefHat },
        { name: 'Bakery', value: 'Bakery', icon: Wheat },
        { name: 'Produce', value: 'Produce', icon: Apple },
        { name: 'Dairy', value: 'Dairy', icon: Milk },
        { name: 'Beverages', value: 'Beverages', icon: Coffee },
        { name: 'Organic', value: 'Organic', icon: Leaf },
    ];

    const dietaryFilters = [
        { name: 'Vegan', value: 'vegan', color: 'bg-green-100 text-green-800 border-green-300' },
        { name: 'Gluten-Free', value: 'gluten-free', color: 'bg-amber-100 text-amber-800 border-amber-300' },
        { name: 'Organic', value: 'organic', color: 'bg-lime-100 text-lime-800 border-lime-300' },
        { name: 'Keto', value: 'keto', color: 'bg-purple-100 text-purple-800 border-purple-300' },
        { name: 'Dairy-Free', value: 'dairy-free', color: 'bg-blue-100 text-blue-800 border-blue-300' },
    ];

    const trustBadges = [
        { icon: Leaf, title: 'Farm Fresh', subtitle: 'Locally Sourced' },
        { icon: Truck, title: 'Fast Delivery', subtitle: 'Same-Day Available' },
        { icon: Award, title: 'Quality Guaranteed', subtitle: '100% Satisfaction' },
        { icon: Clock, title: 'Fresh Daily', subtitle: 'Made to Order' },
    ];

    const recipes = [
        { name: 'Homemade Sourdough', time: '2 hours', difficulty: 'Medium', image: '🍞' },
        { name: 'Farm Fresh Salad', time: '15 mins', difficulty: 'Easy', image: '🥗' },
        { name: 'Artisan Cheese Board', time: '10 mins', difficulty: 'Easy', image: '🧀' },
    ];

    return (
        <div 
            className="min-h-screen bg-store-background text-store-foreground"
            style={{
                '--store-primary': primary,
                '--store-background': background,
                '--store-accent': accent,
                '--store-foreground': '#3D2314', // Default dark brown text for this theme
            } as React.CSSProperties}
        >
            {/* Hero Section - Warm, Appetizing */}
            <section className="relative bg-linear-to-br from-store-primary to-[color-mix(in_srgb,var(--store-primary),black_20%)] text-white overflow-hidden">
                {/* Decorative pattern */}
                <div className="absolute inset-0 opacity-10">
                    <div className="absolute top-10 left-10 text-8xl">🌾</div>
                    <div className="absolute bottom-10 right-10 text-8xl">🍃</div>
                    <div className="absolute top-1/2 left-1/4 text-6xl">🥖</div>
                </div>

                <div className="relative max-w-7xl mx-auto px-6 py-20">
                    <div className="max-w-3xl">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-14 h-14 bg-white/20 rounded-full flex items-center justify-center">
                                <ChefHat className="w-7 h-7" />
                            </div>
                            <div className="flex gap-2">
                                <span className="px-3 py-1 bg-store-accent text-white text-xs font-semibold rounded-full">
                                    Farm Fresh
                                </span>
                                <span className="px-3 py-1 bg-white/20 text-white text-xs font-semibold rounded-full">
                                    Artisan Made
                                </span>
                            </div>
                        </div>

                        <h1 className="text-5xl md:text-6xl font-serif font-bold mb-6 leading-tight">
                            Handcrafted with Love,<br />
                            <span className="text-[color-mix(in_srgb,var(--store-background),var(--store-primary)_20%)]">Delivered Fresh</span>
                        </h1>
                        <p className="text-xl text-orange-100 mb-8 leading-relaxed max-w-2xl">
                            From our farms to your table. Discover artisanal foods, locally sourced ingredients,
                            and gourmet delights crafted by passionate makers.
                        </p>

                        <div className="flex flex-wrap gap-4">
                            <button
                                onClick={() => {
                                    document.getElementById('products')?.scrollIntoView({ behavior: 'smooth' });
                                }}
                                className="px-8 py-4 bg-white text-store-primary rounded-full font-semibold hover:bg-orange-50 transition-colors shadow-lg"
                            >
                                Shop Fresh
                            </button>
                            <button className="px-8 py-4 bg-store-accent text-white rounded-full font-semibold hover:bg-[color-mix(in_srgb,var(--store-accent),black_10%)] transition-colors shadow-lg flex items-center gap-2">
                                <Heart className="w-5 h-5" />
                                Weekly Box
                            </button>
                        </div>
                    </div>
                </div>
            </section>

            {/* Trust Badges */}
            <section className="bg-white border-y border-orange-200 py-8">
                <div className="max-w-7xl mx-auto px-6">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                        {trustBadges.map((badge, index) => {
                            const Icon = badge.icon;
                            return (
                                <div key={index} className="flex items-center gap-3">
                                    <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center shrink-0">
                                        <Icon className="w-6 h-6 text-store-primary" />
                                    </div>
                                    <div>
                                        <div className="font-semibold text-store-foreground text-sm">{badge.title}</div>
                                        <div className="text-xs text-gray-600">{badge.subtitle}</div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </section>

            {/* Category Navigation */}
            <section className="py-12 bg-store-background">
                <div className="max-w-7xl mx-auto px-6">
                    <h2 className="text-3xl font-serif font-bold text-center text-store-foreground mb-8">
                        Shop by Category
                    </h2>
                    <div className="grid grid-cols-3 md:grid-cols-6 gap-4">
                        {categories.map((category) => {
                            const Icon = category.icon;
                            const isActive = selectedCategory === category.value;
                            return (
                                <button
                                    key={category.value}
                                    onClick={() => setSelectedCategory(category.value)}
                                    className={`p-4 rounded-2xl border-2 transition-all flex flex-col items-center gap-2 ${isActive
                                            ? 'border-store-primary bg-orange-50 shadow-md'
                                            : 'border-orange-200 bg-white hover:border-store-primary hover:shadow-sm'
                                        }`}
                                >
                                    <Icon className={`w-8 h-8 ${isActive ? 'text-store-primary' : 'text-gray-400'}`} />
                                    <span className={`text-sm font-medium ${isActive ? 'text-store-primary' : 'text-gray-700'}`}>
                                        {category.name}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                </div>
            </section>

            {/* Dietary Filters + Products Section */}
            <section
                id="products"
                className="py-16 bg-white"
            >
                <div className="max-w-7xl mx-auto px-6">
                    <div className="text-center mb-8">
                        <h2 className="text-4xl font-serif font-bold text-store-foreground mb-4">
                            Fresh from the Kitchen
                        </h2>
                        <p className="text-lg text-gray-600 max-w-2xl mx-auto">
                            Handpicked, locally sourced, and made with love
                        </p>
                    </div>

                    {/* Dietary Filter Bar */}
                    <div className="mb-8">
                        <div className="bg-linear-to-r from-orange-50 to-lime-50 border border-orange-200 rounded-2xl p-4 shadow-sm">
                            <div className="flex items-center justify-center gap-2 flex-wrap">
                                <span className="text-sm font-medium text-store-foreground mr-2">Dietary:</span>
                                {dietaryFilters.map((filter) => {
                                    const isActive = selectedDiet === filter.value;
                                    return (
                                        <button
                                            key={filter.value}
                                            onClick={() => setSelectedDiet(isActive ? null : filter.value)}
                                            className={`px-4 py-2 rounded-full text-sm font-medium transition-all border ${isActive
                                                    ? 'bg-store-primary text-white border-store-primary shadow-md'
                                                    : `${filter.color} hover:shadow-sm`
                                                }`}
                                        >
                                            {filter.name}
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

            {/* Weekly Subscription Box CTA */}
            <section className="py-16 bg-linear-to-r from-store-accent to-[color-mix(in_srgb,var(--store-accent),black_20%)] text-white">
                <div className="max-w-7xl mx-auto px-6">
                    <div className="grid md:grid-cols-2 gap-12 items-center">
                        <div>
                            <span className="text-lime-200 text-sm font-semibold uppercase tracking-wider">
                                Subscribe & Save
                            </span>
                            <h2 className="text-4xl font-serif font-bold mt-2 mb-4">
                                Weekly Fresh Box
                            </h2>
                            <p className="text-lg text-lime-100 mb-6 leading-relaxed">
                                Get a curated selection of seasonal produce, artisan breads, and gourmet
                                treats delivered to your door every week. Customize your box based on
                                your dietary preferences.
                            </p>
                            <ul className="space-y-3 mb-8">
                                {['Seasonal local produce', 'Artisan breads & pastries', 'Free delivery included', 'Skip or cancel anytime'].map((item, idx) => (
                                    <li key={idx} className="flex items-center gap-3">
                                        <div className="w-5 h-5 bg-lime-400 text-[color-mix(in_srgb,var(--store-accent),black_40%)] rounded-full flex items-center justify-center text-xs font-bold">✓</div>
                                        <span>{item}</span>
                                    </li>
                                ))}
                            </ul>
                            <button className="px-8 py-4 bg-white text-store-accent rounded-full font-semibold hover:bg-lime-50 transition-colors shadow-lg">
                                Start Your Box →
                            </button>
                        </div>
                        <div className="relative">
                            <div className="bg-white/10 backdrop-blur-xs rounded-3xl p-8 text-center">
                                <div className="text-8xl mb-4">🧺</div>
                                <div className="text-2xl font-bold">From $49/week</div>
                                <div className="text-lime-200">Customize your box</div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Recipe Inspiration */}
            <section className="py-16 bg-store-background">
                <div className="max-w-7xl mx-auto px-6">
                    <div className="text-center mb-12">
                        <h2 className="text-4xl font-serif font-bold text-store-foreground mb-4">
                            Recipe Inspiration
                        </h2>
                        <p className="text-lg text-gray-600">
                            Made with love using our products
                        </p>
                    </div>
                    <div className="grid md:grid-cols-3 gap-8">
                        {recipes.map((recipe, idx) => (
                            <div key={idx} className="bg-white rounded-2xl shadow-md overflow-hidden hover:shadow-lg transition-shadow group cursor-pointer">
                                <div className="h-48 bg-linear-to-br from-orange-100 to-amber-50 flex items-center justify-center">
                                    <span className="text-7xl group-hover:scale-110 transition-transform">{recipe.image}</span>
                                </div>
                                <div className="p-6">
                                    <h3 className="text-xl font-serif font-bold text-store-foreground mb-2">{recipe.name}</h3>
                                    <div className="flex items-center gap-4 text-sm text-gray-600">
                                        <span className="flex items-center gap-1">
                                            <Clock className="w-4 h-4" /> {recipe.time}
                                        </span>
                                        <span className="px-2 py-1 bg-orange-100 text-store-primary rounded-full text-xs font-medium">
                                            {recipe.difficulty}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Farm Story / Trust Section */}
            <section className="py-16 bg-white border-t border-orange-200">
                <div className="max-w-7xl mx-auto px-6">
                    <div className="grid md:grid-cols-2 gap-12 items-center">
                        <div className="bg-linear-to-br from-orange-100 to-amber-50 rounded-3xl h-80 flex items-center justify-center">
                            <span className="text-9xl">🌾</span>
                        </div>
                        <div>
                            <span className="text-store-primary text-sm font-semibold uppercase tracking-wider">
                                Our Story
                            </span>
                            <h2 className="text-3xl font-serif font-bold text-store-foreground mt-2 mb-4">
                                From Farm to Your Table
                            </h2>
                            <p className="text-gray-600 leading-relaxed mb-6">
                                We partner with local farmers and artisan producers who share our passion for
                                quality and sustainability. Every product is carefully selected to bring you
                                the freshest, most flavorful ingredients.
                            </p>
                            <p className="text-gray-600 leading-relaxed mb-6">
                                Our commitment to sustainable practices means less packaging, local sourcing,
                                and supporting small-batch producers who care about their craft.
                            </p>
                            <button className="text-store-primary font-semibold hover:text-[color-mix(in_srgb,var(--store-primary),black_20%)] transition-colors">
                                Learn More About Our Farms →
                            </button>
                        </div>
                    </div>
                </div>
            </section>

            {/* Footer */}
            <footer className="bg-[#3D2314] text-orange-100 py-12">
                <div className="max-w-7xl mx-auto px-6">
                    <div className="grid md:grid-cols-4 gap-8 mb-8">
                        <div>
                            <h3 className="text-xl font-serif font-bold text-white mb-4">
                                {merchant.business_name}
                            </h3>
                            <p className="text-sm leading-relaxed mb-4">
                                Handcrafted with love. Fresh from the farm to your table.
                            </p>
                            <div className="flex gap-2">
                                <span className="px-2 py-1 bg-store-accent text-white text-xs rounded">Organic</span>
                                <span className="px-2 py-1 bg-store-primary text-white text-xs rounded">Local</span>
                            </div>
                        </div>
                        <div>
                            <h4 className="font-semibold text-white mb-4">Shop</h4>
                            <ul className="space-y-2 text-sm">
                                <li><a href="#" className="hover:text-store-primary transition-colors">Bakery</a></li>
                                <li><a href="#" className="hover:text-store-primary transition-colors">Produce</a></li>
                                <li><a href="#" className="hover:text-store-primary transition-colors">Dairy & Eggs</a></li>
                                <li><a href="#" className="hover:text-store-primary transition-colors">Beverages</a></li>
                            </ul>
                        </div>
                        <div>
                            <h4 className="font-semibold text-white mb-4">Company</h4>
                            <ul className="space-y-2 text-sm">
                                <li><a href="#" className="hover:text-store-primary transition-colors">Our Story</a></li>
                                <li><a href="#" className="hover:text-store-primary transition-colors">Our Farmers</a></li>
                                <li><a href="#" className="hover:text-store-primary transition-colors">Sustainability</a></li>
                                <li><a href="#" className="hover:text-store-primary transition-colors">Recipes</a></li>
                            </ul>
                        </div>
                        <div>
                            <h4 className="font-semibold text-white mb-4">Support</h4>
                            <ul className="space-y-2 text-sm">
                                <li><a href="#" className="hover:text-store-primary transition-colors">Contact Us</a></li>
                                <li><a href="#" className="hover:text-store-primary transition-colors">Delivery Info</a></li>
                                <li><a href="#" className="hover:text-store-primary transition-colors">Returns</a></li>
                                <li><a href="#" className="hover:text-store-primary transition-colors">FAQs</a></li>
                            </ul>
                        </div>
                    </div>
                    <div className="border-t border-orange-900 pt-6 text-center text-sm">
                        <p>© {new Date().getFullYear()} {merchant.business_name}. All rights reserved.</p>
                        <p className="mt-2 text-orange-200/60">
                            Made with ❤️ and fresh ingredients
                        </p>
                    </div>
                </div>
            </footer>
        </div>
    );
}
