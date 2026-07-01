import type { MyCoverWebhookPayload } from '@/schemas/mycover-webhook';

export type MyCoverPolicyLookup = {
  column: 'mycover_policy_id' | 'mycover_purchase_id';
  value: string;
};

export type MyCoverUpdatedPolicy = {
  id: string;
  order_id?: string | null;
};

export type MyCoverPolicyInspectionState = {
  inspection_link?: string | null;
  inspection_status?: string | null;
};

export type MyCoverWebhookData = MyCoverWebhookPayload['data'];
export type MyCoverWebhookEvent = MyCoverWebhookPayload['event'];
