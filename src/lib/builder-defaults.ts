import { Data } from '@measured/puck';
import { PlaceHolderImages } from '@/lib/placeholder-images';

/**
 * Generate default Puck config from merchant's existing template
 */
export function generateDefaultConfig(merchant: any): Data {
    const businessName = merchant?.business_name || 'Your Store';
    const businessType = merchant?.business_type || 'other';

    // Prepare carousel slides using placeholder images
    const slides = PlaceHolderImages.slice(0, 3).map((img, i) => {
        let title = `Welcome to ${businessName}`;
        let subtitle = 'Discover our amazing collection of products.';

        if (i === 1) {
            title = 'New Arrivals';
            subtitle = 'Check out the latest trends and styles.';
        } else if (i === 2) {
            title = 'Best Sellers';
            subtitle = 'Shop our most popular items.';
        }

        // Customize text based on business type
        switch (businessType) {
            case 'fashion':
            case 'fashion_apparel':
                if (i === 0) subtitle = 'Discover the latest trends in fashion.';
                if (i === 1) subtitle = 'Fresh looks for the season.';
                break;
            case 'electronics':
            case 'tech':
                if (i === 0) subtitle = 'Cutting-edge technology at your fingertips.';
                if (i === 1) subtitle = 'Upgrade your gear today.';
                break;
            case 'food':
            case 'restaurant':
                if (i === 0) subtitle = 'Delicious food delivered to your door.';
                if (i === 1) subtitle = 'Fresh ingredients, authentic recipes.';
                break;
            case 'beauty':
            case 'cosmetics':
                if (i === 0) subtitle = 'Beauty products that bring out your best.';
                break;
            case 'art':
            case 'handmade':
                if (i === 0) subtitle = 'Unique handcrafted pieces made with love.';
                break;
        }

        return {
            image: img.imageUrl,
            title,
            subtitle,
            ctaText: 'Shop Now',
            ctaLink: '#products'
        };
    });

    // Base config structure matching the default storefront layout
    const config: Data = {
        content: [
            // Header (Global)
            {
                type: 'Header',
                props: {
                    id: 'header-1'
                }
            },
            // Hero Carousel
            {
                type: 'HeroCarousel',
                props: {
                    id: 'hero-carousel-1',
                    slides: slides
                }
            },
            // Product Grid
            {
                type: 'ProductGrid',
                props: {
                    id: 'product-grid-1',
                    title: 'Featured Products',
                    columns: 4,
                    limit: 8
                }
            },
            // About Section
            {
                type: 'Text',
                props: {
                    id: 'about-text-1',
                    title: `About ${businessName}`,
                    content: `We are dedicated to providing the best products and service to our customers. Explore our store to find exactly what you need.`,
                    align: 'center'
                }
            },
            // Newsletter
            {
                type: 'Newsletter',
                props: {
                    id: 'newsletter-1',
                    title: 'Stay Updated',
                    description: 'Subscribe to our newsletter for the latest news and exclusive offers.',
                    buttonText: 'Subscribe'
                }
            },
            // Footer (Global)
            {
                type: 'Footer',
                props: {
                    id: 'footer-1'
                }
            }
        ],
        root: {
            props: {
                title: 'Home'
            }
        },
        zones: {}
    };

    return config;
}
