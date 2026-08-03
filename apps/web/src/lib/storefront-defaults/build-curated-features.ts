export function buildCuratedFeatures(
  features: ReadonlyArray<{
    title: string;
    description: string;
    icon: string;
  }>
) {
  return features.map((feature) => ({ ...feature }));
}
