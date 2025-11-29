import { Metadata } from 'next';
import { Suspense } from 'react';
import { headers } from 'next/headers';
import { MerchantProvider } from '@/hooks/use-merchant';
import { StorefrontWrapper } from './storefront-wrapper';
import { escapeHtml } from '@/lib/sanitize';
import { StorefrontPageSkeleton } from '@/components/ui/skeletons';
import { getCachedMerchant } from '@/lib/cached-data';

// Valid slug pattern: alphanumeric and hyphens, no file extensions
const VALID_SLUG_REGEX = /^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$/;

function isValidMerchantSlug(slug: string): boolean {
    return typeof slug === 'string' &&
        !!slug.trim() &&
        !slug.includes('.') && // No file extensions
        VALID_SLUG_REGEX.test(slug.toLowerCase());
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
    const { slug } = await params;

    // Skip database query for invalid slugs (like static asset requests)
    if (!isValidMerchantSlug(slug)) {
        return {
            title: 'Not Found',
            description: 'The page you are looking for does not exist.',
        };
    }

    // Use cached merchant data for better performance
    const merchant = await getCachedMerchant(slug);

    if (!merchant) {
        return {
            title: 'Store Not Found',
            description: 'The store you are looking for does not exist.',
        };
    }

    const title = merchant.site_title || merchant.business_name;
    const description = merchant.site_description || merchant.site_tagline || `Welcome to ${merchant.business_name}`;

    const headersList = await headers();
    const host = headersList.get('host') || `${slug}.localhost:3000`;
    const protocol = process.env.NODE_ENV === 'development' ? 'http' : 'https';
    const baseUrl = `${protocol}://${host}`;

    const socialMedia = merchant.social_media as Record<string, string> | null;

    return {
        title: title,
        description: description,
        alternates: {
            canonical: baseUrl,
        },
        openGraph: {
            title: title,
            description: description,
            url: baseUrl,
            type: 'website',
            siteName: merchant.business_name,
            ...(merchant.logo_url && { images: [{ url: merchant.logo_url, alt: `${merchant.business_name} logo` }] }),
        },
        twitter: {
            card: 'summary_large_image',
            title: title,
            description: description,
            ...(merchant.logo_url && { images: [merchant.logo_url] }),
            ...(socialMedia?.twitter && {
                site: socialMedia.twitter.startsWith('@') ? socialMedia.twitter : `@${socialMedia.twitter}`,
            }),
        },
    };
}

export default async function StorefrontPage({ params }: { params: Promise<{ slug: string }> }) {
    const { slug } = await params;

    // Validate slug format to prevent database queries for static assets
    if (!isValidMerchantSlug(slug)) {
        return (
            <div className="flex h-screen w-full items-center justify-center">
                <p>Invalid store URL.</p>
            </div>
        );
    }

    // Use cached merchant data for better performance
    const merchant = await getCachedMerchant(slug);

    let jsonLd = null;

    if (merchant) {
        const headersList = await headers();
        const host = headersList.get('host') || `${slug}.localhost:3000`;
        const protocol = process.env.NODE_ENV === 'development' ? 'http' : 'https';
        const baseUrl = `${protocol}://${host}`;
        const description = merchant.site_description || merchant.site_tagline || `Welcome to ${merchant.business_name}`;

        // Map business_type to Schema.org type
        const getSchemaType = (type: string | null) => {
            switch (type) {
                case 'fashion': return 'ClothingStore';
                case 'electronics': return 'ElectronicsStore';
                case 'home-goods': return 'HomeGoodsStore';
                case 'health-beauty': return 'HealthAndBeautyBusiness';
                case 'food-beverage': return 'GroceryStore';
                case 'restaurant': return 'Restaurant';
                default: return 'Store';
            }
        };

        const schemaType = getSchemaType(merchant.business_type);
        const socialMedia = merchant.social_media as Record<string, string> | null;

        // Build sameAs array from social media links
        const sameAs: string[] = [];
        if (socialMedia) {
            if (socialMedia.facebook) sameAs.push(`https://facebook.com/${encodeURIComponent(socialMedia.facebook)}`);
            if (socialMedia.instagram) sameAs.push(`https://instagram.com/${encodeURIComponent(socialMedia.instagram.replace('@', ''))}`);
            if (socialMedia.twitter) sameAs.push(`https://twitter.com/${encodeURIComponent(socialMedia.twitter.replace('@', ''))}`);
            if (socialMedia.tiktok) sameAs.push(`https://tiktok.com/${encodeURIComponent(socialMedia.tiktok.replace('@', ''))}`);
            if (socialMedia.youtube) sameAs.push(`https://youtube.com/${encodeURIComponent(socialMedia.youtube)}`);
            if (socialMedia.linkedin) sameAs.push(`https://linkedin.com/company/${encodeURIComponent(socialMedia.linkedin)}`);
        }

        // Sanitize all user-controlled values for JSON-LD to prevent XSS
        jsonLd = {
            '@context': 'https://schema.org',
            '@type': schemaType,
            name: escapeHtml(merchant.business_name),
            description: escapeHtml(description),
            url: escapeHtml(baseUrl),
            ...(merchant.logo_url && { logo: escapeHtml(merchant.logo_url), image: escapeHtml(merchant.logo_url) }),
            ...(merchant.phone && { telephone: escapeHtml(merchant.phone) }),
            ...(sameAs.length > 0 && { sameAs: sameAs.map(url => escapeHtml(url)) }),
            potentialAction: {
                '@type': 'SearchAction',
                target: escapeHtml(`${baseUrl}/products?q={search_term_string}`),
                'query-input': 'required name=search_term_string',
            },
        };
    }

    return (
        <>
            {jsonLd && (
                <script
                    type="application/ld+json"
                    dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
                />
            )}
            <MerchantProvider slug={slug}>
                <Suspense fallback={<StorefrontPageSkeleton />}>
                    <StorefrontWrapper />
                </Suspense>
            </MerchantProvider>
        </>
    );
}
