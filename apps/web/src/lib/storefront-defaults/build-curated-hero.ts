import { normalizeBusinessType } from '@/lib/initial-template-profiles';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import type { AiContent } from './curated-storefront-types';

export async function generateHeroSlides(
  businessName: string,
  businessType: string,
  heroImageIds?: string[],
  aiContent?: AiContent['hero']
) {
  const fallbackImages = [
    { imageUrl: '/placeholder.png' },
    { imageUrl: '/placeholder.png' },
    { imageUrl: '/placeholder.png' },
  ];
  let imagesForSlides = [
    PlaceHolderImages[0] || fallbackImages[0],
    PlaceHolderImages[1] || fallbackImages[1],
    PlaceHolderImages[2] || fallbackImages[2],
  ];

  if (heroImageIds && heroImageIds.length > 0) {
    try {
      const { createClient } = await import('@/lib/supabase/server');
      const { cookies } = await import('next/headers');
      const cookieStore = await cookies();
      const supabase = createClient(cookieStore);
      const { data: heroImages, error } = await supabase
        .from('ai_hero_images')
        .select('image_url')
        .in('id', heroImageIds)
        .limit(3);
      if (!error && heroImages && heroImages.length > 0) {
        imagesForSlides = heroImages.map(
          (img: { image_url: string }, index: number) => ({
            imageUrl: img.image_url,
            id: `ai-hero-${index}`,
            description: 'AI Generated Hero Image',
            imageHint: 'hero',
          })
        );
      }
    } catch (error) {
      console.error('Failed to fetch hero images:', error);
    }
  }

  return imagesForSlides.map((img, index) => {
    let title = `Welcome to ${businessName}`;
    let subtitle = 'Discover our amazing collection of products.';
    if (index === 1) {
      title = 'New Arrivals';
      subtitle = 'Check out the latest trends and styles.';
    } else if (index === 2) {
      title = 'Best Sellers';
      subtitle = 'Shop our most popular items.';
    }
    switch (normalizeBusinessType(businessType)) {
      case 'fashion':
        if (index === 0) subtitle = 'Discover the latest trends in fashion.';
        if (index === 1) subtitle = 'Fresh looks for the season.';
        break;
      case 'electronics':
        if (index === 0)
          subtitle = 'Cutting-edge technology at your fingertips.';
        if (index === 1) subtitle = 'Upgrade your gear today.';
        break;
      case 'food':
        if (index === 0) subtitle = 'Fresh flavors and quality ingredients.';
        if (index === 1) subtitle = 'Fresh ingredients, authentic recipes.';
        break;
      case 'beauty':
        if (index === 0) subtitle = 'Beauty products that bring out your best.';
        if (index === 1) subtitle = 'Clean essentials for your daily glow.';
        break;
      case 'hair':
        if (index === 0) subtitle = 'Premium hair extensions for every style.';
        if (index === 1) subtitle = 'Fresh textures, lengths, and finishes.';
        break;
      case 'home':
        if (index === 0) subtitle = 'Curated pieces for a more beautiful home.';
        if (index === 1) subtitle = 'Fresh finds for every room.';
        break;
      case 'pharmacy':
        if (index === 0)
          subtitle = 'Trusted healthcare essentials and supplies.';
        if (index === 1)
          subtitle = 'Restock wellness products with confidence.';
        break;
      case 'art':
      case 'handmade':
        if (index === 0) subtitle = 'Unique handcrafted pieces made with love.';
        if (index === 1) subtitle = 'Fresh artisan pieces from the maker.';
        if (index === 2) subtitle = 'Customer favorites with a personal touch.';
        break;
    }
    if (aiContent?.[index]) {
      title = aiContent[index].title;
      subtitle = aiContent[index].subtitle;
    }
    return {
      image: img.imageUrl,
      title,
      subtitle,
      ctaText: 'Shop Now',
      ctaLink: '#products',
    };
  });
}
