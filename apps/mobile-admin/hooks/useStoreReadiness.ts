
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useMerchant } from './useMerchant';
import { SetupItem, StoreReadiness } from '@/types/readiness';

export function useStoreReadiness() {
    const { merchant, isLoading: isMerchantLoading } = useMerchant();

    const { data: readiness, isLoading: isReadinessLoading, refetch } = useQuery({
        queryKey: ['store-readiness', merchant?.id],
        queryFn: async () => {
            if (!merchant) return null;

            // Get published product count
            const { count: publishedProductCount } = await supabase
                .from('products')
                .select('*', { count: 'exact', head: true })
                .eq('merchant_id', merchant.id)
                .eq('status', 'active');

            const items: SetupItem[] = [
                // === REQUIRED ITEMS ===
                {
                    id: 'verify_kyc',
                    label: 'Verify your identity (KYC)',
                    description: 'NIN, BVN, or CAC required for payments',
                    completed: !!(merchant.nin || merchant.bvn || merchant.cac_rc_number),
                    href: '/store-settings', // TODO: Deep link to KYC section if possible
                    priority: 'required',
                    category: 'payments',
                },
                {
                    id: 'bank_account',
                    label: 'Add bank account',
                    description: 'Required to receive payments via Paystack',
                    completed: !!(
                        merchant.bank_code &&
                        merchant.bank_account_number &&
                        merchant.paystack_subaccount_code
                    ),
                    href: '/payment-methods',
                    priority: 'required',
                    category: 'payments',
                },
                {
                    id: 'first_product',
                    label: 'Publish your first product',
                    description: 'You need at least one published product to start selling',
                    completed: (publishedProductCount || 0) > 0,
                    href: '/product/new',
                    priority: 'required',
                    category: 'products',
                },
                {
                    id: 'country',
                    label: 'Set your country/region',
                    description: 'Determines currency, shipping options, and tax settings',
                    completed: !!merchant.country,
                    href: '/store-settings',
                    priority: 'required',
                    category: 'store',
                },
                {
                    id: 'contact_info',
                    label: 'Add contact information',
                    description: 'Let customers know how to reach you',
                    completed: !!(merchant.support_email || merchant.support_phone),
                    href: '/store-settings',
                    priority: 'required',
                    category: 'store',
                },

                // === RECOMMENDED ITEMS ===
                {
                    id: 'business_address',
                    label: 'Add business address',
                    description: 'Builds trust and may be legally required',
                    completed: !!merchant.business_address,
                    href: '/store-settings',
                    priority: 'recommended',
                    category: 'store',
                },
                {
                    id: 'hero_carousel',
                    label: 'Set up hero carousel',
                    description: 'Add eye-catching banners to your homepage',
                    // @ts-ignore - hero_slides might be explicitly typed or strictly array
                    completed: Array.isArray(merchant.hero_slides) && merchant.hero_slides.length > 0,
                    href: '/store-settings',
                    priority: 'recommended',
                    category: 'marketing',
                },

                // === OPTIONAL ITEMS ===
                {
                    id: 'social_media',
                    label: 'Connect social media',
                    description: 'Link your social profiles for better engagement',
                    completed: !!(
                        merchant.social_media?.instagram ||
                        merchant.social_media?.facebook ||
                        merchant.social_media?.twitter ||
                        merchant.social_media?.tiktok
                    ),
                    href: '/store-settings',
                    priority: 'optional',
                    category: 'marketing',
                },
                {
                    id: 'analytics',
                    label: 'Set up analytics',
                    description: 'Track visitors and conversions',
                    completed: !!(
                        merchant.google_analytics_id ||
                        merchant.facebook_pixel_id ||
                        merchant.tiktok_pixel_id ||
                        merchant.snapchat_pixel_id ||
                        merchant.twitter_pixel_id
                    ),
                    href: '/store-settings', // Redirects to settings where analytics keys are
                    priority: 'optional',
                    category: 'marketing',
                },
                {
                    id: 'multiple_products',
                    label: 'Add more products',
                    description: 'Stores with 5+ published products convert better',
                    completed: (publishedProductCount || 0) >= 5,
                    href: '/product/new',
                    priority: 'optional',
                    category: 'products',
                },
            ];

            // Calculate stats
            const requiredItems = items.filter((item) => item.priority === 'required');
            const recommendedItems = items.filter((item) => item.priority === 'recommended');
            const completedRequired = requiredItems.filter((item) => item.completed).length;
            const completedRecommended = recommendedItems.filter((item) => item.completed).length;
            const totalCompleted = items.filter((item) => item.completed).length;

            const result: StoreReadiness = {
                isReady: completedRequired === requiredItems.length,
                isPublished: merchant.is_published ?? false,
                completedRequired,
                totalRequired: requiredItems.length,
                completedRecommended,
                totalRecommended: recommendedItems.length,
                overallProgress: Math.round((totalCompleted / items.length) * 100),
                items,
            };

            return result;
        },
        enabled: !!merchant?.id,
    });

    return {
        readiness,
        isLoading: isMerchantLoading || isReadinessLoading,
        refetch,
    };
}
