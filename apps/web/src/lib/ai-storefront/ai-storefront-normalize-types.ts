import type { AiStorefrontComponent } from '@/schemas/ai-storefront-layout';
import { aiStorefrontComponentSchema } from '@/schemas/ai-storefront-layout';

export type HeaderComponent = Extract<
  AiStorefrontComponent,
  { type: 'Header' }
>;
export type HeroComponent = Extract<AiStorefrontComponent, { type: 'Hero' }>;
export type FeaturesComponent = Extract<
  AiStorefrontComponent,
  { type: 'Features' }
>;
export type ProductGridComponent = Extract<
  AiStorefrontComponent,
  { type: 'ProductGrid' }
>;
export type TrustBadgesComponent = Extract<
  AiStorefrontComponent,
  { type: 'TrustBadges' }
>;
export type NewsletterComponent = Extract<
  AiStorefrontComponent,
  { type: 'Newsletter' }
>;
export type FooterComponent = Extract<
  AiStorefrontComponent,
  { type: 'Footer' }
>;

export type Link = { label: string; url: string };
export type IconName =
  | 'award'
  | 'check'
  | 'headphones'
  | 'refresh-cw'
  | 'shield-check'
  | 'star'
  | 'truck';
export type FeatureItem = {
  title: string;
  description: string;
  icon: IconName;
};
export type ThemeColors = {
  primary?: string;
  accent?: string;
  background?: string;
};

export const KNOWN_COMPONENT_TYPES = [
  'Header',
  'Hero',
  'Features',
  'ProductGrid',
  'TrustBadges',
  'Newsletter',
  'Footer',
] as const;
export type KnownComponentType = (typeof KNOWN_COMPONENT_TYPES)[number];

export const ICON_NAMES = [
  'award',
  'check',
  'headphones',
  'refresh-cw',
  'shield-check',
  'star',
  'truck',
] as const;

export function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export function text(value: unknown, maxLength: number): string | undefined {
  if (typeof value !== 'string') return undefined;
  const normalized = value.replace(/\s+/g, ' ').trim();
  return normalized ? normalized.slice(0, maxLength).trim() : undefined;
}

export function bool(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

export function integerInRange(
  value: unknown,
  fallback: number,
  min: number,
  max: number
): number {
  return typeof value === 'number' && Number.isInteger(value)
    ? Math.min(Math.max(value, min), max)
    : fallback;
}

export function safeHref(value: unknown): string | undefined {
  const href = text(value, 200);
  if (!href) return undefined;
  return href.startsWith('/') || href.startsWith('https://') ? href : undefined;
}

export function hexColor(value: unknown): string | undefined {
  const color = text(value, 20);
  return color && /^#[0-9a-fA-F]{6}$/.test(color) ? color : undefined;
}

export function pickLiteral<const T extends readonly string[]>(
  value: unknown,
  allowed: T,
  fallback: T[number]
): T[number] {
  return typeof value === 'string' && allowed.includes(value as T[number])
    ? (value as T[number])
    : fallback;
}

export function pickNumberLiteral<const T extends readonly number[]>(
  value: unknown,
  allowed: T,
  fallback: T[number]
): T[number] {
  return typeof value === 'number' && allowed.includes(value as T[number])
    ? (value as T[number])
    : fallback;
}

export function componentId(
  value: unknown,
  fallbackPrefix: string,
  index: number
): string {
  return text(value, 80) ?? `${fallbackPrefix}-${index + 1}`;
}

export function parseComponent(
  component: unknown,
  fallback: AiStorefrontComponent
): AiStorefrontComponent {
  const parsed = aiStorefrontComponentSchema.safeParse(component);
  return parsed.success ? parsed.data : fallback;
}
