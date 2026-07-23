export type FacebookEventName =
  | 'PageView'
  | 'ViewContent'
  | 'Search'
  | 'AddToCart'
  | 'AddToWishlist'
  | 'InitiateCheckout'
  | 'AddPaymentInfo'
  | 'Purchase'
  | 'Lead'
  | 'CompleteRegistration';

export interface FacebookUserData {
  email?: string;
  phone?: string;
  firstName?: string;
  lastName?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  country?: string;
  externalId?: string;
  clientIpAddress?: string;
  clientUserAgent?: string;
  fbc?: string;
  fbp?: string;
}

export interface FacebookCustomData {
  value?: number;
  currency?: string;
  contentName?: string;
  contentCategory?: string;
  contentIds?: string[];
  contentType?: 'product' | 'product_group';
  contents?: Array<{
    id: string;
    quantity: number;
    item_price?: number;
  }>;
  numItems?: number;
  orderId?: string;
  searchString?: string;
  status?: string;
}

export interface FacebookCAPIResponse {
  events_received?: number;
}

export interface FacebookCAPIResult {
  success: boolean;
  response?: FacebookCAPIResponse;
  error?: string;
  httpStatus?: number;
}

export interface FacebookEvent {
  event_name: FacebookEventName;
  event_time: number;
  event_id: string;
  event_source_url?: string;
  action_source:
    | 'website'
    | 'app'
    | 'email'
    | 'phone_call'
    | 'chat'
    | 'physical_store'
    | 'other';
  user_data: Record<string, string | undefined>;
  custom_data?: Record<string, unknown>;
  opt_out?: boolean;
}
