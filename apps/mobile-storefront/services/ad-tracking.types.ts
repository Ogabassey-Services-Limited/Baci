export interface AdTrackingUserProperties {
  email?: string;
  phone?: string;
  firstName?: string;
  lastName?: string;
}

export interface ConversionItem {
  id: string;
  quantity: number;
  name?: string;
  price?: number;
}

export interface ConversionData {
  userId?: string;
  email?: string;
  phone?: string;
  orderId?: string;
  value?: number;
  currency?: string;
  items?: ConversionItem[];
  contentName?: string;
  contentType?: string;
  price?: number;
  searchString?: string;
  url?: string;
}

export interface TrackedProduct {
  id: string;
  name: string;
  price: number;
  currency?: string;
  category?: string;
  brand?: string;
  description?: string;
}

export interface TrackedCartProduct {
  id: string;
  name: string;
  price: number;
  quantity: number;
  currency?: string;
  category?: string;
  brand?: string;
}

export interface TrackedCheckout {
  itemCount: number;
  subtotal: number;
  currency?: string;
  items?: TrackedCartProduct[];
}

export interface TrackedOrder {
  orderId: string;
  orderNumber: string;
  total: number;
  subtotal: number;
  shipping?: number;
  tax?: number;
  currency?: string;
  items: TrackedCartProduct[];
  paymentMethod?: string;
  couponCode?: string;
  email?: string;
  phone?: string;
  userId?: string;
}

export interface TrackedWishlistProduct {
  id: string;
  name: string;
  price?: number;
  currency?: string;
  category?: string;
  brand?: string;
}
