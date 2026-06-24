export interface OrderDetailsInsurancePolicy {
  certificate_url: string | null;
  claim_comment: string | null;
  claim_link: string | null;
  claim_stage: string | null;
  claim_status: string | null;
  coverage_amount: number;
  inspection_link: string | null;
  inspection_status: string | null;
  mycover_policy_number: string | null;
  policy_expiry_date: string | null;
  policy_start_date: string | null;
  policy_type: string | null;
  premium_amount: number;
  provider_name: string | null;
  status: string;
}

export interface OrderDetailsInsuranceCardColors {
  card: string;
  text: string;
  textSecondary: string;
}
