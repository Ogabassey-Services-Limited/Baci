import { describe, expect, it } from 'vitest';
import { getErrorMessage, normalizeSafeLinkUrl } from './useBlogEditor.helpers';

describe('useBlogEditor helpers', () => {
  it('reads error messages from Error and error-like objects', () => {
    expect(getErrorMessage(new Error('Boom'), 'Fallback')).toBe('Boom');
    expect(getErrorMessage({ message: 'Server said no' }, 'Fallback')).toBe(
      'Server said no'
    );
    expect(getErrorMessage({ message: '' }, 'Fallback')).toBe('Fallback');
  });

  it('normalizes safe links and rejects unsupported protocols', () => {
    expect(normalizeSafeLinkUrl('example.com/path')).toBe(
      'https://example.com/path'
    );
    expect(normalizeSafeLinkUrl('https://example.com/path')).toBe(
      'https://example.com/path'
    );
    expect(normalizeSafeLinkUrl('javascript:alert(1)')).toBeNull();
    expect(normalizeSafeLinkUrl('')).toBeNull();
  });
});
