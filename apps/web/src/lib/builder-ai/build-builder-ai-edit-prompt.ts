import type {
  BuilderAiModelOperation,
  BuilderData,
} from '@baci/shared/contracts';
import {
  aiEditableComponents,
  getBuilderAiCatalogProjection,
  isAiEditableComponent,
} from './builder-ai-component-catalog';
import { sanitizeBuilderAiProps } from './sanitize-builder-ai-props';

interface PromptInput {
  currentConfig: BuilderData;
  prompt: string;
}

const operationExamples = [
  {
    componentId: 'component-id',
    kind: 'update_component',
    patch: { componentType: 'Hero', title: 'Updated title' },
  },
  {
    componentId: 'carousel-id',
    kind: 'update_carousel_slide',
    slideIndex: 0,
    title: 'Updated slide',
  },
  {
    initialContent: { componentType: 'Text', content: 'Supporting copy' },
    kind: 'insert_component',
    placement: { position: 'first_content' },
  },
  { componentId: 'component-id', kind: 'remove_component' },
  {
    componentId: 'component-id',
    destination: { position: 'first_content' },
    kind: 'move_component',
  },
  { kind: 'update_theme', preset: 'modern' },
  { kind: 'update_root', title: 'Page title' },
] satisfies BuilderAiModelOperation[];

export const MAX_PROMPT_PROJECTED_COMPONENTS = 100;
export const MAX_PROMPT_PROJECTION_CHARS = 16_384;

function clean(value: string): string {
  return Array.from(value, (character) => {
    const code = character.charCodeAt(0);
    return code < 32 || code === 127 ? ' ' : character;
  })
    .join('')
    .trim()
    .slice(0, 1000);
}

function serializeQuotedData(value: unknown): string {
  return JSON.stringify(value)
    .replaceAll('<', '\\u003c')
    .replaceAll('>', '\\u003e')
    .replaceAll('&', '\\u0026');
}

function project(currentConfig: BuilderData) {
  return currentConfig.content.flatMap((component) => {
    if (!isAiEditableComponent(component.type)) return [];
    const id = component.props.id;
    if (typeof id !== 'string' || id.length === 0) return [];
    const { props } = sanitizeBuilderAiProps(component.type, component.props);
    return [{ id, props, type: component.type }];
  });
}

export function buildBuilderAiEditPrompt({
  currentConfig,
  prompt,
}: PromptInput): string {
  const operationGuidance = serializeQuotedData({
    allowedComponentTypes: Object.keys(aiEditableComponents),
    catalog: getBuilderAiCatalogProjection(),
    operationExamples,
  });
  const projection = project(currentConfig);
  const componentProjection = serializeQuotedData(projection);
  if (
    projection.length > MAX_PROMPT_PROJECTED_COMPONENTS ||
    componentProjection.length > MAX_PROMPT_PROJECTION_CHARS ||
    new TextEncoder().encode(componentProjection).length >
      MAX_PROMPT_PROJECTION_CHARS
  ) {
    throw new Error('Builder AI prompt projection exceeds safety limit');
  }
  return [
    'Return a proposed semantic operations plan; never return a full config.',
    'Preserve unspecified content. Use only listed ids, types, and safe properties.',
    `<operation-guide>${operationGuidance}</operation-guide>`,
    `<safe-components>${componentProjection}</safe-components>`,
    `<merchant-request>${serializeQuotedData(clean(prompt))}</merchant-request>`,
  ].join('\n');
}
