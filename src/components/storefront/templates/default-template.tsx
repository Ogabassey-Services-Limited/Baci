'use client';

import { useMerchant } from '@/hooks/use-merchant';
import { useIndustryTheme } from '@/hooks/use-industry-theme';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import { AnnouncementBar } from '@/components/storefront/blocks/announcement-bar';
import { OgabasseyHeader } from '@/components/storefront/blocks/ogabassey-header';
import { Footer } from '@/components/storefront/blocks/footer';
import { StorefrontProductGrid } from '@/components/storefront/product-grid';
import { Newsletter } from '@/components/storefront/blocks/newsletter';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

export function DefaultTemplate() {
    const { merchant } = useMerchant();
    const theme = useIndustryTheme(merchant?.business_type);

    // --- Dynamic Assets ---
    const getHeroImage = () => {
        switch (merchant?.business_type) {
            case 'ELECTRONICS': return PlaceHolderImages.find(i => i.id === 'hero-electronics-1')?.imageUrl;
            case 'FOOD_BEVERAGE': return PlaceHolderImages.find(i => i.id === 'hero-food-1')?.imageUrl;
            case 'FASHION': return PlaceHolderImages.find(i => i.id === 'hero-fashion-1')?.imageUrl;
            case 'HOME_GOODS': return PlaceHolderImages.find(i => i.id === 'hero-home-1')?.imageUrl;
            case 'HEALTH_BEAUTY': return PlaceHolderImages.find(i => i.id === 'hero-beauty-1')?.imageUrl;
            case 'HANDMADE': return PlaceHolderImages.find(i => i.id === 'hero-handmade-1')?.imageUrl;
            case 'HAIR_EXTENSIONS': return PlaceHolderImages.find(i => i.id === 'hero-hair-1')?.imageUrl;
            default: return PlaceHolderImages.find(i => i.id === 'hero-electronics-1')?.imageUrl;
        }
    };

    const heroImage = getHeroImage() || 'https://images.unsplash.com/photo-1696429175928-793a1cdef1d3';

    // --- Dynamic Categories ---
    const categories = [
        { label: 'New Arrivals', icon: theme.icons.primary, href: '/category/new' },
        { label: 'Best Sellers', icon: theme.icons.secondary, href: '/category/best-sellers' },
        { label: 'On Sale', icon: theme.icons.tertiary, href: '/category/sale' },
        { label: 'Featured', icon: theme.icons.primary, href: '/category/featured' },
    ];

    // --- Render Helpers ---
    const RadiusMap = {
        'none': 'rounded-none',
        'sm': 'rounded-sm',
        'md': 'rounded-md',
        'lg': 'rounded-lg',
        'xl': 'rounded-xl',
        '2xl': 'rounded-2xl',
        '3xl': 'rounded-3xl',
        'full': 'rounded-full',
    };

    const radiusClass = RadiusMap[theme.radius];

    return (
        <div
            className="min-h-screen font-sans transition-colors duration-300"
            style={{ backgroundColor: theme.colors.background, color: theme.colors.text }}
        >
            <AnnouncementBar />
            <OgabasseyHeader />

            <main>
                {/* --- Dynamic Hero Section --- */}
                <section className="relative overflow-hidden">
                    {theme.layout.hero === 'full' ? (
                        <div className="relative h-[600px] w-full">
                            <img
                                src={heroImage}
                                alt="Hero"
                                className="absolute inset-0 w-full h-full object-cover"
                            />
                            <div className="absolute inset-0 bg-black/40 flex items-center justify-center text-center p-6">
                                <div className="max-w-2xl text-white space-y-6">
                                    <h1 className="text-5xl md:text-7xl font-bold tracking-tight">
                                        {merchant?.business_name || 'Welcome to Store'}
                                    </h1>
                                    <p className="text-xl md:text-2xl font-light opacity-90">
                                        Discover our premium collection tailored just for you.
                                    </p>
                                    <button
                                        className={cn(
                                            "px-8 py-4 text-lg font-medium transition-transform hover:scale-105",
                                            radiusClass
                                        )}
                                        style={{ backgroundColor: theme.colors.accent, color: '#fff' }}
                                    >
                                        Shop Now
                                    </button>
                                </div>
                            </div>
                        </div>
                    ) : (
                        // Split Layout
                        <div className="container mx-auto px-4 py-12 lg:py-24">
                            <div className="grid lg:grid-cols-2 gap-12 items-center">
                                <div className="space-y-8">
                                    <h1 className="text-5xl md:text-7xl font-bold tracking-tight" style={{ color: theme.colors.primary }}>
                                        {merchant?.business_name || 'Welcome'}
                                    </h1>
                                    <p className="text-xl opacity-80 max-w-lg">
                                        Experience quality and craftsmanship in every product we offer.
                                    </p>
                                    <button
                                        className={cn(
                                            "px-8 py-4 text-lg font-medium flex items-center gap-2 transition-all hover:gap-4",
                                            radiusClass
                                        )}
                                        style={{ backgroundColor: theme.colors.primary, color: '#fff' }}
                                    >
                                        Explore Collection <ArrowRight className="w-5 h-5" />
                                    </button>
                                </div>
                                <div className={cn("relative h-[500px] overflow-hidden shadow-2xl", radiusClass)}>
                                    <img
                                        src={heroImage}
                                        alt="Hero"
                                        className="absolute inset-0 w-full h-full object-cover transition-transform hover:scale-105 duration-700"
                                    />
                                </div>
                            </div>
                        </div>
                    )}
                </section>

                {/* --- Dynamic Category Rail --- */}
                <section className="py-12 container mx-auto px-4">
                    <h2 className="text-2xl font-bold mb-8" style={{ color: theme.colors.primary }}>Shop by Category</h2>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {categories.map((cat, i) => (
                            <Link
                                key={i}
                                href={cat.href}
                                className={cn(
                                    "group flex flex-col items-center justify-center p-6 transition-all hover:shadow-lg border",
                                    radiusClass,
                                    theme.layout.categoryRail === 'circle' && "aspect-square rounded-full",
                                    theme.layout.categoryRail === 'pill' && "aspect-[2/1]",
                                    theme.layout.categoryRail === 'square' && "aspect-square",
                                    theme.layout.categoryRail === 'card' && "aspect-[4/3]"
                                )}
                                style={{
                                    backgroundColor: theme.colors.card,
                                    borderColor: theme.colors.background === '#09090B' ? '#27272A' : '#E5E7EB' // Dark mode border fix
                                }}
                            >
                                <cat.icon
                                    className="w-8 h-8 mb-3 transition-transform group-hover:scale-110"
                                    style={{ color: theme.colors.accent }}
                                />
                                <span className="font-medium">{cat.label}</span>
                            </Link>
                        ))}
                    </div>
                </section>

                {/* --- Dynamic Product Grid --- */}
                <section className="py-12 container mx-auto px-4">
                    <StorefrontProductGrid
                        title="Featured Products"
                        columns={4}
                        limit={4}
                    // We can pass styles to the grid if it supports them, 
                    // otherwise we rely on global theme vars or wrapper styles.
                    // For now, the grid is standard, but we wrap it to control context if needed.
                    />
                </section>

                {/* --- Newsletter --- */}
                <Newsletter
                    title="Stay Updated"
                    subtitle="Join our mailing list for exclusive offers."
                    buttonText="Subscribe"
                    backgroundColor={theme.colors.card}
                />

            </main>

            <Footer
                backgroundColor={theme.colors.primary}
                textColor="#ffffff"
                showNewsletter={false}
            />
        </div>
    );
}
