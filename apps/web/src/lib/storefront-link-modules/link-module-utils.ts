import type {
  StorefrontLinkModule,
  StorefrontLinkModuleItem,
} from './link-module-types';

export function validateInternalModuleHref(href: string) {
  if (!href.startsWith('/') || href.startsWith('//')) {
    throw new Error("Storefront link module href must start with '/'");
  }

  return href;
}

export function dedupeLinkModuleItems<T extends StorefrontLinkModuleItem>(
  items: T[]
) {
  const seenHrefs = new Set<string>();
  const dedupedItems: T[] = [];

  for (const item of items) {
    validateInternalModuleHref(item.href);

    if (seenHrefs.has(item.href)) {
      continue;
    }

    seenHrefs.add(item.href);
    dedupedItems.push(item);
  }

  return dedupedItems;
}

export function capLinkModuleItems<T extends StorefrontLinkModuleItem>(
  items: T[],
  maxItems: number
) {
  return dedupeLinkModuleItems(items).slice(0, Math.max(0, maxItems));
}

export function pruneEmptyLinkModules<T extends StorefrontLinkModule>(
  modules: T[]
) {
  return modules.filter((module) => module.items.length > 0);
}
