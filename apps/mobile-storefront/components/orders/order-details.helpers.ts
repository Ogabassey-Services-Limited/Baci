import type { OrderDetails, RawOrderDetails } from './OrderDetailsScreen.types';

export function formatOrderDetailsDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-NG', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function getOrderTrackingUrl(
  trackingNumber?: string,
  shippingProvider?: string
): string | undefined {
  if (!trackingNumber) return undefined;

  const encoded = encodeURIComponent(trackingNumber);
  const providerUrls: Record<string, string> = {
    topship: `https://topship.africa/track/${encoded}`,
    gigl: `https://giglogistics.com/track/${encoded}`,
    dhl: `https://www.dhl.com/en/express/tracking.html?AWB=${encoded}`,
    fedex: `https://www.fedex.com/fedextrack/?trknbr=${encoded}`,
    ups: `https://www.ups.com/track?tracknum=${encoded}`,
  };

  return shippingProvider
    ? providerUrls[shippingProvider.toLowerCase()]
    : undefined;
}

export function mapOrderDetails(data: RawOrderDetails): OrderDetails {
  return {
    ...data,
    items: (data.order_items ?? []).map((item) => {
      const product = Array.isArray(item.products)
        ? item.products[0]
        : item.products;

      return {
        id: item.id,
        product_id: item.product_id,
        product_name: item.name,
        product_slug: product?.slug ?? '',
        quantity: item.quantity,
        price: item.price,
        condition: item.condition,
        variant_name: item.variant_name,
        image_url: product?.images?.[0],
        has_assurance: item.has_assurance,
        assurance_fee: item.assurance_fee,
      };
    }),
  };
}
