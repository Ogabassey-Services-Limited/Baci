import type { UserIdentity } from '@supabase/supabase-js';
import {
  getDeleteAccountErrorMessage,
  hasAppleProvider,
} from './account-deletion';

describe('account-deletion helpers', () => {
  describe('hasAppleProvider', () => {
    it('returns true when Apple provider is in app_metadata.providers', () => {
      const result = hasAppleProvider({
        app_metadata: { providers: ['email', 'apple'] },
        identities: [],
      });

      expect(result).toBe(true);
    });

    it('returns true when Apple provider is in identities', () => {
      const identities = [
        { provider: 'google' },
        { provider: 'apple' },
      ] as UserIdentity[];

      const result = hasAppleProvider({
        app_metadata: { providers: ['google'] },
        identities,
      });

      expect(result).toBe(true);
    });

    it('returns true when app_metadata.provider is apple (singular)', () => {
      const result = hasAppleProvider({
        app_metadata: { provider: 'apple', providers: [] },
        identities: [],
      });

      expect(result).toBe(true);
    });

    it('returns false when user is null', () => {
      expect(hasAppleProvider(null)).toBe(false);
    });

    it('returns false when user is undefined', () => {
      expect(hasAppleProvider(undefined)).toBe(false);
    });

    it('returns false when identities is undefined', () => {
      const result = hasAppleProvider({
        app_metadata: { providers: ['email'] },
        identities: undefined as unknown as UserIdentity[],
      });

      expect(result).toBe(false);
    });

    it('returns false when Apple provider is not present', () => {
      const result = hasAppleProvider({
        app_metadata: { providers: ['email', 'google'] },
        identities: [{ provider: 'google' } as UserIdentity],
      });

      expect(result).toBe(false);
    });
  });

  describe('getDeleteAccountErrorMessage', () => {
    it('returns session-expired message for auth errors', () => {
      const message = getDeleteAccountErrorMessage({
        message: 'Unauthorized: JWT expired',
      });

      expect(message).toBe(
        'Your session expired. Please sign in again and retry account deletion.'
      );
    });

    it('returns network guidance for timeout/network errors', () => {
      const message = getDeleteAccountErrorMessage({
        message: 'Network timeout while deleting account',
      });

      expect(message).toBe(
        "We couldn't reach the server. Check your connection and try again."
      );
    });

    it('returns network guidance for fetch failed errors', () => {
      const message = getDeleteAccountErrorMessage({
        message: 'TypeError: fetch failed',
      });

      expect(message).toBe(
        "We couldn't reach the server. Check your connection and try again."
      );
    });

    it('returns network guidance for connection refused errors', () => {
      const message = getDeleteAccountErrorMessage({
        message: 'ECONNREFUSED 127.0.0.1:54321',
      });

      expect(message).toBe(
        "We couldn't reach the server. Check your connection and try again."
      );
    });

    it('hides internal database errors behind a safe support message', () => {
      const message = getDeleteAccountErrorMessage({
        message:
          'update or delete on table "customers" violates foreign key constraint',
      });

      expect(message).toBe(
        'Account deletion is temporarily unavailable. Please contact support.'
      );
    });

    it('returns fallback for other unknown backend errors', () => {
      const message = getDeleteAccountErrorMessage({
        message: 'Something unexpected happened',
      });

      expect(message).toBe(
        'Unable to delete your account right now. Please try again.'
      );
    });

    it('returns fallback for unknown error shapes', () => {
      const message = getDeleteAccountErrorMessage({ unexpected: true });

      expect(message).toBe(
        'Unable to delete your account right now. Please try again.'
      );
    });

    it('handles string error input directly', () => {
      const message = getDeleteAccountErrorMessage('Unauthorized: JWT expired');

      expect(message).toBe(
        'Your session expired. Please sign in again and retry account deletion.'
      );
    });

    it('returns fallback for null error input', () => {
      const message = getDeleteAccountErrorMessage(null);

      expect(message).toBe(
        'Unable to delete your account right now. Please try again.'
      );
    });
  });
});
