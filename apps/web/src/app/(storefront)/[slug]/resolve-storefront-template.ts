import { getTemplateIdByBusinessType } from '@/templates/registry';

/**
 * Resolve the effective storefront template for server rendering.
 * Returns null when the merchant should fall back to the client-only Puck flow.
 */
export function resolveStorefrontTemplateId(
  templateId?: string | null,
  businessType?: string | null
): string | null {
  const resolvedTemplateId =
    templateId && templateId !== 'default'
      ? templateId
      : getTemplateIdByBusinessType(businessType ?? undefined);

  return resolvedTemplateId === 'puck' ? null : resolvedTemplateId;
}
