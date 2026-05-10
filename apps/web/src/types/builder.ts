import type {
  BuilderConfigInput,
  BuilderDegradedReason,
} from '@/schemas/builder';

export type ISODateString = string;
export type PreviewMode = 'ai_draft' | null;

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
  /** Preview source for read-only builder loads; `null` means the regular draft. */
  previewMode: PreviewMode;
  /** Async AI storefront job id when previewing a generated draft. */
  aiDraftJobId: string | null;
  /** True when the caller has builder edit access and may apply the AI draft. */
  canApplyAiDraft: boolean;
}

// `apiPost` / `apiPut` throw on non-OK responses, so the client only models the success payload here.
export interface BuilderMutationResponse {
  success: true;
  lastUpdated: ISODateString | null;
  data?: Record<string, unknown>;
}
