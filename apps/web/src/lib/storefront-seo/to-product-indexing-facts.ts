export function toProductIndexingFacts({
  isStorePublished,
  status,
  name,
  canonicalUrl,
}: {
  isStorePublished: boolean | null | undefined;
  status: string | null | undefined;
  name: string | null | undefined;
  canonicalUrl: string | null | undefined;
}) {
  return {
    isStorePublished,
    isActive: status === 'active',
    name: name?.trim() || null,
    canonicalUrl: canonicalUrl?.trim() || null,
  };
}
