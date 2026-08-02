import { describe, expect, it } from 'vitest';
import { getFollowUpViewState } from './follow-up-view-state';

describe('getFollowUpViewState', () => {
  it('returns loading while merchant context is unresolved', () => {
    expect(
      getFollowUpViewState({
        followUpCount: 0,
        hasMerchant: false,
        isFollowUpError: false,
        isFollowUpLoading: false,
        isMerchantLoading: true,
        merchantError: null,
      })
    ).toEqual({ status: 'loading' });
  });

  it('returns a store error when merchant context failed', () => {
    expect(
      getFollowUpViewState({
        followUpCount: 0,
        hasMerchant: false,
        isFollowUpError: false,
        isFollowUpLoading: false,
        isMerchantLoading: false,
        merchantError: new Error('merchant failed'),
      })
    ).toEqual({
      status: 'error',
      title: 'Failed to load store',
      message:
        'We could not load your store context for this account. Try again or sign in again if the issue persists.',
    });
  });

  it('returns a store unavailable error when no merchant is linked', () => {
    expect(
      getFollowUpViewState({
        followUpCount: 0,
        hasMerchant: false,
        isFollowUpError: false,
        isFollowUpLoading: false,
        isMerchantLoading: false,
        merchantError: null,
      })
    ).toEqual({
      status: 'error',
      title: 'Store unavailable',
      message:
        'No merchant account is linked to this session right now. Refresh the screen or sign in again.',
    });
  });

  it('keeps cached follow-ups visible when merchant context refresh fails', () => {
    expect(
      getFollowUpViewState({
        followUpCount: 2,
        hasMerchant: false,
        isFollowUpError: false,
        isFollowUpLoading: false,
        isMerchantLoading: false,
        merchantError: new Error('merchant refresh failed'),
      })
    ).toEqual({ status: 'ready' });
  });

  it('returns empty only after merchant and follow-up queries succeeded', () => {
    expect(
      getFollowUpViewState({
        followUpCount: 0,
        hasMerchant: true,
        isFollowUpError: false,
        isFollowUpLoading: false,
        isMerchantLoading: false,
        merchantError: null,
      })
    ).toEqual({ status: 'empty' });
  });
});
