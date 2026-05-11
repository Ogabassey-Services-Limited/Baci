export interface AdminMerchantHealthRow {
  merchant_id: string;
  storefront_slug?: string | null;
  business_name: string | null;
  email: string | null;
  joined_at: string;
  total_gmv: number | string;
  total_orders: number;
  last_order_date: string | null;
  active_days: number;
  health_status: 'healthy' | 'at_risk' | 'churned' | 'new';
}

export interface AdminMerchantsResponse {
  data: AdminMerchantHealthRow[];
  generatedAt: string;
}
