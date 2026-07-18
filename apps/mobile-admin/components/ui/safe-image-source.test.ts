import type { ImageSourcePropType } from 'react-native';
import { describe, expect, it } from 'vitest';
import { resolveSafeImageSource } from './safe-image-source';

class UriLike {
  constructor(private readonly href: string) {}

  toString() {
    return this.href;
  }
}

describe('resolveSafeImageSource', () => {
  it('coerces an object URI and exposes a stable key', () => {
    const source = {
      uri: new UriLike('file:///cache/product.png'),
    } as unknown as ImageSourcePropType;

    expect(resolveSafeImageSource(source)).toEqual({
      key: 'file:///cache/product.png',
      source: { uri: 'file:///cache/product.png' },
      uri: 'file:///cache/product.png',
    });
  });

  it('normalizes array URIs without mutating their source objects', () => {
    const firstSource = { uri: new UriLike('file:///cache/fallback.png') };
    const secondSource = { uri: 'https://example.com/product.png' };
    const source = [
      firstSource,
      secondSource,
    ] as unknown as ImageSourcePropType;

    expect(resolveSafeImageSource(source)).toEqual({
      key: 'file:///cache/fallback.png|https://example.com/product.png',
      source: [
        { uri: 'file:///cache/fallback.png' },
        { uri: 'https://example.com/product.png' },
      ],
      uri: undefined,
    });
    expect(firstSource.uri).toBeInstanceOf(UriLike);
    expect(secondSource.uri).toBe('https://example.com/product.png');
  });
});
