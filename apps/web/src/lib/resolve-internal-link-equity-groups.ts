import type { InternalLinkEquityGroupConfig } from '@/config/ogabassey-internal-link-equity';

interface ResolvedInternalLinkEquityGroup {
  title: string;
  description: string;
  links: { href: string; label: string }[];
}

/**
 * Merges a group's hardcoded stable links with its product links resolved to
 * canonical paths. Product slugs missing from the lookup (archived, renamed,
 * unpublished) are dropped so the section never links through a redirect or
 * to a dead page.
 */
export function resolveInternalLinkEquityGroups(
  groups: InternalLinkEquityGroupConfig[],
  productPathsBySlug: Record<string, string>
): ResolvedInternalLinkEquityGroup[] {
  return groups.map((group) => ({
    title: group.title,
    description: group.description,
    links: [
      ...group.links,
      ...group.productLinks.flatMap((productLink) => {
        const href = productPathsBySlug[productLink.productSlug];
        return href ? [{ href, label: productLink.label }] : [];
      }),
    ],
  }));
}
