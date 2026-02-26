export interface StorefrontReview {
  id: string;
  product_id: string;
  merchant_id: string;
  order_id?: string | null;
  customer_email: string;
  customer_name?: string | null;
  rating: number;
  title?: string | null;
  body?: string | null;
  status: 'pending' | 'approved' | 'rejected';
  verified_purchase: boolean;
  created_at: string;
  updated_at?: string;
  products?: {
    id: string;
    name: string;
    images?: string[] | null;
  } | null;
}
