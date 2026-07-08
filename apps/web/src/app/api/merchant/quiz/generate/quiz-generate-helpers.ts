import crypto from 'node:crypto';
import { type NextRequest, NextResponse } from 'next/server';
import {
  authenticateApiRequest,
  getUserAccess,
  hasPermission,
} from '@/lib/api-auth';
import { checkCsrfProtection } from '@/lib/csrf';
import type { GeneratedQuizQuestion } from '@/schemas/quiz';

export type QuizSupabaseClient = NonNullable<
  Awaited<ReturnType<typeof authenticateApiRequest>>['supabase']
>;

export type SlotRow = {
  active: true;
  category: string | null;
  difficulty: GeneratedQuizQuestion['difficulty'];
  id: string;
  slot_index: number;
};

export type QuizDraftEvent = {
  id: string;
  slug: string;
  status: string;
  title: string;
};

type MerchantNameRow = {
  business_name: string | null;
  slug: string | null;
};

export type MerchantQuizContext = {
  displayName: string;
  slug: string | null;
};

export type PrizeProductRow = {
  default_variant_id: string | null;
  id: string;
  images: Array<string | { url?: string | null }> | null;
  name: string;
};

export function slugifyTitle(title: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  const baseSlug = slug || 'quiz';
  return `${baseSlug}-${crypto.randomBytes(4).toString('hex')}`;
}

export function hashAnswerKey(answer: string): string {
  return crypto
    .createHash('sha256')
    .update(answer.trim().toLowerCase())
    .digest('hex');
}

export function createSlotRows(questions: GeneratedQuizQuestion[]): SlotRow[] {
  return questions.map((question, index) => ({
    active: true,
    category: question.topic,
    difficulty: question.difficulty,
    id: crypto.randomUUID(),
    slot_index: index + 1,
  }));
}

export function createVariantRows(
  questions: GeneratedQuizQuestion[],
  slots: SlotRow[]
) {
  const slotsByIndex = new Map(slots.map((slot) => [slot.slot_index, slot]));

  return questions.map((question, index) => {
    const slot = slotsByIndex.get(index + 1);
    if (!slot) {
      throw new Error('Quiz slot creation returned an incomplete result');
    }

    return {
      active: true,
      answer_key_hash: hashAnswerKey(question.correctOptionId),
      explanation: question.explanation,
      options: question.options,
      prompt: question.prompt,
      slot_id: slot.id,
      variant_key: `gemma-${index + 1}`,
    };
  });
}

export function isQuizDraftEvent(value: unknown): value is QuizDraftEvent {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const event = value as Record<string, unknown>;
  return (
    typeof event.id === 'string' &&
    typeof event.slug === 'string' &&
    typeof event.status === 'string' &&
    typeof event.title === 'string'
  );
}

export async function resolveMerchantQuizContext(
  supabase: QuizSupabaseClient,
  merchantId: string
): Promise<MerchantQuizContext> {
  const { data, error } = await supabase
    .from('merchants')
    .select('business_name, slug')
    .eq('id', merchantId)
    .maybeSingle();

  if (error) {
    console.error('Merchant display name lookup failed:', error.message);
    return { displayName: merchantId, slug: null };
  }

  const merchant = data as MerchantNameRow | null;
  return {
    displayName:
      merchant?.business_name?.trim() || merchant?.slug?.trim() || merchantId,
    slug: merchant?.slug?.trim().toLowerCase() || null,
  };
}

export async function resolvePrizeProduct(
  supabase: QuizSupabaseClient,
  merchantId: string,
  productId: string
): Promise<PrizeProductRow | null> {
  const { data, error } = await supabase
    .from('products')
    .select('id, name, images, default_variant_id')
    .eq('id', productId)
    .eq('merchant_id', merchantId)
    .eq('status', 'active')
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  const product = data as Partial<PrizeProductRow>;
  if (
    typeof product.id !== 'string' ||
    typeof product.name !== 'string' ||
    product.name.trim().length === 0
  ) {
    return null;
  }

  return {
    default_variant_id:
      typeof product.default_variant_id === 'string'
        ? product.default_variant_id
        : null,
    id: product.id,
    images: Array.isArray(product.images) ? product.images : null,
    name: product.name.trim(),
  };
}

// Opens a merchant-owned DRAFT quiz. Activation is deliberately a separate,
// confirmed admin action performed AFTER the AI answer key is reviewed, so it
// never runs implicitly as part of question generation.
export async function activateMerchantQuizDraft(
  supabase: QuizSupabaseClient,
  eventId: string,
  merchantId: string
): Promise<QuizDraftEvent | null> {
  const { data, error } = await supabase
    .from('quiz_events')
    .update({
      ends_at: null,
      starts_at: new Date().toISOString(),
      status: 'active',
    })
    .eq('id', eventId)
    .eq('merchant_id', merchantId)
    .eq('status', 'draft')
    .select('id, slug, status, title')
    .single();

  if (error || !isQuizDraftEvent(data)) {
    return null;
  }

  return data;
}

export type MerchantAuthContext = {
  merchantDisplayName: string;
  merchantId: string;
  supabase: QuizSupabaseClient;
};

/**
 * Shared auth+CSRF+permission gate for the merchant quiz routes (generation and
 * activation). Returns a ready-to-return NextResponse on any failure, or the
 * resolved merchant context. Extracted so `generate` and `activate` are
 * distinct API paths — the proxy rate-limits by path, and activation must not
 * consume the expensive-generation throttle.
 */
export async function authorizeMerchantQuizRequest(
  request: NextRequest
): Promise<MerchantAuthContext | NextResponse> {
  const auth = await authenticateApiRequest(request);
  if (auth.error || !auth.user || !auth.supabase) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const csrf = await checkCsrfProtection(request);
  if (!csrf.valid) {
    return (
      csrf.response ??
      NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    );
  }

  const access = await getUserAccess(auth.supabase);
  if (!access) {
    return NextResponse.json({ error: 'Merchant not found' }, { status: 404 });
  }

  if (!hasPermission(access, 'marketing', 'edit')) {
    return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
  }

  const merchantContext = await resolveMerchantQuizContext(
    auth.supabase,
    access.merchantId
  );
  if (merchantContext.slug !== 'ogabassey') {
    return NextResponse.json(
      { error: 'Quiz generation is only available for Ogabassey' },
      { status: 403 }
    );
  }

  return {
    merchantDisplayName: merchantContext.displayName,
    merchantId: access.merchantId,
    supabase: auth.supabase,
  };
}
