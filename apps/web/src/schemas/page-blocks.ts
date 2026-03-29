import z from 'zod';

export const BlockSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('Header'),
    props: z.object({
      id: z.string(),
      showLogo: z.boolean().optional(),
      showSearch: z.boolean().optional(),
      showCart: z.boolean().optional(),
      storeName: z.string(),
      logoUrl: z.string().optional(),
    }),
  }),
  z.object({
    type: z.literal('HeroCarousel'),
    props: z.object({
      id: z.string(),
      slides: z.array(
        z.object({
          image: z.string(),
          title: z.string(),
          subtitle: z.string(),
          ctaText: z.string(),
          ctaLink: z.string(),
        })
      ),
      autoplayDelay: z.number().optional(),
    }),
  }),
  z.object({
    type: z.literal('CategoryRail'),
    props: z.object({
      id: z.string(),
      title: z.string().optional(),
    }),
  }),
  z.object({
    type: z.literal('ProductGrid'),
    props: z.object({
      id: z.string(),
      title: z.string().optional(),
      limit: z.number().optional(),
      sortBy: z.string().optional(),
    }),
  }),
]);

export const PageConfigSchema = z.object({
  content: z.array(BlockSchema),
  theme: z.unknown().optional(),
});
