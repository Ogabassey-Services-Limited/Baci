import { describe, expect, it } from 'vitest';
import { NetworkError } from '@/lib/api-errors';
import { resolveRegistrationErrorAlert } from './registration-error-alert';

describe('resolveRegistrationErrorAlert', () => {
  it('offers a different store URL for a slug conflict, not a login', () => {
    // Arrange
    const error = new NetworkError('taken', {
      statusCode: 409,
      data: { code: 'slug_unavailable' },
    });

    // Act
    const alert = resolveRegistrationErrorAlert(error);

    // Assert — "go to login" would be the wrong recovery here.
    expect(alert.title).toBe('Store URL Unavailable');
    expect(alert.buttons).toEqual([]);
  });

  it('offers a login action for a plain account conflict', () => {
    // Arrange
    const error = new NetworkError('exists', { statusCode: 409 });

    // Act
    const alert = resolveRegistrationErrorAlert(error);

    // Assert
    expect(alert.title).toBe('Account Exists');
    expect(alert.buttons).toEqual([
      { text: 'Go to Login', action: 'login' },
      { text: 'OK', action: 'dismiss', style: 'cancel' },
    ]);
  });

  it('does not offer navigation while rate limited', () => {
    // Arrange
    const error = new NetworkError('slow down', { statusCode: 429 });

    // Act
    const alert = resolveRegistrationErrorAlert(error);

    // Assert
    expect(alert.title).toBe('Too Many Attempts');
    expect(alert.buttons).toEqual([]);
  });

  describe('bugfix: a 500 after the account existed was a dead end', () => {
    it('routes to sign-in when the account exists but the store did not provision', () => {
      // Arrange
      const error = new NetworkError('Your account was created…', {
        statusCode: 500,
        data: { code: 'account_created_store_setup_failed' },
      });

      // Act
      const alert = resolveRegistrationErrorAlert(error);

      // Assert
      expect(alert.title).toBe('Finish Setting Up');
      expect(alert.buttons).toEqual([{ text: 'Sign In', action: 'login' }]);
    });

    it('falls back to its own copy when the server sent no message', () => {
      // Arrange
      const error = new NetworkError('', {
        statusCode: 500,
        data: { code: 'account_created_store_setup_failed' },
      });

      // Act
      const alert = resolveRegistrationErrorAlert(error);

      // Assert
      expect(alert.message).toMatch(/sign in/i);
    });
  });

  describe('connectivity', () => {
    it('explains a timeout instead of echoing the raw error', () => {
      // Arrange
      const error = new NetworkError('aborted', { isTimeout: true });

      // Act
      const alert = resolveRegistrationErrorAlert(error);

      // Assert
      expect(alert.title).toBe('Registration Failed');
      expect(alert.message).toMatch(/taking too long/i);
    });

    it('explains being offline', () => {
      // Arrange
      const error = new NetworkError('failed', { isOffline: true });

      // Act
      const alert = resolveRegistrationErrorAlert(error);

      // Assert
      expect(alert.message).toMatch(/internet connection/i);
    });

    it('falls back to generic copy for an error with no message', () => {
      // Act
      const alert = resolveRegistrationErrorAlert(new Error(''));

      // Assert
      expect(alert.title).toBe('Registration Failed');
      expect(alert.message).toBe('Please try again later.');
    });
  });
});
