'use server';

import { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import { cookies, headers } from 'next/headers';
import { MerchantProvider } from '@/hooks/use-merchant';
import { StorefrontWrapper } from './storefront-wrapper';
import { escapeHtml } from '@/lib/sanitize';

// Enable ISR with 1 minute revalidation for storefront homepages
export const revalidate = 60;

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
    const { slug } = await params;
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    const { data: merchant } = await supabase
        .from('merchants')
        .select('business_name, site_title, site_tagline, site_description, business_type')
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
        },
    };
}

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
        .select('business_name, site_title, site_tagline, site_description, business_type')
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

        // Sanitize all user-controlled values for JSON-LD to prevent XSS
        jsonLd = {
            '@context': 'https://schema.org',
            '@type': schemaType,
            name: escapeHtml(merchant.business_name),
            description: escapeHtml(description),
            url: escapeHtml(baseUrl),
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
