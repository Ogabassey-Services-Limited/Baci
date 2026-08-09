import { z } from 'zod';
import { insertableComponentSchema } from './catalog';
import { componentPatchSchema } from './component-patch';
import { heroCarouselSlidePatchFields } from './hero-carousel-slide-patch-fields';
import { manifestBuilderAiCapability } from './validate-manifest-capability';

const boundedComponentId = z.string().trim().min(1).max(120);
const boundedCollection = z.string().trim().min(1).max(120);
const boundedTitle = z.string().trim().min(1).max(120);
const componentPlacementSchema = z.discriminatedUnion('position', [
  z.strictObject({
    collection: boundedCollection.optional(),
    position: z.literal('first_content'),
  }),
  z.strictObject({
    componentId: boundedComponentId,
    position: z.literal('after'),
  }),
]);
const updateComponentSchema = z.strictObject({
  componentId: boundedComponentId,
  kind: z.literal('update_component'),
  patch: componentPatchSchema,
});
const updateCarouselSlideSchema = z
  .strictObject({
    componentId: boundedComponentId,
    ...heroCarouselSlidePatchFields,
    kind: z.literal('update_carousel_slide'),
    slideIndex: z.number().int().min(0).max(4),
  })
  .refine(
    (value) =>
      value.ctaLink !== undefined ||
      value.ctaText !== undefined ||
      value.subtitle !== undefined ||
      value.title !== undefined,
    'Expected at least one editable carousel slide field'
  );
const insertComponentSchema = z
  .strictObject({
    initialContent: insertableComponentSchema,
    kind: z.literal('insert_component'),
    placement: componentPlacementSchema,
  })
  .refine(
    ({ initialContent }) =>
      manifestBuilderAiCapability.isInsert(initialContent),
    'Expected manifest-authorized insert'
  )
  .refine(
    ({ initialContent, placement }) =>
      manifestBuilderAiCapability.isInsertPlacement(
        initialContent.componentType,
        placement.position === 'first_content'
          ? placement.collection
          : undefined
      ),
    'Placement is not allowed by the manifest'
  );
const removeComponentSchema = z.strictObject({
  componentId: boundedComponentId,
  kind: z.literal('remove_component'),
});
const moveComponentSchema = z.strictObject({
  componentId: boundedComponentId,
  destination: componentPlacementSchema,
  kind: z.literal('move_component'),
});
const updateThemeSchema = z
  .strictObject({
    colors: z
      .strictObject({
        accent: z
          .string()
          .regex(/^#[0-9a-fA-F]{6}$/)
          .optional(),
        background: z
          .string()
          .regex(/^#[0-9a-fA-F]{6}$/)
          .optional(),
        foreground: z
          .string()
          .regex(/^#[0-9a-fA-F]{6}$/)
          .optional(),
        primary: z
          .string()
          .regex(/^#[0-9a-fA-F]{6}$/)
          .optional(),
        secondary: z
          .string()
          .regex(/^#[0-9a-fA-F]{6}$/)
          .optional(),
      })
      .optional(),
    kind: z.literal('update_theme'),
    preset: z
      .enum(['modern', 'minimal', 'luxury', 'playful', 'bold', 'calm'])
      .optional(),
  })
  .refine(
    (value) =>
      value.preset !== undefined || Object.keys(value.colors ?? {}).length > 0,
    'Expected a visual preset or base colors'
  );
const updateRootSchema = z.strictObject({
  kind: z.literal('update_root'),
  title: boundedTitle,
});

export const builderAiModelOperationSchema = z.discriminatedUnion('kind', [
  updateComponentSchema,
  updateCarouselSlideSchema,
  insertComponentSchema,
  removeComponentSchema,
  moveComponentSchema,
  updateThemeSchema,
  updateRootSchema,
]);

export type BuilderAiModelOperation = z.infer<
  typeof builderAiModelOperationSchema
>;
