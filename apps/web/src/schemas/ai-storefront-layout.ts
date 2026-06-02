import { z } from 'zod';

const hexColorSchema = z
  .string()
  .trim()
  .regex(/^#[0-9a-fA-F]{6}$/, 'Expected a 6-digit hex color');

const shortTextSchema = z.string().trim().min(1).max(120);
const mediumTextSchema = z.string().trim().min(1).max(240);
const optionalShortTextSchema = shortTextSchema.optional();
const optionalMediumTextSchema = mediumTextSchema.optional();

const safeHrefSchema = z
  .string()
  .trim()
  .min(1)
  .max(200)
  .refine(
    (value) => value.startsWith('/') || value.startsWith('https://'),
    'Expected an internal path or HTTPS URL'
  );

const httpsUrlSchema = z
  .string()
  .trim()
  .url()
  .refine((value) => value.startsWith('https://'), {
    error: 'Expected an HTTPS URL',
  });

const basePropsSchema = z.strictObject({
  id: z.string().trim().min(1).max(80),
});

const linkSchema = z.strictObject({
  label: shortTextSchema,
  url: safeHrefSchema,
});

const iconNameSchema = z
  .enum([
    'award',
    'check',
    'headphones',
    'refresh-cw',
    'shield-check',
    'star',
    'truck',
  ])
  .default('check');

const headerComponentSchema = z.object({
  type: z.literal('Header'),
  props: basePropsSchema.extend({
    showLogo: z.boolean().default(true),
    showSearch: z.boolean().default(true),
    showCart: z.boolean().default(true),
    showMenu: z.boolean().default(true),
    sticky: z.boolean().default(true),
    navigationLinks: z.array(linkSchema).min(1).max(6).optional(),
    ctaButton: z
      .strictObject({
        show: z.boolean().default(false),
        text: optionalShortTextSchema,
        url: safeHrefSchema.optional(),
      })
      .refine(
        (value) => !value.show || (Boolean(value.text) && Boolean(value.url)),
        {
          path: ['text'],
          error: 'CTA button text and url are required when show is true',
        }
      )
      .optional(),
    layout: z
      .enum(['logo-left-nav-center', 'logo-left-nav-right', 'logo-center'])
      .default('logo-left-nav-center'),
    searchStyle: z.enum(['outline', 'filled', 'minimal']).default('outline'),
    searchRadius: z.enum(['none', 'sm', 'md', 'full']).default('md'),
    paddingY: z.enum(['sm', 'md', 'lg']).default('md'),
    glassEffect: z.boolean().default(false),
  }),
});

const heroComponentSchema = z.object({
  type: z.literal('Hero'),
  props: basePropsSchema.extend({
    title: shortTextSchema,
    subtitle: optionalMediumTextSchema,
    ctaText: optionalShortTextSchema,
    ctaLink: safeHrefSchema.default('/products'),
    backgroundImage: httpsUrlSchema.optional(),
    overlay: z.boolean().default(false),
    align: z.enum(['left', 'center', 'right']).default('center'),
    padding: z.enum(['small', 'medium', 'large']).default('medium'),
    headingLevel: z.enum(['h1', 'h2', 'div']).default('h1'),
  }),
});

const featureItemSchema = z.strictObject({
  title: shortTextSchema,
  description: mediumTextSchema,
  icon: iconNameSchema,
});

const featuresComponentSchema = z.object({
  type: z.literal('Features'),
  props: basePropsSchema.extend({
    title: optionalShortTextSchema,
    subtitle: optionalMediumTextSchema,
    columns: z.union([z.literal(2), z.literal(3), z.literal(4)]).default(3),
    features: z.array(featureItemSchema).min(2).max(6),
  }),
});

const productGridComponentSchema = z.object({
  type: z.literal('ProductGrid'),
  props: basePropsSchema.extend({
    title: optionalShortTextSchema,
    columns: z.int().min(1).max(4).default(3),
    limit: z.int().min(4).max(12).default(8),
    category: z.string().trim().max(80).optional(),
    sortBy: z
      .enum(['newest', 'price-low', 'price-high', 'name'])
      .default('newest'),
    showFilters: z.boolean().default(true),
  }),
});

const trustBadgesComponentSchema = z.object({
  type: z.literal('TrustBadges'),
  props: basePropsSchema.extend({
    badges: z.array(featureItemSchema).min(2).max(4),
    layout: z.enum(['horizontal', 'grid']).default('horizontal'),
    style: z.enum(['cards', 'minimal', 'icons-only']).default('cards'),
  }),
});

const newsletterComponentSchema = z.object({
  type: z.literal('Newsletter'),
  props: basePropsSchema.extend({
    title: optionalShortTextSchema,
    description: optionalMediumTextSchema,
    placeholder: z.string().trim().min(1).max(80).default('Enter your email'),
    buttonText: optionalShortTextSchema,
  }),
});

const socialLinksSchema = z.strictObject({
  facebook: httpsUrlSchema.optional(),
  instagram: httpsUrlSchema.optional(),
  twitter: httpsUrlSchema.optional(),
  linkedin: httpsUrlSchema.optional(),
  youtube: httpsUrlSchema.optional(),
});

const footerPropsSchema = basePropsSchema
  .extend({
    copyrightText: optionalShortTextSchema,
    showQuickLinks: z.boolean().default(false),
    quickLinks: z.array(linkSchema).min(1).max(8).optional(),
    socialLinks: socialLinksSchema.optional(),
    showNewsletter: z.boolean().default(false),
  })
  .refine(
    (value) =>
      !value.showQuickLinks ||
      (Array.isArray(value.quickLinks) && value.quickLinks.length > 0),
    {
      path: ['quickLinks'],
      error: 'quickLinks is required when showQuickLinks is true',
    }
  );

const footerComponentSchema = z.object({
  type: z.literal('Footer'),
  props: footerPropsSchema,
});

export const aiStorefrontComponentSchema = z.discriminatedUnion('type', [
  headerComponentSchema,
  heroComponentSchema,
  featuresComponentSchema,
  productGridComponentSchema,
  trustBadgesComponentSchema,
  newsletterComponentSchema,
  footerComponentSchema,
]);

export const aiStorefrontThemeSchema = z.strictObject({
  primary: hexColorSchema.optional(),
  accent: hexColorSchema.optional(),
  background: hexColorSchema.optional(),
});

export const aiStorefrontLayoutSchema = z.strictObject({
  theme: aiStorefrontThemeSchema.optional(),
  sections: z.array(aiStorefrontComponentSchema).min(4).max(9),
  designRationale: z.string().trim().max(500).optional(),
});

export type AiStorefrontComponent = z.infer<typeof aiStorefrontComponentSchema>;
export type AiStorefrontLayout = z.infer<typeof aiStorefrontLayoutSchema>;
export type AiStorefrontTheme = z.infer<typeof aiStorefrontThemeSchema>;
