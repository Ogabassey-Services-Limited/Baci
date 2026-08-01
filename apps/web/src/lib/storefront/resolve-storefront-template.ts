import { getTemplateIdByBusinessType } from '@/templates/registry';

/**
 * Resolves the server-rendered storefront template. A null result means the
 * client-only Puck storefront is the active homepage source.
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
