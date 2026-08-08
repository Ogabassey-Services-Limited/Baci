import {
  type BuilderData,
  builderAiEditContract,
  validateBuilderAiEditComplexity,
} from '@baci/shared/contracts';
import { hasDuplicateBuilderAiComponentIds } from './get-builder-ai-content-collections';
import { getBuilderComponentId } from './get-builder-component-id';

interface ProtectedAnchor {
  collection: number;
  id: string | undefined;
  type: 'Footer' | 'Header';
}

function isBuilderComponent(
  value: unknown
): value is BuilderData['content'][number] {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    typeof (value as { type?: unknown }).type === 'string' &&
    typeof (value as { props?: unknown }).props === 'object' &&
    (value as { props?: unknown }).props !== null &&
    !Array.isArray((value as { props?: unknown }).props)
  );
}

function isBuilderComponentList(
  value: unknown
): value is BuilderData['content'] {
  return Array.isArray(value) && value.every(isBuilderComponent);
}

export interface BuilderAiStructuralBaseline {
  componentAnchorRegions: Map<string, string>;
  footers: number;
  headers: number;
  protectedAnchors: ProtectedAnchor[];
  requiresProductGrid: boolean;
}

function contentCollections(
  config: BuilderData | BuilderData['content']
): BuilderData['content'][] {
  if (Array.isArray(config)) return [config];
  return [
    config.content,
    ...Object.values(config.zones ?? {}).filter(isBuilderComponentList),
  ];
}

function getProtectedAnchorSnapshot(content: BuilderData['content'][]): {
  componentAnchorRegions: Map<string, string>;
  protectedAnchors: ProtectedAnchor[];
} {
  const componentAnchorRegions = new Map<string, string>();
  const protectedAnchors: ProtectedAnchor[] = [];
  for (const [collection, components] of content.entries()) {
    let region = 0;
    for (const component of components) {
      if (component.type === 'Footer' || component.type === 'Header') {
        protectedAnchors.push({
          collection,
          id: getBuilderComponentId(component),
          type: component.type,
        });
        region += 1;
        continue;
      }
      const id = getBuilderComponentId(component);
      if (id) componentAnchorRegions.set(id, `${collection}:${region}`);
    }
  }

  return { componentAnchorRegions, protectedAnchors };
}

function hasSameProtectedAnchors(
  current: ProtectedAnchor[],
  baseline: ProtectedAnchor[]
): boolean {
  return (
    current.length === baseline.length &&
    current.every(
      (anchor, index) =>
        anchor.id === baseline[index]?.id &&
        anchor.collection === baseline[index]?.collection &&
        anchor.type === baseline[index]?.type
    )
  );
}

export function getBuilderAiStructuralBaseline(
  config: BuilderData | BuilderData['content']
): BuilderAiStructuralBaseline {
  const collections = contentCollections(config);
  const anchors = getProtectedAnchorSnapshot(collections);
  return {
    ...anchors,
    footers: collections
      .flat()
      .filter((component) => component.type === 'Footer').length,
    headers: collections
      .flat()
      .filter((component) => component.type === 'Header').length,
    requiresProductGrid: collections
      .flat()
      .some((component) => component.type === 'ProductGrid'),
  };
}

export function getBuilderAiStructuralFailure(
  config: BuilderData | BuilderData['content'],
  baseline: BuilderAiStructuralBaseline,
  enforceRequiredProductGrid = true
): string | undefined {
  const collections = contentCollections(config);
  const count = (type: string) =>
    collections.flat().filter((component) => component.type === type).length;
  if (
    count('Header') !== baseline.headers ||
    count('Footer') !== baseline.footers
  ) {
    return 'Protected component cardinality changed';
  }
  const anchors = getProtectedAnchorSnapshot(collections);
  if (
    !hasSameProtectedAnchors(
      anchors.protectedAnchors,
      baseline.protectedAnchors
    )
  ) {
    return 'Protected anchors changed';
  }
  for (const [id, region] of baseline.componentAnchorRegions) {
    const currentRegion = anchors.componentAnchorRegions.get(id);
    if (currentRegion !== undefined && currentRegion !== region) {
      return 'Component moved across a protected anchor';
    }
  }
  if (
    enforceRequiredProductGrid &&
    baseline.requiresProductGrid &&
    count('ProductGrid') === 0
  ) {
    return 'A storefront requires one ProductGrid';
  }
  return collections.flat().length > 500
    ? 'Builder document has too many blocks'
    : undefined;
}

export function validateBuilderAiCandidate(
  candidateConfig: BuilderData,
  baseline: BuilderAiStructuralBaseline
): { candidateConfig: BuilderData } | { failure: string } {
  if (hasDuplicateBuilderAiComponentIds(candidateConfig)) {
    return { failure: 'Duplicate component id' };
  }
  const structureFailure = getBuilderAiStructuralFailure(
    candidateConfig,
    baseline
  );
  if (structureFailure) return { failure: structureFailure };
  const parsed =
    builderAiEditContract.builderDataSchema.safeParse(candidateConfig);
  if (
    !parsed.success ||
    !validateBuilderAiEditComplexity(candidateConfig).success
  ) {
    return { failure: 'Final builder configuration is invalid' };
  }
  return { candidateConfig: parsed.data };
}
