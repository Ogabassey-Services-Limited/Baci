'use server';

import { z } from 'zod';
import { getRecoveryCodePepper } from '@/env';
import { issueRecoveryCodes } from '@/lib/auth/recovery-code-issuance';
import { createRecoveryCodeStore } from '@/lib/auth/recovery-code-store';
import { ensureActionRateLimit } from '@/lib/ensure-action-rate-limit';
import { createClient } from '@/lib/supabase/server';

export type GenerateRecoveryCodesResult =
  | { ok: true; codes: string[]; codeSetId: string }
  | { ok: false; error: string };

export type AcknowledgeRecoveryCodesResult =
  | { ok: true }
  | { ok: false; error: string };

export type RecoveryCodesStatus = { count: number };

const codeSetIdSchema = z.string().uuid();

/**
 * Authenticated merchant action: generate a fresh recovery-code set and return
 * the plaintext codes ONCE for display. Hashes only are persisted. The current
 * acknowledged set remains valid until the merchant acknowledges this new set.
 */
export async function generateRecoveryCodesAction(): Promise<GenerateRecoveryCodesResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return {
      ok: false,
      error: 'You must be signed in to generate recovery codes.',
    };
  }

  const allowed = await ensureActionRateLimit('recovery-codes-generate', {
    requests: 5,
    windowMs: 60_000,
  });
  if (!allowed) {
    return {
      ok: false,
      error: 'Too many attempts. Please try again in a minute.',
    };
  }

  try {
    const { codes, codeSetId } = await issueRecoveryCodes({
      userId: user.id,
      pepper: getRecoveryCodePepper(),
      store: createRecoveryCodeStore(),
    });

    return { ok: true, codes, codeSetId };
  } catch {
    return {
      ok: false,
      error: 'Could not generate recovery codes. Please try again.',
    };
  }
}

/**
 * Records that the merchant has saved the given recovery-code set. Auth is
 * intentionally first; validation and store access happen only after a session
 * exists.
 */
export async function acknowledgeRecoveryCodesAction(
  codeSetId: string
): Promise<AcknowledgeRecoveryCodesResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: 'You must be signed in.' };
  }

  const allowed = await ensureActionRateLimit('recovery-codes-acknowledge', {
    requests: 10,
    windowMs: 60_000,
  });
  if (!allowed) {
    return {
      ok: false,
      error: 'Too many attempts. Please try again in a minute.',
    };
  }

  const parsedCodeSetId = codeSetIdSchema.safeParse(codeSetId);
  if (!parsedCodeSetId.success) {
    return { ok: false, error: 'Invalid code set.' };
  }

  try {
    const acknowledged = await createRecoveryCodeStore().acknowledgeCodeSet(
      user.id,
      parsedCodeSetId.data
    );
    if (!acknowledged) {
      return { ok: false, error: 'Invalid or expired code set.' };
    }
    return { ok: true };
  } catch {
    return {
      ok: false,
      error: 'Could not save recovery codes. Please try again.',
    };
  }
}

/** Number of unused recovery codes the signed-in merchant has remaining. */
export async function getRecoveryCodesStatusAction(): Promise<RecoveryCodesStatus> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { count: 0 };
  }

  try {
    const store = createRecoveryCodeStore();
    const codeSetId = await store.getActiveCodeSetId(user.id);
    if (!codeSetId) {
      return { count: 0 };
    }

    const codes = await store.listActiveCodes(user.id, codeSetId);
    return { count: codes.length };
  } catch {
    return { count: 0 };
  }
}
