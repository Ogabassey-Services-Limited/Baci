const GENERIC_BUSINESS_NAME_TOKENS = new Set([
  'co',
  'company',
  'enterprise',
  'enterprises',
  'inc',
  'limited',
  'ltd',
  'ng',
  'nigeria',
  'official',
  'shop',
  'store',
  'technologies',
  'technology',
]);

function compactIdentity(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function merchantIdentityCandidates(businessName: string): string[] {
  const words = businessName
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(
      (word) => word.length >= 4 && !GENERIC_BUSINESS_NAME_TOKENS.has(word)
    );
  const fullIdentity = compactIdentity(businessName);
  return [
    ...new Set([fullIdentity, ...words].filter((value) => value.length >= 4)),
  ];
}

function profileIdentity(urlValue: string): string | null {
  try {
    const url = new URL(urlValue);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') {
      return null;
    }
    return compactIdentity(decodeURIComponent(url.pathname));
  } catch {
    return null;
  }
}

export function filterBrandMatchedSocialProfiles(
  businessName: string,
  urls: Iterable<string>
): string[] {
  const brandIdentities = merchantIdentityCandidates(businessName);
  if (brandIdentities.length === 0) {
    return [];
  }

  const accepted = new Set<string>();
  for (const value of urls) {
    const normalized = value.trim();
    const identity = profileIdentity(normalized);
    if (
      identity &&
      brandIdentities.some((brandIdentity) => identity.includes(brandIdentity))
    ) {
      accepted.add(normalized);
    }
  }
  return [...accepted];
}
