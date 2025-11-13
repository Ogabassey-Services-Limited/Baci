
'use client';

import { ThemedButton, ThemedCard } from "@/components/themed";
import { getContrastingTextColor } from "@/lib/color-utils";
import type { BrandColors } from "@/types";
import Image from "next/image";
import { sampleProductsByCategory } from "@/lib/products";
import { getCountryByCode } from "@/lib/countries";

interface StorefrontPreviewProps {
    businessName: string;
    businessType: string;
    logoDataUri: string | null;
    brandColors: BrandColors | null;
}

export function StorefrontPreview({ businessName, businessType, logoDataUri, brandColors }: StorefrontPreviewProps) {
    if (!brandColors) {
        return (
            <div className="p-6 rounded-lg border border-dashed flex items-center justify-center h-full text-muted-foreground">
                Your store preview will appear here once colors are selected.
            </div>
        );
    }

    const themeStyle = {
        '--store-primary': brandColors.primary,
        '--store-secondary': brandColors.secondary,
        '--store-accent': brandColors.accent,
        '--store-primary-text': getContrastingTextColor(brandColors.primary),
        '--store-secondary-text': getContrastingTextColor(brandColors.secondary),
        '--store-accent-text': getContrastingTextColor(brandColors.accent),
    };
    
    const formatCurrency = (amount: number) => {
        // Using a default for preview
        const country = getCountryByCode('US');
        const locale = country ? `en-${country.code}` : 'en-US';
        const currency = country ? country.currency : 'USD';
        return new Intl.NumberFormat(locale, { style: 'currency', currency, currencyDisplay: 'symbol' }).format(amount);
    };

    const previewProducts = sampleProductsByCategory[businessType] || sampleProductsByCategory['other'];

    return (
        <div 
          className="p-4 rounded-lg border border-dashed bg-muted/20 overflow-hidden" 
          style={themeStyle as React.CSSProperties}
        >
            <div className="scale-[0.8] origin-top-left w-[125%] -translate-x-1 -translate-y-1 bg-background rounded-md shadow-lg pointer-events-none">
                {/* Header */}
                <header className="px-4 h-12 flex items-center gap-4 shadow-sm bg-card">
                    <div className="flex items-center gap-2 font-semibold">
                        {logoDataUri ? (
                            <Image src={logoDataUri} alt={`${businessName} logo`} width={24} height={24} className="rounded-sm object-contain" />
                        ) : <div className="w-6 h-6 bg-muted rounded-sm" />}
                        <span className="text-sm">{businessName || 'Your Store'}</span>
                    </div>
                </header>

                {/* Body */}
                <main className="p-6">
                     <h2 className="text-xl font-bold tracking-tighter text-center mb-6" style={{ color: 'var(--store-primary)' }}>
                        Our Products
                    </h2>
                    <div className="grid grid-cols-2 gap-4">
                        {previewProducts.map((product) => (
                           <ThemedCard key={product.id} className="overflow-hidden" accentPosition="top">
                                <Image
                                    src={product.imageLarge}
                                    alt={product.name}
                                    data-ai-hint={product.imageHint}
                                    width={200}
                                    height={150}
                                    className="object-cover w-full h-auto aspect-video"
                                />
                                <div className="p-3">
                                    <h3 className="font-semibold text-sm truncate">{product.name}</h3>
                                    <div className="flex items-center justify-between mt-2">
                                        <p className="text-sm font-bold" style={{ color: 'var(--store-primary)' }}>{formatCurrency(product.price)}</p>
                                        <ThemedButton colorRole="accent" size="sm">
                                            Add
                                        </ThemedButton>
                                    </div>
                                </div>
                            </ThemedCard>
                        ))}
                    </div>
                </main>

                {/* Footer */}
                <footer
                    className="text-white py-6 px-4 text-center"
                    style={{ backgroundColor: brandColors.primary, color: getContrastingTextColor(brandColors.primary) }}
                >
                    <p className="text-xs">&copy; {new Date().getFullYear()} {businessName || 'Your Store'}</p>
                </footer>
            </div>
        </div>
    );
}
