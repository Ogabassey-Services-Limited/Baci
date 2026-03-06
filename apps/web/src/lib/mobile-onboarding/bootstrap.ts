import { createAdminClient } from '@/lib/supabase/admin';
import type { MobileOnboardingProfile } from './metadata';

export function scheduleInitialStoreAssets(
  merchantId: string,
  merchantSlug: string,
  profile: MobileOnboardingProfile,
  defer?: (callback: () => Promise<void>) => void
) {
  if (!defer) {
    return;
  }

  defer(async () => {
    const adminSupabase = createAdminClient();
    const normalizedBusinessType =
      typeof profile.businessType === 'string' && profile.businessType.trim()
        ? profile.businessType.toLowerCase()
        : 'other';

    try {
      const { generateInitialTemplate } = await import(
        '@/lib/initial-template-generator'
      );
      const safeBrandColors = profile.brandColors || {
        primary: '#000000',
        background: '#ffffff',
        accent: '#F59E0B',
      };
      const config = await generateInitialTemplate({
        businessName: profile.businessName,
        businessType: profile.businessType,
        brandColors: safeBrandColors,
        merchant: { id: merchantId, slug: merchantSlug },
      });
      const { error: pageConfigError } = await adminSupabase
        .from('page_configs')
        .upsert(
          {
            merchant_id: merchantId,
            page_slug: 'home',
            page_name: 'Home',
            draft_config: config,
            published_config: config,
            is_published: true,
          },
          { onConflict: 'merchant_id,page_slug' }
        );
      if (pageConfigError) {
        console.error(
          'Failed to upsert page config for merchant',
          merchantId,
          pageConfigError
        );
      }
    } catch (error) {
      console.error(
        'Template generation failed for merchant',
        merchantId,
        error
      );
    }

    try {
      const { data: merchant, error: merchantError } = await adminSupabase
        .from('merchants')
        .select('hero_slides')
        .eq('id', merchantId)
        .maybeSingle();

      if (merchantError) {
        console.error(
          'Failed to check hero images for merchant',
          merchantId,
          merchantError
        );
        return;
      }

      if (Array.isArray(merchant?.hero_slides) && merchant.hero_slides.length) {
        return;
      }

      const { assignHeroImagesToMerchant } = await import(
        '@/services/hero-image-generator'
      );
      await assignHeroImagesToMerchant(
        merchantId,
        normalizedBusinessType,
        false
      );
    } catch (error) {
      console.error(
        'Hero image assignment failed for merchant',
        merchantId,
        error
      );
    }
  });
}
