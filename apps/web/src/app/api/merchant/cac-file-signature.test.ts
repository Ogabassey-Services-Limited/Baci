import { describe, expect, it } from 'vitest';
import { hasCacFileSignature } from './cac-file-signature';

describe('hasCacFileSignature', () => {
  it('accepts bytes that match the declared certificate MIME type', () => {
    expect(
      hasCacFileSignature(
        new Uint8Array([0xff, 0xd8, 0xff, 0x00]),
        'image/jpeg'
      )
    ).toBe(true);
  });

  it('rejects bytes that do not match the declared certificate MIME type', () => {
    expect(
      hasCacFileSignature(
        new Uint8Array([0x25, 0x50, 0x44, 0x46]),
        'image/jpeg'
      )
    ).toBe(false);
  });

  it('rejects a truncated PNG header that omits the full eight-byte signature', () => {
    expect(
      hasCacFileSignature(new Uint8Array([0x89, 0x50, 0x4e, 0x47]), 'image/png')
    ).toBe(false);
  });

  it('requires both RIFF and WEBP markers for WebP certificates', () => {
    expect(
      hasCacFileSignature(
        new Uint8Array([
          0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42,
          0x50,
        ]),
        'image/webp'
      )
    ).toBe(true);
    expect(
      hasCacFileSignature(
        new Uint8Array([0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00]),
        'image/webp'
      )
    ).toBe(false);
  });
});
