/**
 * Jumia Vendor Center API — Catalog schemas (products, categories, brands,
 * attribute sets, stock)
 */

import { z } from 'zod';

// ── Brands ──

export const JumiaBrandSchema = z.object({
  code: z.number().int(),
  name: z.string(),
});

const JumiaPageMetadataSchema = z.object({
  current: z.number().int(),
  totalOfPages: z.number().int(),
});

export const JumiaBrandsResponseSchema = z.object({
  brands: z.array(JumiaBrandSchema),
  page: JumiaPageMetadataSchema,
});

// ── Products ──

const JumiaTranslation = z.object({
  language: z.string(),
  value: z.string(),
});

export const JumiaAttributeSchema = z.object({
  id: z.string(),
  name: z.string(),
  value: z.string(),
  translations: z.array(JumiaTranslation),
});

export const JumiaSalePriceSchema = z.object({
  value: z.number().nonnegative(),
  startAt: z.string().datetime({ offset: true }),
  endAt: z.string().datetime({ offset: true }),
});

export const JumiaGlobalPriceSchema = z.object({
  value: z.number().nonnegative(),
  updateAt: z.string().datetime({ offset: true }),
  salePrice: JumiaSalePriceSchema.nullable().optional(),
});

export const JumiaVariationSchema = z.object({
  id: z.string(),
  sellerSku: z.string(),
  barcodeEan: z
    .string()
    .refine(
      (v) => v === '' || /^\d{8}(\d{5})?$/.test(v),
      'Must be empty or a valid EAN-8 or EAN-13 barcode'
    )
    .optional(),
  variation: z.string(),
  globalPrice: JumiaGlobalPriceSchema,
  attributes: z.array(JumiaAttributeSchema),
});

export const JumiaProductSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string(),
  parentSku: z.string().min(1),
  shop: z.object({ id: z.string() }),
  brand: JumiaBrandSchema,
  category: z.object({ code: z.number().int(), name: z.string() }),
  images: z.array(
    z.object({
      url: z.string().url(),
      originalUrl: z.string().url(),
      primary: z.boolean(),
    })
  ),
  attributeSetId: z.string(),
  attributes: z.array(JumiaAttributeSchema),
  createdAt: z.string().datetime({ offset: true }),
  updatedAt: z.string().datetime({ offset: true }),
  variations: z.array(JumiaVariationSchema),
});

export const JumiaProductsResponseSchema = z.object({
  products: z.array(JumiaProductSchema),
  nextToken: z.string().nullable(),
  isLastPage: z.boolean(),
});

// ── Categories ──

export const JumiaCategorySchema = z.object({
  code: z.number().int(),
  name: z.string().min(1),
  completePath: z.string().min(1),
  attributeSet: z.object({
    id: z.string(),
    name: z.string(),
  }),
});

export const JumiaCategoriesResponseSchema = z.object({
  categories: z.array(JumiaCategorySchema),
  page: JumiaPageMetadataSchema.optional(),
});

// ── Attribute Sets ──

const JumiaAttributeOption = z.object({
  id: z.string(),
  name: z.string(),
  position: z.number(),
  isDefault: z.boolean(),
});

const JumiaAttributeTranslation = z.object({
  languageCode: z.string(),
  translation: z.string(),
  languageId: z.number(),
});

// Intentionally flexible: Jumia API docs don't specify a fixed validation shape
const JumiaAttributeValidation = z.record(z.string(), z.unknown());

const JumiaAttributeDefinition = z.object({
  code: z.number(),
  name: z.string(),
  description: z.string(),
  type: z.string(),
  mandatory: z.boolean(),
  variation: z.boolean(),
  translatable: z.boolean(),
  sid: z.string(),
  translations: z.array(JumiaAttributeTranslation),
  options: z.array(JumiaAttributeOption),
  validations: z.array(JumiaAttributeValidation),
});

export const JumiaAttributeSetResponseSchema = z.object({
  attributes: z.array(JumiaAttributeDefinition),
});

// ── Stock ──

export const JumiaStockResponseSchema = z.object({
  products: z.array(
    z.object({
      id: z.string(),
      sellerSku: z.string(),
      globalStock: z.number().int().nonnegative(),
      lastStockUpdatedAt: z.string().datetime({ offset: true }),
    })
  ),
  nextToken: z.string().nullable(),
  isLastPage: z.boolean(),
});

// ── Inferred types ──

export type JumiaProductsResponse = z.infer<typeof JumiaProductsResponseSchema>;
export type JumiaProduct = z.infer<typeof JumiaProductSchema>;
export type JumiaVariation = z.infer<typeof JumiaVariationSchema>;
export type JumiaCategoriesResponse = z.infer<
  typeof JumiaCategoriesResponseSchema
>;
export type JumiaCategory = z.infer<typeof JumiaCategorySchema>;
export type JumiaBrand = z.infer<typeof JumiaBrandSchema>;
export type JumiaBrandsResponse = z.infer<typeof JumiaBrandsResponseSchema>;
export type JumiaAttributeSetResponse = z.infer<
  typeof JumiaAttributeSetResponseSchema
>;
export type JumiaStockResponse = z.infer<typeof JumiaStockResponseSchema>;
export type JumiaAttributeType = z.infer<typeof JumiaAttributeSchema>;
export type JumiaSalePriceType = z.infer<typeof JumiaSalePriceSchema>;
export type JumiaGlobalPriceType = z.infer<typeof JumiaGlobalPriceSchema>;
