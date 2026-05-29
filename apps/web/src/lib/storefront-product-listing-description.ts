type StorefrontProductListingDescriptionInput = {
  brand?: string | null;
  category?: string | null;
  description?: string | null;
  name?: string | null;
};

function cleanText(value: string | null | undefined) {
  return typeof value === 'string' ? value.trim() : '';
}

export function buildStorefrontProductListingDescription({
  brand,
  category,
  description,
  name,
}: StorefrontProductListingDescriptionInput) {
  const explicitDescription = cleanText(description);
  if (explicitDescription) {
    return explicitDescription;
  }

  const cleanBrand = cleanText(brand);
  const cleanCategory = cleanText(category);
  if (cleanBrand && cleanCategory) {
    return `${cleanBrand} ${cleanCategory}`;
  }

  return cleanCategory || cleanBrand || cleanText(name);
}
