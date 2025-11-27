import { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import { cookies, headers } from 'next/headers';
import { MerchantProvider } from '@/hooks/use-merchant';
import { StorefrontWrapper } from './storefront-wrapper';
import { escapeHtml } from '@/lib/sanitize';

// Enable ISR with 1 minute revalidation for storefront homepages
export const revalidate = 60;

/**
 * Generate page metadata for a storefront identified by its slug.
 *
 * @param params - A promise that resolves to an object containing the `slug` of the storefront to look up.
 * @returns A Metadata object for the store. When a merchant is found, the metadata includes:
 * - `title` and `description` derived from merchant fields (site_title, business_name, site_description, site_tagline)
 * - `alternates.canonical` set to the store's base URL
 * - `openGraph` with `title`, `description`, `url`, `type: "website"`, `siteName`, and optional `images` from `logo_url`
 * - `twitter` card with `card: "summary_large_image"`, `title`, `description`, optional `images` from `logo_url`, and an optional `site` handle derived from `social_media.twitter`
 *
 * If no merchant is found, returns metadata with `title` set to "Store Not Found" and an explanatory `description`.
 */
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
    const { slug } = await params;
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    const { data: merchant } = await supabase
        .from('merchants')
        .select('business_name, site_title, site_tagline, site_description, business_type, logo_url, social_media')
        .eq('slug', slug)
        .single();

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

/**
 * Renders a storefront page for the merchant identified by the route slug.
 *
 * @param params - Object containing a promise that resolves to the route params; expects `{ slug: string }`.
 * @returns The page's JSX: either an error message for an invalid slug or the merchant storefront (includes JSON-LD when merchant data is available).
 */
export default async function StorefrontPage({ params }: { params: Promise<{ slug: string }> }) {
    const { slug } = await params;

    if (typeof slug !== 'string' || !slug.trim()) {
        return (
            <div className="flex h-screen w-full items-center justify-center">
                <p>Invalid store URL.</p>
            </div>
        );
    }

    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    const { data: merchant } = await supabase
        .from('merchants')
        .select('business_name, site_title, site_tagline, site_description, business_type, logo_url, phone, social_media')
        .eq('slug', slug)
        .single();

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
            if (socialMedia.facebook) sameAs.push(`https://facebook.com/${socialMedia.facebook}`);
            if (socialMedia.instagram) sameAs.push(`https://instagram.com/${socialMedia.instagram.replace('@', '')}`);
            if (socialMedia.twitter) sameAs.push(`https://twitter.com/${socialMedia.twitter.replace('@', '')}`);
            if (socialMedia.tiktok) sameAs.push(`https://tiktok.com/${socialMedia.tiktok.replace('@', '')}`);
            if (socialMedia.youtube) sameAs.push(`https://youtube.com/${socialMedia.youtube}`);
            if (socialMedia.linkedin) sameAs.push(`https://linkedin.com/company/${socialMedia.linkedin}`);
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
                <StorefrontWrapper />
            </MerchantProvider>
        </>
    );
}