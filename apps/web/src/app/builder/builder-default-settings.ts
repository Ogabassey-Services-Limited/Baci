import type { SetupSettings } from '@/components/builder/setup-panel';
import type { StoreSettings } from '@/components/builder/store-settings-panel';

export function createDefaultBuilderSettings(): {
  storeSettings: StoreSettings;
  setupSettings: SetupSettings;
} {
  return {
    storeSettings: {
      productPage: {
        layout: 'standard',
        showRelatedProducts: true,
        showReviews: true,
        showShareButtons: true,
        imageGalleryStyle: 'thumbnails',
        enableZoom: true,
        showInventory: true,
      },
      cart: {
        enableCartDrawer: true,
        showShippingEstimate: true,
        showProgressBar: false,
        enableGiftMessage: false,
        enableDiscountCodes: true,
      },
      checkout: {
        enableGuestCheckout: true,
        requirePhoneNumber: false,
        showOrderNotes: true,
        showNewsletterSignup: true,
        enableExpressCheckout: true,
      },
      shipping: {
        showEstimatedDelivery: true,
        defaultShippingMessage: 'Free shipping on orders over $50',
        internationalShipping: false,
      },
      policies: {
        returnPolicy: '',
        shippingPolicy: '',
        privacyPolicy: '',
      },
    },
    setupSettings: {
      site: {
        title: 'My Store',
        tagline: 'Premium products at affordable prices',
        currency: 'USD',
        timezone: 'America/New_York',
        language: 'en',
        units: 'imperial',
      },
      social: {},
      analytics: {},
      customCode: {},
    },
  };
}
