import { logger } from '@/lib/logger';
import { createClient } from '@/lib/supabase/admin';
import type { StalePaidStartCharge } from './stale-paid-start-charge';

export type VoidStalePaidQuizStartResult = {
  refunded: boolean;
  voided: boolean;
};

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

    const { data: customer, error: customerError } = await admin
      .from('customers')
      .select('id, loyalty_points')
      .eq('id', attempt.customer_id)
      .maybeSingle();

    if (customerError || !customer) {
      logger.error({
        attemptId: charge.attemptId,
        error: customerError,
        event: 'quiz_stale_paid_start_void',
        message:
          'Stale paid start could not be refunded: the customer row was not readable. Loyalty points need manual repair.',
        pointsSpent: charge.pointsSpent,
      });
    } else {
      const { error: refundError } = await admin
        .from('customers')
        .update({
          loyalty_points: (customer.loyalty_points ?? 0) + charge.pointsSpent,
        })
        .eq('id', customer.id);

      if (refundError) {
        logger.error({
          attemptId: charge.attemptId,
          customerId: customer.id,
          error: refundError,
          event: 'quiz_stale_paid_start_void',
          message:
            'Stale paid start refund failed. Loyalty points need manual repair.',
          pointsSpent: charge.pointsSpent,
        });
      } else {
        result.refunded = true;
      }
    }

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
