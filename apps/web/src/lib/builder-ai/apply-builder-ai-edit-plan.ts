import {
  type BuilderAiModelOperation,
  type BuilderAiProposedPlan,
  type BuilderData,
  builderAiEditContract,
} from '@baci/shared/contracts';
import { areBuilderAiPropValuesEqual } from './are-builder-ai-prop-values-equal';
import {
  createInsertableComponentProps,
  isAiEditableComponent,
  isAiInsertableComponent,
  isProtectedAiComponent,
} from './builder-ai-component-catalog';
import {
  getBuilderAiStructuralBaseline,
  getBuilderAiStructuralFailure,
  validateBuilderAiCandidate,
} from './builder-ai-structure-guards';
import { applyBuilderAiTheme } from './builder-ai-theme-presets';
import { createBuilderComponentId } from './create-builder-component-id';
import { getBuilderAiRawPlanMediaWarning } from './get-builder-ai-raw-plan-media-warning';
import { getBuilderComponentId } from './get-builder-component-id';
import { getDuplicateBuilderAiComponentId } from './get-duplicate-builder-ai-component-id';
import { isRenderedH1Hero } from './is-rendered-h1-hero';
import { normalizeBuilderAiModelPlan } from './normalize-builder-ai-model-plan';
import { sanitizeBuilderAiProps } from './sanitize-builder-ai-props';

type BuilderComponent = BuilderData['content'][number];
export class BuilderAiEditPlanError extends Error {}
export interface ApplyBuilderAiEditPlanResult {
  candidateConfig: BuilderData;
  warnings: string[];
}
function cloneConfig(config: BuilderData): BuilderData {
  try {
    return JSON.parse(JSON.stringify(config)) as BuilderData;
  } catch {
    throw new BuilderAiEditPlanError('Builder configuration cannot be cloned');
  }
}
function findIndex(content: BuilderComponent[], id: string): number {
  const index = content.findIndex(
    (component) => getBuilderComponentId(component) === id
  );
  if (index < 0)
    throw new BuilderAiEditPlanError('Component target was not found');
  return index;
}
function assertUniqueIds(content: BuilderComponent[]): void {
  if (getDuplicateBuilderAiComponentId(content)) {
    throw new BuilderAiEditPlanError('Duplicate component id');
  }
}
function getValidCandidate(
  candidateConfig: BuilderData,
  baseline: ReturnType<typeof getBuilderAiStructuralBaseline>
): BuilderData {
  const validation = validateBuilderAiCandidate(candidateConfig, baseline);
  if ('failure' in validation) {
    throw new BuilderAiEditPlanError(validation.failure);
  }
  return validation.candidateConfig;
}
function destinationIndex(
  content: BuilderComponent[],
  placement: { componentId?: string; position: 'after' | 'first_content' }
): number {
  const bounds = {
    first: content[0]?.type === 'Header' ? 1 : 0,
    last:
      content.at(-1)?.type === 'Footer' ? content.length - 1 : content.length,
  };
  const index =
    placement.position === 'first_content'
      ? bounds.first
      : findIndex(content, placement.componentId ?? '') + 1;
  if (index < bounds.first || index > bounds.last) {
    throw new BuilderAiEditPlanError('Placement crosses a protected anchor');
  }
  return index;
}
function pushWarnings(target: string[], warnings: string[]): void {
  for (const warning of warnings) {
    if (target.length >= 10) return;
    target.push(warning.slice(0, 160));
  }
}
function assertMutable(component: BuilderComponent): void {
  if (
    !isAiEditableComponent(component.type) ||
    isProtectedAiComponent(component.type)
  ) {
    throw new BuilderAiEditPlanError('Component is protected or unsupported');
  }
}
function applyComponentPatch(
  component: BuilderComponent,
  patch: Record<string, unknown>,
  warnings: string[]
): void {
  const sanitized = sanitizeBuilderAiProps(component.type, patch);
  pushWarnings(warnings, sanitized.warnings);
  const changed = Object.entries(sanitized.props).some(
    ([key, value]) => !areBuilderAiPropValuesEqual(component.props[key], value)
  );
  if (!changed) {
    pushWarnings(warnings, [`No safe changes for ${component.type}.`]);
    return;
  }
  component.props = { ...component.props, ...sanitized.props };
}
function applyCarouselPatch(
  component: BuilderComponent,
  operation: Extract<
    BuilderAiModelOperation,
    { kind: 'update_carousel_slide' }
  >,
  warnings: string[]
): void {
  if (
    component.type !== 'HeroCarousel' ||
    !Array.isArray(component.props.slides)
  ) {
    throw new BuilderAiEditPlanError('Carousel target was not found');
  }
  const slide = component.props.slides[operation.slideIndex];
  if (!slide || typeof slide !== 'object' || Array.isArray(slide)) {
    throw new BuilderAiEditPlanError('Carousel slide was not found');
  }
  const patch = Object.fromEntries(
    ['ctaLink', 'ctaText', 'subtitle', 'title'].flatMap((key) =>
      operation[key as keyof typeof operation] === undefined
        ? []
        : [[key, operation[key as keyof typeof operation]]]
    )
  );
  const sanitized = sanitizeBuilderAiProps('Hero', patch);
  pushWarnings(warnings, sanitized.warnings);
  if (
    !Object.entries(sanitized.props).some(
      ([key, value]) => (slide as Record<string, unknown>)[key] !== value
    )
  ) {
    pushWarnings(warnings, ['No safe changes for HeroCarousel.']);
    return;
  }
  component.props.slides = component.props.slides.map((item, index) =>
    index === operation.slideIndex
      ? { ...(item as Record<string, unknown>), ...sanitized.props }
      : item
  );
}
function applyOperation(
  config: BuilderData,
  operation: BuilderAiModelOperation,
  createId: (componentType: string) => string,
  warnings: string[]
): void {
  const { content } = config;
  switch (operation.kind) {
    case 'update_component': {
      const component = content[findIndex(content, operation.componentId)];
      if (
        !isAiEditableComponent(component.type) ||
        !isAiEditableComponent(operation.patch.componentType) ||
        component.type !== operation.patch.componentType
      ) {
        throw new BuilderAiEditPlanError(
          'Component type does not match target'
        );
      }
      applyComponentPatch(component, operation.patch, warnings);
      return;
    }
    case 'update_carousel_slide':
      applyCarouselPatch(
        content[findIndex(content, operation.componentId)],
        operation,
        warnings
      );
      return;
    case 'insert_component': {
      const initial = operation.initialContent as Record<string, unknown>;
      const componentType = String(initial.componentType ?? '');
      if (!isAiInsertableComponent(componentType)) {
        throw new BuilderAiEditPlanError('Component cannot be inserted');
      }
      const id = createId(componentType);
      if (
        content.some((component) => getBuilderComponentId(component) === id)
      ) {
        throw new BuilderAiEditPlanError('Generated component id collides');
      }
      const sanitized = sanitizeBuilderAiProps(componentType, initial);
      if (sanitized.warnings.length > 0) {
        throw new BuilderAiEditPlanError('Insert contains unsupported fields');
      }
      const props = createInsertableComponentProps(
        componentType,
        sanitized.props
      );
      content.splice(destinationIndex(content, operation.placement), 0, {
        props: { ...props, id },
        type: componentType,
      });
      return;
    }
    case 'remove_component': {
      const index = findIndex(content, operation.componentId);
      const component = content[index];
      assertMutable(component);
      if (
        isRenderedH1Hero(component) &&
        content.filter(isRenderedH1Hero).length === 1
      ) {
        throw new BuilderAiEditPlanError('Cannot remove the final H1 Hero');
      }
      content.splice(index, 1);
      return;
    }
    case 'move_component': {
      const source = findIndex(content, operation.componentId);
      const component = content[source];
      assertMutable(component);
      let destination = destinationIndex(content, operation.destination);
      if (source < destination) destination -= 1;
      if (source === destination) {
        pushWarnings(warnings, ['No safe changes for move.']);
        return;
      }
      content.splice(source, 1);
      content.splice(destination, 0, component);
      return;
    }
    case 'update_root': {
      if (config.root.title === operation.title) {
        pushWarnings(warnings, ['No safe changes for page title.']);
        return;
      }
      config.root = { ...config.root, title: operation.title };
      return;
    }
    case 'update_theme': {
      const theme = applyBuilderAiTheme(config.theme, operation).theme;
      if (JSON.stringify(config.theme) === JSON.stringify(theme)) {
        pushWarnings(warnings, ['No safe changes for theme.']);
        return;
      }
      config.theme = theme;
      return;
    }
    default: {
      const _exhaustiveOperation: never = operation;
      throw new BuilderAiEditPlanError('Unsupported builder AI operation');
    }
  }
}

