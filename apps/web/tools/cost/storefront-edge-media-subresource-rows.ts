import type { StorefrontEdgeInventory } from './storefront-edge-inventory-types';

type InventoryRow = StorefrontEdgeInventory['rows'][number];

type MediaDestinationHostKind =
  | 'configured_media_cdn_origin'
  | 'configured_external_media_origin'
  | 'configured_google_tag_manager_origin'
  | 'configured_google_analytics_collection_origin'
  | 'configured_google_ad_manager_origin'
  | 'configured_google_store_widget_origin'
  | 'configured_google_store_badge_origin'
  | 'configured_google_customer_reviews_origin'
  | 'configured_supabase_storage_upload_origin'
  | 'configured_klump_origin'
  | 'configured_korapay_origin'
  | 'configured_paystack_asset_origin'
  | 'configured_paystack_checkout_origin'
  | 'configured_juicyway_origin'
  | 'configured_credpal_origin'
  | 'configured_credit_direct_origin'
  | 'configured_meta_origin'
  | 'configured_tiktok_origin'
  | 'configured_snapchat_origin'
  | 'configured_twitter_origin'
  | 'configured_whatsapp_origin'
  | 'configured_google_maps_origin'
  | 'configured_mycover_flow_origin'
  | 'configured_mycover_certificate_origin'
  | 'configured_carrier_tracking_origin'
  | 'configured_merchant_social_origin'
  | 'configured_app_store_origin'
  | 'configured_play_store_origin'
  | 'configured_supabase_storage_origin';

const mediaSubresource = (
  id: string,
  hostKind: MediaDestinationHostKind,
  sourcePath = 'apps/web/src/components/storefront/cdn-format-image.tsx',
  methods: readonly InventoryRow['methods'][number][] = ['GET', 'HEAD']
): InventoryRow => ({
  decision: 'origin_dynamic',
  destinationCondition: {
    hostKind,
    precedence: 'before_path_decision',
  },
  id: `automatic-subresource:${id}`,
  methods,
  reason: 'browser_external_media_request',
  routePattern: '/{*externalMediaPath?}',
  sourceKind: 'automatic_subresource',
  sourcePath,
});

