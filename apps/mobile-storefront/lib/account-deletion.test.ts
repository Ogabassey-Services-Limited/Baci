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

    it('returns original message for non-auth errors', () => {
      const message = getDeleteAccountErrorMessage({
        message: 'Deletion failed due to database timeout',
      });

      expect(message).toBe('Deletion failed due to database timeout');
    });

    it('returns fallback for unknown error shapes', () => {
      const message = getDeleteAccountErrorMessage({ unexpected: true });

      expect(message).toBe(
        'Unable to delete your account right now. Please try again.'
      );
    });
  });
});
