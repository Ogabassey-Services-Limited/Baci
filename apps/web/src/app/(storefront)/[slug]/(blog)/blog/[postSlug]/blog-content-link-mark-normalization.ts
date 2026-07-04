import {
  type NormalizeStorefrontContentHrefOptions,
  normalizeStorefrontContentHref,
} from '@/lib/storefront-link-normalization';

/**
 * Server-side normalization of TipTap link marks inside structured blog
 * content: canonicalizes internal hrefs (legacy aliases, merchant prefixes,
 * tracking params) and strips `nofollow` from rel tokens so internal links
 * pass equity. Returns the same object identity when nothing changed so
 * cached content is not re-serialized needlessly.
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function stripNofollowToken(rel: string): string {
  return rel
    .split(/\s+/)
    .filter((token) => token && token.toLowerCase() !== 'nofollow')
    .join(' ');
}

function normalizeBlogContentLinkMark(
  mark: unknown,
  options: NormalizeStorefrontContentHrefOptions
): unknown {
  if (!isRecord(mark) || mark.type !== 'link' || !isRecord(mark.attrs)) {
    return mark;
  }

  const rawHref = mark.attrs.href;
  if (typeof rawHref !== 'string') {
    return mark;
  }

  const normalizedHref = normalizeStorefrontContentHref(rawHref, options);
  const nextAttrs: Record<string, unknown> = { ...mark.attrs };
  let changed = false;

  if (normalizedHref !== rawHref) {
    nextAttrs.href = normalizedHref;
    changed = true;
  }

  if (typeof nextAttrs.rel === 'string') {
    const normalizedRel = stripNofollowToken(nextAttrs.rel);
    if (normalizedRel) {
      if (normalizedRel !== nextAttrs.rel) {
        nextAttrs.rel = normalizedRel;
        changed = true;
      }
    } else {
      delete nextAttrs.rel;
      changed = true;
    }
  }

  return changed ? { ...mark, attrs: nextAttrs } : mark;
}

export function normalizeBlogContentLinks(
  content: unknown,
  options: NormalizeStorefrontContentHrefOptions
): unknown {
  if (!isRecord(content)) {
    return content;
  }

  const nextContent: Record<string, unknown> = { ...content };
  let changed = false;

  if (Array.isArray(content.content)) {
    const normalizedChildren = content.content.map((child) => {
      const normalizedChild = normalizeBlogContentLinks(child, options);
      changed ||= normalizedChild !== child;
      return normalizedChild;
    });

    if (changed) {
      nextContent.content = normalizedChildren;
    }
  }

  if (Array.isArray(content.marks)) {
    let marksChanged = false;
    const normalizedMarks = content.marks.map((mark) => {
      const normalizedMark = normalizeBlogContentLinkMark(mark, options);
      marksChanged ||= normalizedMark !== mark;
      return normalizedMark;
    });

    if (marksChanged) {
      nextContent.marks = normalizedMarks;
      changed = true;
    }
  }

  return changed ? nextContent : content;
}
