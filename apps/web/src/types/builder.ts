import type {
  BuilderConfigInput,
  BuilderDegradedReason,
} from '@/schemas/builder';

export type ISODateString = string;

export interface BuilderLoadResponse {
  config: BuilderConfigInput;
  seo: unknown | null;
  storeSettings: unknown | null;
  setupSettings: unknown | null;
  publishedConfig: BuilderConfigInput | null;
  isPublished: boolean;
  isDefault: boolean;
  /** ISO 8601 timestamp from `page_configs.updated_at`, or `null` for new drafts. */
  lastUpdated: ISODateString | null;
  degraded: boolean;
  degradedReason: BuilderDegradedReason | null;
  canEdit: boolean;
}

// `apiPost` / `apiPut` throw on non-OK responses, so the client only models the success payload here.
export interface BuilderMutationResponse {
  success: true;
  lastUpdated: ISODateString | null;
  data?: Record<string, unknown>;
}
