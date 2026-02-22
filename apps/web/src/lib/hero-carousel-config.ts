import {
  HERO_CAROUSEL_FIELD_CANDIDATES,
  type HeroCarouselSlide,
} from '@baci/shared';

interface LooseRecord {
  [key: string]: unknown;
}

export type { HeroCarouselSlide } from '@baci/shared';

const DEFAULT_LINK = '/category/all';
const DEFAULT_CTA = 'Shop Now';
const HERO_BLOCK_TYPE_REGEX = /\bhero/i;
const HERO_FALLBACK_TYPE_REGEX = /(hero|carousel|slider)/i;

function asRecord(value: unknown): LooseRecord | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  return value as LooseRecord;
}

function pickString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function pickFirstString(values: unknown[]): string | null {
  for (const value of values) {
    const selected = pickString(value);
    if (selected) return selected;
  }

  return null;
}

function pickFromRecord(record: LooseRecord, candidates: readonly string[]) {
  return pickFirstString(candidates.map((field) => record[field]));
}

function normalizeSlideValue(
  slide: unknown,
  index: number
): HeroCarouselSlide | null {
  const record = asRecord(slide);
  if (!record) return null;

  const headline =
    pickFromRecord(record, HERO_CAROUSEL_FIELD_CANDIDATES.headline) ?? '';

  const description =
    pickFromRecord(record, HERO_CAROUSEL_FIELD_CANDIDATES.description) ?? '';

  const imageUrl =
    pickFromRecord(record, HERO_CAROUSEL_FIELD_CANDIDATES.image) ?? '';

  const cta =
    pickFromRecord(record, HERO_CAROUSEL_FIELD_CANDIDATES.cta) ?? DEFAULT_CTA;

  const link =
    pickFromRecord(record, HERO_CAROUSEL_FIELD_CANDIDATES.link) ?? DEFAULT_LINK;

  const id =
    pickFromRecord(record, HERO_CAROUSEL_FIELD_CANDIDATES.id) ??
    `slide-${index + 1}`;

  if (!headline && !description && !imageUrl) return null;

  return {
    id,
    imageUrl,
    headline,
    description,
    cta,
    link,
  };
}

function normalizeSlides(rawSlides: unknown): HeroCarouselSlide[] {
  if (!Array.isArray(rawSlides)) return [];

  return rawSlides
    .map((slide, index) => normalizeSlideValue(slide, index))
    .filter((slide): slide is HeroCarouselSlide => slide !== null);
}

function findHeroBlockWithSlides(content: unknown[]): {
  index: number;
  slides: HeroCarouselSlide[];
} | null {
  let firstBlockWithSlides: {
    index: number;
    slides: HeroCarouselSlide[];
    blockType: string;
  } | null = null;

  for (let index = 0; index < content.length; index++) {
    const block = asRecord(content[index]);
    if (!block) continue;

    const props = asRecord(block.props);
    if (!props) continue;

    const slides = normalizeSlides(props.slides);
    if (slides.length === 0) continue;

    const blockType = pickString(block.type) ?? '';
    if (HERO_BLOCK_TYPE_REGEX.test(blockType)) {
      return { index, slides };
    }

    if (!firstBlockWithSlides && HERO_FALLBACK_TYPE_REGEX.test(blockType)) {
      firstBlockWithSlides = { index, slides, blockType };
    }
  }

  if (firstBlockWithSlides) {
    if (!HERO_BLOCK_TYPE_REGEX.test(firstBlockWithSlides.blockType)) {
      console.warn(
        `[hero-carousel-config] Using fallback hero-like block at index ${firstBlockWithSlides.index} with type "${firstBlockWithSlides.blockType}".`
      );
    }

    return {
      index: firstBlockWithSlides.index,
      slides: firstBlockWithSlides.slides,
    };
  }

  return null;
}

function findHeroBlockIndex(content: unknown[]): number {
  for (let index = 0; index < content.length; index++) {
    const block = asRecord(content[index]);
    if (!block) continue;

    const blockType = pickString(block.type) ?? '';
    if (HERO_BLOCK_TYPE_REGEX.test(blockType)) {
      return index;
    }
  }

  return -1;
}

export function extractHeroSlidesFromPageConfig(
  config: unknown
): HeroCarouselSlide[] {
  const configRecord = asRecord(config);
  if (!configRecord) return [];

  const content = Array.isArray(configRecord.content)
    ? configRecord.content
    : [];
  const heroBlock = findHeroBlockWithSlides(content);

  return heroBlock?.slides ?? [];
}

function toBuilderSlide(slide: HeroCarouselSlide): LooseRecord {
  return {
    id: slide.id,
    title: slide.headline,
    subtitle: slide.description,
    image: slide.imageUrl,
    ctaText: slide.cta,
    ctaLink: slide.link,
    // Keep legacy keys for backward compatibility across templates.
    headline: slide.headline,
    description: slide.description,
    imageUrl: slide.imageUrl,
    cta: slide.cta,
    link: slide.link,
  };
}

export function upsertHeroSlidesIntoPageConfig(
  config: unknown,
  slides: HeroCarouselSlide[]
): LooseRecord {
  const normalizedConfig = asRecord(config) ?? {};
  const rawContent = Array.isArray(normalizedConfig.content)
    ? [...normalizedConfig.content]
    : [];

  const mappedSlides = slides.map(toBuilderSlide);
  const heroBlockIndex = findHeroBlockIndex(rawContent);

  if (heroBlockIndex >= 0) {
    const currentBlock = asRecord(rawContent[heroBlockIndex]) ?? {};
    const currentProps = asRecord(currentBlock.props) ?? {};

    rawContent[heroBlockIndex] = {
      ...currentBlock,
      props: {
        ...currentProps,
        slides: mappedSlides,
      },
    };
  } else {
    rawContent.unshift({
      type: 'HeroCarousel',
      props: {
        id: 'hero-carousel-managed',
        slides: mappedSlides,
        autoplayDelay: 5000,
      },
    });
  }

  return {
    ...normalizedConfig,
    content: rawContent,
  };
}

/**
 * Normalize raw slide data into clean {@link HeroCarouselSlide} objects ready
 * for database storage. Delegates to {@link normalizeSlideValue} internally,
 * which already applies default values for `id`, `cta`, and `link`.
 * The shallow copy (spread) ensures callers receive detached objects.
 */
export function normalizeHeroSlidesForStorage(
  input: unknown
): HeroCarouselSlide[] {
  return normalizeSlides(input).map((slide) => ({ ...slide }));
}

/**
 * Compare two HeroCarouselSlide arrays for content drift.
 * This intentionally ignores `id` because it checks content equivalence only,
 * using `imageUrl`, `headline`, `description`, `cta`, and `link`.
 */
export function areHeroSlidesEquivalent(
  first: HeroCarouselSlide[],
  second: HeroCarouselSlide[]
): boolean {
  if (first.length !== second.length) return false;

  for (let index = 0; index < first.length; index++) {
    const a = first[index];
    const b = second[index];

    if (!a || !b) return false;

    if (
      a.imageUrl !== b.imageUrl ||
      a.headline !== b.headline ||
      a.description !== b.description ||
      a.cta !== b.cta ||
      a.link !== b.link
    ) {
      return false;
    }
  }

  return true;
}

export function hasHeroSlidesInPageConfig(config: unknown): boolean {
  return extractHeroSlidesFromPageConfig(config).length > 0;
}
