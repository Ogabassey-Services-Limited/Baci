import type { BuilderDegradedReason } from '@/schemas/builder';
import type { BuilderPreviewMode } from './builder-client-types';

export function getDegradedBuilderDescription(
  degradedReason: BuilderDegradedReason | null
) {
  switch (degradedReason) {
    case 'config_load_failed':
      return 'We could not load the latest builder draft from the server. Refresh to resume editing once the connection stabilizes.';
    case 'default_generation_failed':
      return 'We could not generate a safe fallback template for this store. Refresh later before making changes.';
    default:
      return 'This builder session is read-only until the latest draft can be loaded again.';
  }
}

export function getBuilderMutationErrorMessage(
  error: unknown,
  fallback: string
) {
  if (!(error instanceof Error)) return fallback;

  if (error.message === 'Builder draft is out of date') {
    return 'This page changed in another session. Refresh the builder to continue with the latest version.';
  }

  return error.message || fallback;
}

export function getReadOnlyBuilderDescription(
  previewMode: BuilderPreviewMode,
  degradedReason: BuilderDegradedReason | null
) {
  if (previewMode === 'ai_draft') {
    return 'You are previewing an AI-generated storefront draft. Apply it to replace the current starter draft, or return to the dashboard to keep editing manually.';
  }

  return getDegradedBuilderDescription(degradedReason);
}
