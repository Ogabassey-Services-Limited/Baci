import { logger } from '@/lib/logger';
import { createClient } from '@/lib/supabase/admin';
import type { StalePaidStartCharge } from './stale-paid-start-charge';

export type VoidStalePaidQuizStartResult = {
  refunded: boolean;
  voided: boolean;
};

/**
 * A blind `loyalty_points = <read value> + spent` write would clobber any
 * concurrent balance change (a redemption, a purchase award) that landed between
 * the read and the write — a lost update on a wallet-like balance.
 *
 * There is no atomic-increment RPC we can rely on here: this path only runs when
 * the free-entry migration has NOT applied, so any RPC shipped alongside it is
 * by definition absent. Instead, do a compare-and-swap — update only while the
 * balance still equals what we read. If another writer beat us, PostgREST
 * matches no row and we re-read and retry.
 */
const REFUND_CAS_ATTEMPTS = 3;

async function refundLoyaltyPoints(
  admin: ReturnType<typeof createClient>,
  customerId: string,
  charge: StalePaidStartCharge
): Promise<boolean> {
  for (let attempt = 0; attempt < REFUND_CAS_ATTEMPTS; attempt++) {
    const { data: customer, error: customerError } = await admin
      .from('customers')
      .select('id, loyalty_points')
      .eq('id', customerId)
      .maybeSingle();

    if (customerError || !customer) {
      logger.error({
        attemptId: charge.attemptId,
        customerId,
        error: customerError,
        event: 'quiz_stale_paid_start_void',
        message:
          'Stale paid start could not be refunded: the customer row was not readable. Loyalty points need manual repair.',
        pointsSpent: charge.pointsSpent,
      });
      return false;
    }

    const currentPoints = customer.loyalty_points;

    // Guard on the exact value we read. `.eq` never matches NULL in SQL, so a
    // null balance has to be matched with `.is` instead.
    const guarded =
      currentPoints === null
        ? admin
            .from('customers')
            .update({ loyalty_points: charge.pointsSpent })
            .eq('id', customerId)
            .is('loyalty_points', null)
        : admin
            .from('customers')
            .update({ loyalty_points: currentPoints + charge.pointsSpent })
            .eq('id', customerId)
            .eq('loyalty_points', currentPoints);

    const { data: updated, error: refundError } = await guarded.select('id');

    if (refundError) {
      logger.error({
        attemptId: charge.attemptId,
        customerId,
        error: refundError,
        event: 'quiz_stale_paid_start_void',
        message:
          'Stale paid start refund failed. Loyalty points need manual repair.',
        pointsSpent: charge.pointsSpent,
      });
      return false;
    }

    if (updated && updated.length > 0) {
      return true;
    }

    // Lost the race: the balance moved under us. Re-read and try again.
  }

  logger.error({
    attemptId: charge.attemptId,
    customerId,
    event: 'quiz_stale_paid_start_void',
    message:
      'Stale paid start refund lost the compare-and-swap race repeatedly. Loyalty points need manual repair.',
    pointsSpent: charge.pointsSpent,
  });
  return false;
}

/**
 * Compensates a quiz start that the stale PAID entry RPC already charged.
 *
 * The route cannot know the database is stale until the RPC has already run and
 * debited the point, so the charge is undone after the fact:
 *
 *   1. Refund the loyalty points the old RPC deducted.
 *   2. Delete the attempt row, so the refused start does not also burn one of
 *      the player's limited attempts. `quiz_attempt_questions` and the other
 *      attempt-scoped rows cascade.
 *
 * Requires the service-role client: `customers.loyalty_points` is deliberately
 * not writable by the customer's own RLS-scoped session, and this is trusted
 * server-only repair, not a user-facing operation.
 *
 * Never throws. The caller must fail closed (503) regardless of whether the
 * compensation succeeded — a failure here is a point that needs manual repair,
 * not a reason to hand the player a charged attempt.
 */
export async function voidStalePaidQuizStart(
  charge: StalePaidStartCharge
): Promise<VoidStalePaidQuizStartResult> {
  const result: VoidStalePaidQuizStartResult = {
    refunded: false,
    voided: false,
  };

  if (!charge.attemptId) {
    logger.error({
      event: 'quiz_stale_paid_start_void',
      message:
        'Stale paid start could not be refunded: the RPC payload carried no attempt id. Loyalty points need manual repair.',
      pointsSpent: charge.pointsSpent,
    });
    return result;
  }

  try {
    const admin = createClient();

    const { data: attempt, error: attemptError } = await admin
      .from('quiz_attempts')
      .select('id, customer_id')
      .eq('id', charge.attemptId)
      .maybeSingle();

    if (attemptError || !attempt) {
      logger.error({
        attemptId: charge.attemptId,
        error: attemptError,
        event: 'quiz_stale_paid_start_void',
        message:
          'Stale paid start could not be refunded: the attempt row was not readable. Loyalty points need manual repair.',
        pointsSpent: charge.pointsSpent,
      });
      return result;
    }

    result.refunded = await refundLoyaltyPoints(
      admin,
      attempt.customer_id,
      charge
    );

    const { error: deleteError } = await admin
      .from('quiz_attempts')
      .delete()
      .eq('id', charge.attemptId);

    if (deleteError) {
      logger.error({
        attemptId: charge.attemptId,
        error: deleteError,
        event: 'quiz_stale_paid_start_void',
        message:
          'Stale paid start attempt row could not be deleted. It will count against the player attempt cap until repaired.',
      });
    } else {
      result.voided = true;
    }
  } catch (error) {
    logger.error({
      attemptId: charge.attemptId,
      error,
      event: 'quiz_stale_paid_start_void',
      message:
        'Stale paid start compensation threw. Loyalty points need manual repair.',
      pointsSpent: charge.pointsSpent,
    });
  }

  return result;
}
