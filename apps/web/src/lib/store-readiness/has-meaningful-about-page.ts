import { OGABASSEY_TEMPLATE_ID } from '@/config/templates';
import { unknownValueGuards } from '@/lib/unknown-value-guards';
import { getVideoEmbedUrl } from '@/lib/video-embed';

function hasText(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function hasTextList(value: unknown): boolean {
  return Array.isArray(value) && value.some(hasText);
}

function hasMeaningfulRecordList(
  value: unknown,
  hasMeaningfulRecord: (record: Record<string, unknown>) => boolean
): boolean {
  return (
    Array.isArray(value) &&
    value.some(
      (entry) =>
        unknownValueGuards.isRecord(entry) && hasMeaningfulRecord(entry)
    )
  );
}

function hasMeaningfulTeamMember(member: Record<string, unknown>): boolean {
  if (
    ['name', 'role', 'bio', 'image'].some((field) => hasText(member[field]))
  ) {
    return true;
  }

  return (
    unknownValueGuards.isRecord(member.social_links) &&
    hasText(member.social_links.linkedin)
  );
}

function hasMeaningfulMilestone(milestone: Record<string, unknown>): boolean {
  return ['title', 'description'].some((field) => hasText(milestone[field]));
}

function hasMeaningfulAward(award: Record<string, unknown>): boolean {
  return ['title', 'issuer'].some((field) => hasText(award[field]));
}

function hasMeaningfulSocialProof(value: unknown): boolean {
  if (!unknownValueGuards.isRecord(value)) return false;

  return [
    value.years_in_business,
    value.customers_served,
    value.products_sold,
    value.rating,
  ].some(
    (stat) => typeof stat === 'number' && Number.isFinite(stat) && stat > 0
  );
}

/**
 * Matches the structured sections the active storefront About page can
 * visibly render. Empty JSON objects and arrays do not satisfy readiness.
 */
export function hasMeaningfulAboutPage(
  value: unknown,
  templateId?: string | null
): boolean {
  if (!unknownValueGuards.isRecord(value)) return false;

  if (templateId === OGABASSEY_TEMPLATE_ID) {
    return ['headline', 'story', 'image_url'].some((field) =>
      hasText(value[field])
    );
  }

  if (
    ['story', 'mission', 'vision', 'founder_name'].some((field) =>
      hasText(value[field])
    )
  ) {
    return true;
  }

  if (
    hasTextList(value.values) ||
    hasMeaningfulRecordList(value.team, hasMeaningfulTeamMember) ||
    hasMeaningfulRecordList(value.milestones, hasMeaningfulMilestone) ||
    hasMeaningfulRecordList(value.awards, hasMeaningfulAward) ||
    hasMeaningfulSocialProof(value.social_proof) ||
    hasTextList(value.gallery)
  ) {
    return true;
  }

  return hasText(value.video_url) && Boolean(getVideoEmbedUrl(value.video_url));
}
