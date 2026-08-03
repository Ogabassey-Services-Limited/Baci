import {
  type BuilderData,
  builderAiEditContract,
  validateBuilderAiEditComplexity,
} from '@baci/shared/contracts';
import { getDuplicateBuilderAiComponentId } from './get-duplicate-builder-ai-component-id';

export interface BuilderAiStructuralBaseline {
  footers: number;
  headers: number;
  requiresProductGrid: boolean;
}

export function getBuilderAiStructuralBaseline(
  content: BuilderData['content']
): BuilderAiStructuralBaseline {
  return {
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
