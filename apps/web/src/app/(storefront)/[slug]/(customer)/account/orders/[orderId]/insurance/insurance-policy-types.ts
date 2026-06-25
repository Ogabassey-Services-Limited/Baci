export interface PolicyItemsInsured {
  imei?: string | null;
  product_id?: string | null;
  product_name?: string | null;
  [key: string]: unknown;
}

export interface Policy {
  id: string;
  policyNumber: string;
  provider: string;
  status: 'active' | 'expired' | 'pending';
  startDate: string;
  expiryDate: string;
  premium: number;
  coverage: number;
  itemsInsured: PolicyItemsInsured | null;
  claimStatus: string;
  claimStage?: string | null;
  claimProgress?: string | null;
  claimComment?: string | null;
  certificateUrl?: string;
  claimLink?: string | null;
  inspectionLink?: string | null;
  inspectionStatus?: string | null;
  orderDelivered?: boolean;
  customer_email?: string;
}

export interface PolicyFetchResult {
  policy: Policy | null;
  error: string;
}
