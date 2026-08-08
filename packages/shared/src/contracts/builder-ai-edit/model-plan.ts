import { z } from 'zod';
import { insertableComponentSchema, productGridPatchSchema } from './catalog';
import { componentPatchSchema } from './component-patch';
import { footerPatchSchema } from './footer-patch';
import { headerPatchSchema } from './header-patch';
import { heroCarouselSlidePatchFields } from './hero-carousel-slide-patch-fields';
import {
  MAX_AI_PLAN_INSERTS,
  MAX_AI_PLAN_OPERATIONS,
  MAX_AI_PLAN_SERIALIZED_UTF8_BYTES,
} from './limits';

const boundedComponentId = z.string().trim().min(1).max(120);
const boundedCollection = z.string().trim().min(1).max(120);
const boundedTitle = z.string().trim().min(1).max(120);
const contentComponentPatchSchema = z.discriminatedUnion('componentType', [
  componentPatchSchema,
  productGridPatchSchema,
]);

const allComponentPatches = z.discriminatedUnion('componentType', [
  headerPatchSchema,
  contentComponentPatchSchema,
  footerPatchSchema,
]);

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
  patch: allComponentPatches,
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

const insertComponentSchema = z.strictObject({
  initialContent: insertableComponentSchema,
  kind: z.literal('insert_component'),
  placement: componentPlacementSchema,
});

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
    (value) => value.colors !== undefined || value.preset !== undefined,
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

export const builderAiProposedPlanSchema = z.strictObject({
  operations: z
    .array(builderAiModelOperationSchema)
    .min(1)
    .max(MAX_AI_PLAN_OPERATIONS),
  status: z.literal('proposed'),
  summary: z.string().trim().min(1).max(240),
});

export const builderAiRefusedPlanSchema = z.strictObject({
  operations: z.tuple([]),
  reason: z.string().trim().min(1).max(240),
  status: z.literal('refused'),
});

export const builderAiModelPlanSchema = z
  .discriminatedUnion('status', [
    builderAiProposedPlanSchema,
    builderAiRefusedPlanSchema,
  ])
  .refine(
    (plan) =>
      plan.operations.filter(
        (operation) => operation.kind === 'insert_component'
      ).length <= MAX_AI_PLAN_INSERTS,
    'Plan has too many inserts'
  )
  .refine(
    (plan) =>
      new TextEncoder().encode(JSON.stringify(plan)).byteLength <=
      MAX_AI_PLAN_SERIALIZED_UTF8_BYTES,
    'Plan is too large'
  );

export type BuilderAiEditPlan = z.infer<typeof builderAiModelPlanSchema>;
export type BuilderAiModelOperation = z.infer<
  typeof builderAiModelOperationSchema
>;
export type BuilderAiProposedPlan = z.infer<typeof builderAiProposedPlanSchema>;
