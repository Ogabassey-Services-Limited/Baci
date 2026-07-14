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
    .filter(Boolean);
  const fullIdentity = compactIdentity(businessName);
  const coreIdentity = words
    .filter((word) => !GENERIC_BUSINESS_NAME_TOKENS.has(word))
    .join('');
  return [
    ...new Set(
      [fullIdentity, coreIdentity].filter((value) => value.length >= 3)
    ),
  ];
}

function profileIdentity(urlValue: string): string | null {
  try {
    const url = new URL(urlValue);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') {
      return null;
    }
    const pathSegments = url.pathname.split('/').filter(Boolean);
    const profileSegment = pathSegments.at(-1);
    return profileSegment
      ? compactIdentity(decodeURIComponent(profileSegment))
      : null;
  } catch {
    return null;
  }
}

const PROFILE_IDENTITY_AFFIXES = ['ng', 'nigeria', 'official'] as const;

function profileMatchesBrandIdentity(
  profile: string,
  brandIdentity: string
): boolean {
  if (profile === brandIdentity) {
    return true;
  }

  if (brandIdentity.length >= 5 && profile.startsWith(brandIdentity)) {
    const suffix = profile.slice(brandIdentity.length);
    const finalBrandCharacter = brandIdentity.at(-1);
    if (
      suffix.length <= 2 &&
      finalBrandCharacter &&
      [...suffix].every((character) => character === finalBrandCharacter)
    ) {
      return true;
    }
  }

  return PROFILE_IDENTITY_AFFIXES.some(
    (affix) =>
      profile === `${brandIdentity}${affix}` ||
      profile === `${affix}${brandIdentity}`
  );
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
      brandIdentities.some((brandIdentity) =>
        profileMatchesBrandIdentity(identity, brandIdentity)
      )
    ) {
      accepted.add(normalized);
    }
  }
  return [...accepted];
}
