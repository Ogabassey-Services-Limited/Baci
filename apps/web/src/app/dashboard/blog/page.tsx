import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';
import { getCachedFeatureSettings } from '@/lib/cached-data';
import { BlogClientPage } from './blog-client-page';
import { BlogDisabledView } from './components/blog-disabled-view';
import { getMerchantForUser } from '@/lib/merchant-server';
import type { CachedMerchant } from '@/lib/cached-data';

export default async function BlogPage() {
    const { merchant } = await getMerchantForUser();

    if (!merchant) {
        redirect('/login');
    }

    const features = await getCachedFeatureSettings(merchant.id);
    const blogEnabled = features?.blog_enabled ?? false;

    if (!blogEnabled) {
        return <BlogDisabledView />;
    }

    // Pass merchant as correct type expected by client
    // 'initialFeatures' helps hydrate the hook if we wanted to refactor further, 
    // but for now we rely on the Server Component gatkeeping.
    return <BlogClientPage merchant={merchant as unknown as CachedMerchant} />;
}
