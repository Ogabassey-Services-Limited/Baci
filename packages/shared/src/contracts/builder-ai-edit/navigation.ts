import { z } from 'zod';
import {
  MAX_AI_COPY_LENGTH,
  MAX_AI_LABEL_LENGTH,
  MAX_AI_URL_LENGTH,
} from './limits';

function isSafeStorefrontUrl(value: string): boolean {
  if (value.startsWith('/')) return !value.startsWith('//');
  if (value.startsWith('#')) return value.length > 1;
  try {
    const parsed = new URL(value);
    return (
      parsed.protocol === 'https:' &&
      parsed.hostname.length > 0 &&
      parsed.username.length === 0 &&
      parsed.password.length === 0
    );
  } catch {
    return false;
  }
}

export const safeStorefrontUrlSchema = z
  .string()
  .trim()
  .min(1)
  .max(MAX_AI_URL_LENGTH)
  .refine(
    isSafeStorefrontUrl,
    'Expected an https, root-relative, or anchor URL'
  );

export const safeNavigationLinkSchema = z.strictObject({
  label: z.string().trim().min(1).max(MAX_AI_LABEL_LENGTH),
  url: safeStorefrontUrlSchema,
});

const safeCtaSchema = z.strictObject({
  show: z.boolean(),
  text: z.string().trim().min(1).max(MAX_AI_LABEL_LENGTH),
  url: safeStorefrontUrlSchema,
});

export const headerPatchSchema = z
  .strictObject({
    componentType: z.literal('Header'),
    ctaButton: safeCtaSchema.optional(),
    glassEffect: z.boolean().optional(),
    layout: z
      .enum(['logo-left-nav-center', 'logo-left-nav-right', 'logo-center'])
      .optional(),
    navigationLinks: z.array(safeNavigationLinkSchema).max(8).optional(),
    paddingY: z.enum(['sm', 'md', 'lg']).optional(),
    searchRadius: z.enum(['none', 'sm', 'md', 'full']).optional(),
    searchStyle: z.enum(['outline', 'filled', 'minimal']).optional(),
    showCart: z.boolean().optional(),
    showLogo: z.boolean().optional(),
    showMenu: z.boolean().optional(),
    showSearch: z.boolean().optional(),
    sticky: z.boolean().optional(),
  })
  .refine(
    (value) => Object.keys(value).some((key) => key !== 'componentType'),
    'Expected at least one editable header field'
  );

export const footerPatchSchema = z
  .strictObject({
    componentType: z.literal('Footer'),
    copyrightText: z.string().trim().min(1).max(MAX_AI_COPY_LENGTH).optional(),
    quickLinks: z.array(safeNavigationLinkSchema).max(8).optional(),
    showNewsletter: z.boolean().optional(),
    showQuickLinks: z.boolean().optional(),
  })
  .refine(
    (value) => Object.keys(value).some((key) => key !== 'componentType'),
    'Expected at least one editable footer field'
  );
