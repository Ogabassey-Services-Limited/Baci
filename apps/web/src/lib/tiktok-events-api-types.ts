export type TikTokEventName =
  | 'ViewContent'
  | 'AddToCart'
  | 'InitiateCheckout'
  | 'Purchase'
  | 'PlaceAnOrder'
  | 'Search'
  | 'AddPaymentInfo'
  | 'AddToWishlist'
  | 'CompleteRegistration';

export interface TikTokUserData {
  email?: string;
  phone?: string;
  externalId?: string;
  ipAddress?: string;
  ttclid?: string;
  userAgent?: string;
  ttp?: string;
}

export interface TikTokEventProperties {
  value?: number;
  currency?: string;
  contentId?: string;
  contentIds?: string[];
  contentName?: string;
  contentType?: 'product' | 'product_group';
  price?: number;
  contents?: Array<{
    content_id: string;
    price?: number;
    quantity?: number;
    content_name?: string;
  }>;
  query?: string;
  searchString?: string;
  orderId?: string;
  url?: string;
}

export interface TikTokEventOptions {
  eventId?: string;
  eventTime?: Date | number | string;
  testEventCode?: string;
  url?: string;
}

export interface TikTokEventResult {
  success: boolean;
  error?: string;
  httpStatus?: number;
}
