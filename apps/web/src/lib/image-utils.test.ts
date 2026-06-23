import { describe, expect, it } from 'vitest';
import { isExternalPlaceholderImageUrl, isValidImageUrl } from './image-utils';

describe('isValidImageUrl', () => {
  it('should return true for valid absolute HTTPS URLs', () => {
    expect(isValidImageUrl('https://example.com/image.jpg')).toBe(true);
  });

  it('should return true for valid absolute HTTP URLs', () => {
    expect(isValidImageUrl('http://example.com/image.jpg')).toBe(true);
  });

  it('should return false for relative URLs', () => {
    // new URL('/foo') throws, so isValidImageUrl should return false
    expect(isValidImageUrl('/images/logo.png')).toBe(false);
  });

  it('should return true for data URLs', () => {
    expect(
      isValidImageUrl(
        'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII='
      )
    ).toBe(true);
  });

  it('should return false for invalid strings', () => {
    expect(isValidImageUrl('not-a-url')).toBe(false);
    expect(isValidImageUrl('example.com/image.jpg')).toBe(false); // Missing protocol
    expect(isValidImageUrl('https://')).toBe(false); // Incomplete
    expect(isValidImageUrl('http://')).toBe(false); // Incomplete
    expect(isValidImageUrl('//example.com/path')).toBe(false); // Protocol-relative URL
    // data:image/png is technically a valid URL structure (protocol:path), though not a useful image.
    // Since we rely on new URL() validation, we expect true.
    expect(isValidImageUrl('data:image/png')).toBe(true);
  });

  it('should return false for null or undefined', () => {
    expect(isValidImageUrl(null)).toBe(false);
    expect(isValidImageUrl(undefined)).toBe(false);
  });

  it('should return false for empty string', () => {
    expect(isValidImageUrl('')).toBe(false);
  });
});

describe('isExternalPlaceholderImageUrl', () => {
  it('returns true for known external placeholder image hosts', () => {
    expect(isExternalPlaceholderImageUrl('https://placehold.co/400x400')).toBe(
      true
    );
    expect(
      isExternalPlaceholderImageUrl('https://www.placehold.it/500x500')
    ).toBe(true);
    expect(
      isExternalPlaceholderImageUrl(
        'https://via.placeholder.com/600x600?text=No+Image'
      )
    ).toBe(true);
  });

  it('returns false for app-local placeholders and real image hosts', () => {
    expect(isExternalPlaceholderImageUrl('/placeholder.svg')).toBe(false);
    expect(
      isExternalPlaceholderImageUrl('https://cdn.example.com/img.jpg')
    ).toBe(false);
    expect(isExternalPlaceholderImageUrl('not-a-url')).toBe(false);
  });
});
