import type { SupabaseClient } from '@supabase/supabase-js';
import { JumiaApiError } from '@/lib/jumia/helpers';
import type { PendingFeedMapping } from '@/lib/jumia/jumia-feed-reconciliation-batch';
import { logger } from '@/lib/logger';
import { jumiaFeedReconciliation } from './jumia-feed-reconciliation';

type FeedLookupFailureResult =
  | {
      kind: 'continue';
      failed: number;
      status: 'NOT_FOUND' | 'ERROR';
      feedFailed: number;
    }
  | { kind: 'response'; response: Response };

function hasStatus(error: unknown, status: number): boolean {
  if (error instanceof JumiaApiError) return error.status === status;
  return (
    typeof error === 'object' &&
    error !== null &&
    'status' in error &&
    error.status === status
  );
}

/** Records a feed lookup failure without preventing later feeds from running. */
export async function handleJumiaFeedLookupFailure(args: {
  error: unknown;
  feedId: string;
  mappingsForFeed: PendingFeedMapping[];
  merchantId: string;
  supabase: SupabaseClient;
}): Promise<FeedLookupFailureResult> {
  const isPermanentLookupFailure = hasStatus(args.error, 404);
  if (isPermanentLookupFailure && args.mappingsForFeed.length > 0) {
    try {
      const failed = await jumiaFeedReconciliation.markMappingsAsFeedError(
        args.supabase,
        args.merchantId,
        args.mappingsForFeed,
        'Jumia product feed was not found'
      );
      logger.error({
        message: 'Failed to read Jumia feed status',
        error: args.error,
        feed_id: args.feedId,
      });
      return {
        kind: 'continue',
        failed,
        status: 'NOT_FOUND',
        feedFailed: args.mappingsForFeed.length,
      };
    } catch (markError) {
      logger.error({
        message: 'Failed to mark missing Jumia product feed',
        error: markError,
        feed_id: args.feedId,
      });
      return {
        kind: 'response',
        response: Response.json(
          { error: 'Failed to reconcile missing Jumia product feed' },
          { status: 500 }
        ),
      };
    }
  }

  logger.error({
    message: 'Failed to read Jumia feed status',
    error: args.error,
    feed_id: args.feedId,
  });
  return {
    kind: 'continue',
    failed: 0,
    status: 'ERROR',
    feedFailed: 0,
  };
}
