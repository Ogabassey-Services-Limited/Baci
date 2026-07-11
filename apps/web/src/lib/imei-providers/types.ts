import type {
  ImeiCheckField,
  ImeiDeviceCategory,
  ImeiServiceTierDefinition,
  ImeiServiceTierKey,
} from '@baci/shared/imei';
import type {
  ImeiLookupErrorBody,
  ImeiLookupSuccessBody,
} from '@/lib/imei-lookup-fulfillment';

export type ImeiProviderName = 'petrock' | 'sickw';

export interface ImeiProductBinding {
  costUsd: number;
  orderFieldName: string;
  productId: string;
  serialCostUsd?: number;
  serialOrderFieldName?: string;
  serialProductId?: string;
}

export interface ImeiProviderBinding extends ImeiProductBinding {
  deviceCategories: readonly ImeiDeviceCategory[];
  fallback?: ImeiProductBinding;
  provider: ImeiProviderName;
}

export interface ResolveImeiProviderBindingInput {
  clientSupportsAsync: boolean;
  deviceCategory?: ImeiDeviceCategory;
  petrockEnabled: boolean;
  petrockEnabledTiers: ReadonlySet<ImeiServiceTierKey>;
  tier: ImeiServiceTierDefinition;
  tierKey: ImeiServiceTierKey;
}

export interface ImeiProviderSubmitRequest {
  binding: ImeiProviderBinding;
  checksIncluded: readonly ImeiCheckField[];
  feedbackUrl: string;
  identifier: string;
  referenceId: string;
  tierName: string;
}

export interface ImeiProviderPollRequest {
  checksIncluded: readonly ImeiCheckField[];
  identifier: string;
  providerOrderId: string;
  tierName: string;
}

export type ImeiProviderOutcome =
  | {
      body: ImeiLookupSuccessBody;
      kind: 'complete';
      providerStatus: string;
      rawResponseText: string;
      status: 200;
    }
  | {
      body: ImeiLookupErrorBody;
      kind: 'failure';
      providerStatus: string;
      rawResponseText?: string;
      refundReason: 'error' | 'not_found';
      status: 404 | 502;
    }
  | {
      kind: 'pending';
      providerOrderId: string;
      providerStatus: string;
    }
  | {
      kind: 'submission_unknown';
      providerStatus: string;
      reason: string;
    };

export interface ImeiProvider {
  isConfigured(): boolean;
  name: ImeiProviderName;
  poll?(request: ImeiProviderPollRequest): Promise<ImeiProviderOutcome>;
  submit(request: ImeiProviderSubmitRequest): Promise<ImeiProviderOutcome>;
}