export function applyBuilderAiEditPlan(
  currentConfig: BuilderData,
  plan: BuilderAiProposedPlan,
  createId: (componentType: string) => string = createBuilderComponentId
): ApplyBuilderAiEditPlanResult {
  const candidateConfig = cloneConfig(currentConfig);
  const baseline = getBuilderAiStructuralBaseline(candidateConfig.content);
  const rawMediaWarning = getBuilderAiRawPlanMediaWarning(plan);
  if (rawMediaWarning) {
    return {
      candidateConfig: getValidCandidate(candidateConfig, baseline),
      warnings: [rawMediaWarning],
    };
  }
  const parsedPlan = builderAiEditContract.modelPlanSchema.safeParse(
    normalizeBuilderAiModelPlan(plan)
  );
  if (!parsedPlan.success || parsedPlan.data.status !== 'proposed') {
    throw new BuilderAiEditPlanError('Invalid builder AI edit plan');
  }
  assertUniqueIds(candidateConfig.content);
  const warnings: string[] = [];

  for (const operation of parsedPlan.data.operations) {
    try {
      applyOperation(candidateConfig, operation, createId, warnings);
    } catch (error) {
      if (error instanceof BuilderAiEditPlanError) throw error;
      throw new BuilderAiEditPlanError('Unable to apply builder AI edit plan');
    }
    assertUniqueIds(candidateConfig.content);
    const structureFailure = getBuilderAiStructuralFailure(
      candidateConfig.content,
      baseline
    );
    if (structureFailure) throw new BuilderAiEditPlanError(structureFailure);
  }
  return {
    candidateConfig: getValidCandidate(candidateConfig, baseline),
    warnings,
  };
}
