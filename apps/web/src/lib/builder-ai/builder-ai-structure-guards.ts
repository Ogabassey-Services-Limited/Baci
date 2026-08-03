import {
  type BuilderData,
  builderAiEditContract,
  validateBuilderAiEditComplexity,
} from '@baci/shared/contracts';
import { getBuilderComponentId } from './get-builder-component-id';
import { getDuplicateBuilderAiComponentId } from './get-duplicate-builder-ai-component-id';

interface ProtectedAnchor {
  id: string | undefined;
  type: 'Footer' | 'Header';
}

export interface BuilderAiStructuralBaseline {
  componentAnchorRegions: Map<string, number>;
  footers: number;
  headers: number;
  protectedAnchors: ProtectedAnchor[];
  requiresProductGrid: boolean;
}

function getProtectedAnchorSnapshot(content: BuilderData['content']): {
  componentAnchorRegions: Map<string, number>;
  protectedAnchors: ProtectedAnchor[];
} {
  const componentAnchorRegions = new Map<string, number>();
  const protectedAnchors: ProtectedAnchor[] = [];
  let region = 0;

  for (const component of content) {
    if (component.type === 'Footer' || component.type === 'Header') {
      protectedAnchors.push({
        id: getBuilderComponentId(component),
        type: component.type,
      });
      region += 1;
      continue;
    }
    const id = getBuilderComponentId(component);
    if (id) componentAnchorRegions.set(id, region);
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
        anchor.type === baseline[index]?.type
    )
  );
}

export function getBuilderAiStructuralBaseline(
  content: BuilderData['content']
): BuilderAiStructuralBaseline {
  const anchors = getProtectedAnchorSnapshot(content);
  return {
    ...anchors,
    footers: content.filter((component) => component.type === 'Footer').length,
    headers: content.filter((component) => component.type === 'Header').length,
    requiresProductGrid: content.some(
      (component) => component.type === 'ProductGrid'
    ),
  };
}

export function getBuilderAiStructuralFailure(
  content: BuilderData['content'],
  baseline: BuilderAiStructuralBaseline
): string | undefined {
  const count = (type: string) =>
    content.filter((component) => component.type === type).length;
  if (
    count('Header') !== baseline.headers ||
    count('Footer') !== baseline.footers
  ) {
    return 'Protected component cardinality changed';
  }
  const anchors = getProtectedAnchorSnapshot(content);
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
  if (baseline.requiresProductGrid && count('ProductGrid') === 0) {
    return 'A storefront requires one ProductGrid';
  }
  return content.length > 500
    ? 'Builder document has too many blocks'
    : undefined;
}

export function validateBuilderAiCandidate(
  candidateConfig: BuilderData,
  baseline: BuilderAiStructuralBaseline
): { candidateConfig: BuilderData } | { failure: string } {
  if (getDuplicateBuilderAiComponentId(candidateConfig.content)) {
    return { failure: 'Duplicate component id' };
  }
  const structureFailure = getBuilderAiStructuralFailure(
    candidateConfig.content,
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
