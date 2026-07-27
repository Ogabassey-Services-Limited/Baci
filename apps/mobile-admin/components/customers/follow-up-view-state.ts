interface FollowUpViewStateInput {
  hasMerchant: boolean;
  isMerchantLoading: boolean;
  merchantError: Error | null;
  isFollowUpLoading: boolean;
  isFollowUpError: boolean;
  followUpCount: number;
}

export type FollowUpViewState =
  | { status: 'loading' }
  | { status: 'ready' }
  | { status: 'empty' }
  | { status: 'error'; title: string; message: string };

/**
 * Keeps unavailable Follow Up data distinct from a successfully empty queue.
 * The query is disabled until a merchant id exists, so undefined query data
 * cannot by itself mean that all recent transactions succeeded.
 */
export function getFollowUpViewState({
  hasMerchant,
  isMerchantLoading,
  merchantError,
  isFollowUpLoading,
  isFollowUpError,
  followUpCount,
}: FollowUpViewStateInput): FollowUpViewState {
  if (followUpCount > 0) {
    return { status: 'ready' };
  }

  if (isMerchantLoading || isFollowUpLoading) {
    return { status: 'loading' };
  }

  if (merchantError) {
    return {
      status: 'error',
      title: 'Failed to load store',
      message:
        'We could not load your store context for this account. Try again or sign in again if the issue persists.',
    };
  }

  if (!hasMerchant) {
    return {
      status: 'error',
      title: 'Store unavailable',
      message:
        'No merchant account is linked to this session right now. Refresh the screen or sign in again.',
    };
  }

  if (isFollowUpError) {
    return {
      status: 'error',
      title: "Couldn't load follow-ups",
      message:
        "We couldn't check for unsuccessful transactions. This does not mean there are none.",
    };
  }

  return { status: 'empty' };
}
