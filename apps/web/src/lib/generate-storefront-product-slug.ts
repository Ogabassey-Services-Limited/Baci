import { generateStorefrontSlug } from './generate-storefront-slug';

export function generateStorefrontProductSlug(name: string): string {
  const lowerName = name.toLowerCase();
  let cleanName = name;

  if (lowerName.endsWith(' (new)')) cleanName = name.slice(0, -6);
  else if (lowerName.endsWith(' (used)')) cleanName = name.slice(0, -7);
  else if (lowerName.endsWith(' new')) cleanName = name.slice(0, -4);
  else if (lowerName.endsWith(' used')) cleanName = name.slice(0, -5);

  return generateStorefrontSlug(cleanName);
}
