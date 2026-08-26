import { apiPost } from '@/lib/api-client';

interface ShippingQuoteItem {
  name: string;
  quantity: number;
  weight: number;
  value: number;
}

interface ShippingOptionsQuoteRequest {
  merchantId: string;
  receiverCity: string;
  receiverState: string;
  receiverAddress: string;
  receiverPhone: string;
  receiverName: string;
  quoteItems: ShippingQuoteItem[];
}

export function requestShippingOptions({
  merchantId,
  receiverCity,
  receiverState,
  receiverAddress,
  receiverPhone,
  receiverName,
  quoteItems,
}: ShippingOptionsQuoteRequest): Promise<unknown> {
  return apiPost<unknown>(
    '/api/shipping/quotes',
    {
      merchantId,
      receiver: {
        name: receiverName || 'Customer',
        phone: receiverPhone || '',
        address: receiverAddress || receiverCity,
        city: receiverCity,
        state: receiverState,
        // This preview path is gated to Nigerian customers upstream.
        country: 'Nigeria',
        countryCode: 'NG',
      },
      items: quoteItems,
      shipmentType: 'domestic',
      // Lets free-over / price-tier merchant rates quote at their real price.
      cart_subtotal: quoteItems.reduce(
        (sum, item) => sum + item.value * item.quantity,
        0
      ),
    },
    {
      headers: { 'x-baci-client': 'web-storefront' },
    }
  );
}
