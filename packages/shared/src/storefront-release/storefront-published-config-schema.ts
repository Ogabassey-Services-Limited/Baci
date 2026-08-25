import { z } from 'zod';
import type { BuilderData } from '../contracts/builder-ai-edit';
import { builderDesignCapabilityAdapter } from '../contracts/builder-design-capability-adapter';
import { builderPreviewCandidateConfigSchema } from '../contracts/builder-preview-candidate-config';
import { isSafePublicReleaseUrl } from './is-safe-public-release-url';
import { isStablePublicMediaUrl } from './is-stable-public-media-url';

const MEDIA_PROPERTY_NAMES = new Set([
  'avatar',
  'backgroundImage',
  'faviconUrl',
  'image',
  'logoUrl',
  'src',
]);
const MAX_RELEASE_CAROUSEL_SLIDES = 5;

function isNavigationPropertyName(key: string): boolean {
  const normalized = key.toLowerCase();
  return (
    normalized === 'href' ||
    normalized.endsWith('link') ||
    normalized.endsWith('url')
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasPublishedRoot(value: unknown): boolean {
  if (!isRecord(value) || !isRecord(value.props)) return false;
  const title = value.props.title;
  if (typeof title !== 'string' || title.length > 120) return false;
  if (Object.keys(value.props).some((key) => key !== 'title')) return false;
  const keys = Object.keys(value);
  if (keys.some((key) => key !== 'props' && key !== 'title')) return false;
  return value.title === undefined || value.title === title;
}

function containsRefusedComponent(value: unknown): boolean {
  if (!isRecord(value)) return false;
  const collections = [value.content];
  if (isRecord(value.zones))
    for (const zone of Object.values(value.zones)) collections.push(zone);
  return collections.some(
    (collection) =>
      Array.isArray(collection) &&
      collection.some(
        (component) =>
          isRecord(component) &&
          typeof component.type === 'string' &&
          builderDesignCapabilityAdapter.getCapability(component.type)?.refused
      )
  );
}

function hasUnstableMediaProperty(value: unknown): boolean {
  const pending = [value];
  while (pending.length > 0) {
    const current = pending.pop();
    if (Array.isArray(current)) {
      for (const entry of current) pending.push(entry);
      continue;
    }
    if (!isRecord(current)) continue;
    for (const [key, entry] of Object.entries(current)) {
      if (
        MEDIA_PROPERTY_NAMES.has(key) &&
        typeof entry === 'string' &&
        !isStablePublicMediaUrl(entry)
      )
        return true;
      pending.push(entry);
    }
  }
  return false;
}

function hasUnstableNavigationProperty(value: unknown): boolean {
  const pending: Array<{ parentKey?: string; value: unknown }> = [{ value }];
  while (pending.length > 0) {
    const current = pending.pop();
    if (!current) continue;
    if (Array.isArray(current.value)) {
      for (const entry of current.value)
        pending.push({ parentKey: current.parentKey, value: entry });
      continue;
    }
    if (!isRecord(current.value)) continue;
    for (const [key, entry] of Object.entries(current.value)) {
      if (
        typeof entry === 'string' &&
        (isNavigationPropertyName(key) ||
          current.parentKey === 'socialLinks') &&
        !isSafePublicReleaseUrl(entry)
      )
        return true;
      pending.push({ parentKey: key, value: entry });
    }
  }
  return false;
}

function hasOversizedCarousel(value: unknown): boolean {
  const pending = [value];
  while (pending.length > 0) {
    const current = pending.pop();
    if (Array.isArray(current)) {
      for (const entry of current) pending.push(entry);
      continue;
    }
    if (!isRecord(current)) continue;
    if (
      current.type === 'HeroCarousel' &&
      isRecord(current.props) &&
      Array.isArray(current.props.slides) &&
      current.props.slides.length > MAX_RELEASE_CAROUSEL_SLIDES
    )
      return true;
    for (const entry of Object.values(current)) pending.push(entry);
  }
  return false;
}

/** Published Puck data accepted by the deterministic release renderer. */
export const StorefrontPublishedConfigSchema = z
  .unknown()
  .superRefine((value, context) => {
    if (!builderPreviewCandidateConfigSchema.safeParse(value).success)
      context.addIssue({
        code: 'custom',
        message: 'Expected a bounded render-safe published Puck configuration',
      });
    if (!isRecord(value) || !hasPublishedRoot(value.root))
      context.addIssue({
        code: 'custom',
        message: 'Published Puck root must already be canonical',
      });
    if (containsRefusedComponent(value))
      context.addIssue({
        code: 'custom',
        message: 'Published Puck configuration contains a refused component',
      });
    if (hasUnstableMediaProperty(value))
      context.addIssue({
        code: 'custom',
        message: 'Published Puck media must use stable public URLs',
      });
    if (hasUnstableNavigationProperty(value))
      context.addIssue({
        code: 'custom',
        message: 'Published Puck links must use query-free public URLs',
      });
    if (hasOversizedCarousel(value))
      context.addIssue({
        code: 'custom',
        message: 'Published Puck carousels must contain at most five slides',
      });
  })
  .transform((value) => value as BuilderData);
