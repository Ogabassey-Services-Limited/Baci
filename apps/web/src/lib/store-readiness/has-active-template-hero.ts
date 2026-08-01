import { resolveStorefrontTemplateId } from '@/lib/storefront/resolve-storefront-template';
import { getTemplate } from '@/templates/registry';

/**
 * Registered templates render their own homepage hero. Puck configuration is
 * only the active homepage source when template resolution falls back to Puck.
 */
export function hasActiveTemplateHero(
  templateId: string | null,
  businessType: string | null
): boolean {
  const resolvedTemplateId = resolveStorefrontTemplateId(
    templateId,
    businessType
  );

  return (
    resolvedTemplateId !== null && getTemplate(resolvedTemplateId) !== undefined
  );
}
