import { z } from 'zod';

const ProductColorGallerySchema = z.strictObject({
  color: z.string().trim().min(1).max(80),
  mediaIds: z.array(z.uuid()).min(1).max(32),
});

/** Bounded legacy color-to-gallery mappings used by the product media picker. */
export const StorefrontPublicProductColorGalleriesSchema = z
  .array(ProductColorGallerySchema)
  .max(32)
  .superRefine((galleries, context) => {
    const colors = new Set<string>();
    for (const [index, gallery] of galleries.entries()) {
      const normalized = gallery.color.toLocaleLowerCase();
      if (colors.has(normalized))
        context.addIssue({
          code: 'custom',
          message: 'Product color galleries must have unique colors',
          path: [index, 'color'],
        });
      colors.add(normalized);
    }
  });
