export type DiscountType = 'percentage' | 'fixed_amount';
export type DiscountApplyType =
  | 'all'
  | 'specific_products'
  | 'specific_categories';

export interface DiscountCode {
  id: string;
  merchant_id: string;
  code: string;
  discount_type: DiscountType;
  discount_value: number;
  minimum_purchase_amount?: number | null;
  maximum_discount_amount?: number | null;
  starts_at?: string | null;
  expires_at?: string | null;
  usage_limit?: number | null;
  usage_count: number;
  usage_limit_per_customer?: number | null;
  is_active: boolean;
  applies_to?: DiscountApplyType | null;
  product_ids?: string[] | null;
  category_ids?: string[] | null;
  customer_ids?: string[] | null;
  customer_eligibility?: 'all' | 'specific_customers' | 'specific_groups';
  description?: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateDiscountDTO {
  code: string;
  discount_type: DiscountType;
  discount_value: number;
  minimum_purchase_amount?: number | null;
  maximum_discount_amount?: number | null;
  starts_at?: string | null;
  expires_at?: string | null;
  usage_limit?: number | null;
  usage_limit_per_customer?: number | null;
  is_active?: boolean;
  applies_to?: DiscountApplyType;
  product_ids?: string[];
  category_ids?: string[];
  customer_ids?: string[];
  customer_eligibility?: 'all' | 'specific_customers' | 'specific_groups';
  description?: string;
}

export interface UpdateDiscountDTO extends Partial<CreateDiscountDTO> {
  id: string;
}