/** External image destinations emitted by released storefront components. */
export const STOREFRONT_EDGE_MEDIA_SUBRESOURCE_ROWS: readonly InventoryRow[] = [
  mediaSubresource('media-cdn', 'configured_media_cdn_origin'),
  mediaSubresource('supabase-storage', 'configured_supabase_storage_origin'),
  mediaSubresource(
    'transparent-textures-about',
    'configured_external_media_origin',
    'apps/web/src/components/storefront/ogabassey/pages/about-us.tsx'
  ),
  mediaSubresource(
    'transparent-textures-privacy',
    'configured_external_media_origin',
    'apps/web/src/components/storefront/ogabassey/pages/privacy-policy.tsx'
  ),
  mediaSubresource(
    'transparent-textures-legal',
    'configured_external_media_origin',
    'apps/web/src/components/storefront/ogabassey/pages/legal-dispute.tsx'
  ),
  mediaSubresource(
    'transparent-textures-sustainability-leaf',
    'configured_external_media_origin',
    'apps/web/src/components/storefront/ogabassey/pages/sustainability.tsx'
  ),
  mediaSubresource(
    'transparent-textures-sustainability-wood',
    'configured_external_media_origin',
    'apps/web/src/components/storefront/ogabassey/pages/sustainability.tsx'
  ),
  mediaSubresource(
    'crypto-qr',
    'configured_external_media_origin',
    'apps/web/src/components/storefront/ogabassey/pages/crypto-checkout.tsx'
  ),
  mediaSubresource(
    'product-video-youtube',
    'configured_external_media_origin',
    'apps/web/src/components/storefront/ogabassey/components/ProductVideo.tsx'
  ),
  mediaSubresource(
    'about-page-youtube',
    'configured_external_media_origin',
    'apps/web/src/app/(storefront)/[slug]/(content)/pages/about/about-page-client.tsx'
  ),
  mediaSubresource(
    'about-page-vimeo',
    'configured_external_media_origin',
    'apps/web/src/app/(storefront)/[slug]/(content)/pages/about/about-page-client.tsx'
  ),
  mediaSubresource(
    'gadget-universe-hero',
    'configured_external_media_origin',
    'apps/web/src/components/storefront/templates/gadget-universe.tsx'
  ),
  mediaSubresource(
    'gadget-default-template-hero',
    'configured_external_media_origin',
    'apps/web/src/components/storefront/templates/gadget-default-template.tsx'
  ),
  mediaSubresource(
    'google-tag-manager',
    'configured_google_tag_manager_origin',
    'apps/web/src/components/analytics/analytics-pixel-provider.tsx'
  ),
  mediaSubresource(
    'google-analytics-collection',
    'configured_google_analytics_collection_origin',
    'apps/web/src/components/analytics/google-analytics.tsx',
    ['GET', 'HEAD', 'POST']
  ),
  mediaSubresource(
    'google-ad-manager',
    'configured_google_ad_manager_origin',
    'apps/web/src/components/storefront/ogabassey/components/google-ad-bootstrap.ts'
  ),
  mediaSubresource(
    'google-store-widget',
    'configured_google_store_widget_origin',
    'apps/web/src/components/analytics/google-store-widget.tsx'
  ),
  mediaSubresource(
    'google-store-badge',
    'configured_google_store_badge_origin',
    'apps/web/src/components/analytics/google-store-widget.tsx'
  ),
  mediaSubresource(
    'google-customer-reviews',
    'configured_google_customer_reviews_origin',
    'apps/web/src/components/analytics/google-customer-reviews.tsx'
  ),
  mediaSubresource(
    'negotiation-evidence-upload',
    'configured_supabase_storage_upload_origin',
    'apps/web/src/components/storefront/ogabassey/components/negotiation-evidence.ts',
    ['PUT', 'OPTIONS']
  ),
  mediaSubresource(
    'new-template-checkout-mastercard',
    'configured_external_media_origin',
    'apps/web/src/components/storefront/new-template/checkout-page.tsx'
  ),
  mediaSubresource(
    'new-template-footer-noise',
    'configured_external_media_origin',
    'apps/web/src/components/storefront/new-template/footer.tsx'
  ),
  mediaSubresource(
    'klump',
    'configured_klump_origin',
    'apps/web/src/components/storefront/ogabassey/pages/bnpl-launcher.tsx'
  ),
  mediaSubresource(
    'checkout-payment-paystack',
    'configured_paystack_asset_origin',
    'apps/web/src/components/storefront/ogabassey/components/PaymentLogos.tsx'
  ),
  mediaSubresource(
    'checkout-payment-korapay',
    'configured_korapay_origin',
    'apps/web/src/components/storefront/ogabassey/components/PaymentLogos.tsx'
  ),
  mediaSubresource(
    'checkout-payment-credpal',
    'configured_credpal_origin',
    'apps/web/src/components/storefront/ogabassey/components/PaymentLogos.tsx'
  ),
  mediaSubresource(
    'checkout-payment-credit-direct',
    'configured_credit_direct_origin',
    'apps/web/src/components/storefront/ogabassey/components/PaymentLogos.tsx'
  ),
  mediaSubresource(
    'checkout-payment-juicyway',
    'configured_juicyway_origin',
    'apps/web/src/components/storefront/ogabassey/components/PaymentLogos.tsx'
  ),
  mediaSubresource(
    'utility-checkout-paystack-navigation',
    'configured_paystack_checkout_origin',
    'apps/web/src/components/storefront/ogabassey/components/utility-checkout.ts'
  ),
  mediaSubresource(
    'credpal',
    'configured_credpal_origin',
    'apps/web/src/components/storefront/ogabassey/pages/bnpl-launcher.tsx'
  ),
  mediaSubresource(
    'credit-direct',
    'configured_credit_direct_origin',
    'apps/web/src/components/storefront/ogabassey/pages/bnpl-launcher.tsx'
  ),
  mediaSubresource(
    'meta',
    'configured_meta_origin',
    'apps/web/src/components/analytics/facebook-pixel.tsx'
  ),
  mediaSubresource(
    'tiktok',
    'configured_tiktok_origin',
    'apps/web/src/components/analytics/analytics-pixel-provider.tsx'
  ),
  mediaSubresource(
    'snapchat',
    'configured_snapchat_origin',
    'apps/web/src/components/analytics/snapchat-pixel.tsx'
  ),
  mediaSubresource(
    'twitter',
    'configured_twitter_origin',
    'apps/web/src/components/analytics/twitter-pixel.tsx'
  ),
  mediaSubresource(
    'device-swap-whatsapp-navigation',
    'configured_whatsapp_origin',
    'apps/web/src/components/storefront/ogabassey/pages/swap.tsx'
  ),
  mediaSubresource(
    'footer-google-maps-navigation',
    'configured_google_maps_origin',
    'apps/web/src/components/storefront/ogabassey/components/Footer.tsx'
  ),
  mediaSubresource(
    'help-google-maps-navigation',
    'configured_google_maps_origin',
    'apps/web/src/components/storefront/ogabassey/pages/help-support.tsx'
  ),
  mediaSubresource(
    'blog-share-twitter-blog-post-body',
    'configured_twitter_origin',
    'apps/web/src/app/(storefront)/[slug]/(blog)/blog/[postSlug]/blog-post-body.tsx'
  ),
  mediaSubresource(
    'blog-share-meta-blog-post-body',
    'configured_meta_origin',
    'apps/web/src/app/(storefront)/[slug]/(blog)/blog/[postSlug]/blog-post-body.tsx'
  ),
  mediaSubresource(
    'blog-share-linkedin-blog-post-body',
    'configured_external_media_origin',
    'apps/web/src/app/(storefront)/[slug]/(blog)/blog/[postSlug]/blog-post-body.tsx'
  ),
  mediaSubresource(
    'blog-share-twitter-blog-post-body-alt',
    'configured_twitter_origin',
    'apps/web/src/app/(storefront)/[slug]/(blog)/blog/[postSlug]/BlogPostBody.tsx'
  ),
  mediaSubresource(
    'blog-share-meta-blog-post-body-alt',
    'configured_meta_origin',
    'apps/web/src/app/(storefront)/[slug]/(blog)/blog/[postSlug]/BlogPostBody.tsx'
  ),
  mediaSubresource(
    'blog-share-linkedin-blog-post-body-alt',
    'configured_external_media_origin',
    'apps/web/src/app/(storefront)/[slug]/(blog)/blog/[postSlug]/BlogPostBody.tsx'
  ),
  mediaSubresource(
    'blog-video-panel-youtube-thumbnail',
    'configured_external_media_origin',
    'apps/web/src/app/(storefront)/[slug]/(blog)/blog/[postSlug]/BlogVideoPanel.tsx'
  ),
  mediaSubresource(
    'blog-video-panel-youtube-navigation',
    'configured_external_media_origin',
    'apps/web/src/app/(storefront)/[slug]/(blog)/blog/[postSlug]/BlogVideoPanel.tsx'
  ),
  mediaSubresource(
    'chat-markdown-image',
    'configured_external_media_origin',
    'apps/web/src/components/storefront/ogabassey/components/chat/markdown-renderer.tsx'
  ),
  mediaSubresource(
    'chat-markdown-link-navigation',
    'configured_external_media_origin',
    'apps/web/src/components/storefront/ogabassey/components/chat/markdown-renderer.tsx'
  ),
  mediaSubresource(
    'track-order-carrier-navigation',
    'configured_carrier_tracking_origin',
    'apps/web/src/app/(storefront)/[slug]/(commerce)/track-order/page.tsx'
  ),
  mediaSubresource(
    'mycover-flow-client-navigation',
    'configured_mycover_flow_origin',
    'apps/web/src/app/(storefront)/[slug]/(customer)/account/orders/[orderId]/insurance/insurance-policy-client.tsx'
  ),
  mediaSubresource(
    'mycover-flow-footer-navigation',
    'configured_mycover_flow_origin',
    'apps/web/src/app/(storefront)/[slug]/(customer)/account/orders/[orderId]/insurance/insurance-policy-footer-actions.tsx'
  ),
  mediaSubresource(
    'mycover-certificate-client-navigation',
    'configured_mycover_certificate_origin',
    'apps/web/src/app/(storefront)/[slug]/(customer)/account/orders/[orderId]/insurance/insurance-policy-client.tsx'
  ),
  mediaSubresource(
    'mycover-certificate-footer-navigation',
    'configured_mycover_certificate_origin',
    'apps/web/src/app/(storefront)/[slug]/(customer)/account/orders/[orderId]/insurance/insurance-policy-footer-actions.tsx'
  ),
  mediaSubresource(
    'post-purchase-google-review-order-success',
    'configured_google_maps_origin',
    'apps/web/src/components/storefront/ogabassey/pages/order-success-page.tsx'
  ),
  mediaSubresource(
    'post-purchase-google-review-checkout-success',
    'configured_google_maps_origin',
    'apps/web/src/app/(storefront)/[slug]/(commerce)/checkout/success/page.tsx'
  ),
  mediaSubresource(
    'post-purchase-google-review-commerce-order-success',
    'configured_google_maps_origin',
    'apps/web/src/app/(storefront)/[slug]/(commerce)/order-success/page.tsx'
  ),
  mediaSubresource(
    'post-purchase-google-review-customer-order',
    'configured_google_maps_origin',
    'apps/web/src/app/(storefront)/[slug]/(customer)/account/orders/[orderId]/customer-order-actions.tsx'
  ),
  mediaSubresource(
    'footer-merchant-social-navigation',
    'configured_merchant_social_origin',
    'apps/web/src/components/storefront/ogabassey/components/Footer.tsx'
  ),
  mediaSubresource(
    'footer-app-store-navigation',
    'configured_app_store_origin',
    'apps/web/src/components/storefront/ogabassey/components/FooterAppPayments.tsx'
  ),
  mediaSubresource(
    'footer-play-store-navigation',
    'configured_play_store_origin',
    'apps/web/src/components/storefront/ogabassey/components/FooterAppPayments.tsx'
  ),
];
