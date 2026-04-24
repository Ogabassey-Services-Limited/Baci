import { describe, expect, it } from 'vitest';
import {
  collapseColorImagesCaseInsensitive,
  mergeColorImagesCaseInsensitive,
} from './product-variant-media-merge';

describe('collapseColorImagesCaseInsensitive', () => {
  it('returns an identical record when no keys differ by case', () => {
    // Arrange
    const input = {
      Red: ['https://cdn.example.com/red.jpg'],
      Blue: ['https://cdn.example.com/blue.jpg'],
    };

    // Act
    const result = collapseColorImagesCaseInsensitive(input);

    // Assert
    expect(result).toEqual({
      Red: ['https://cdn.example.com/red.jpg'],
      Blue: ['https://cdn.example.com/blue.jpg'],
    });
  });

  it('collapses case-variant keys into a single bucket using the first-seen casing', () => {
    // Arrange: legacy persistence path produced both `Black` and `black`
    // buckets for the same color.
    const input = {
      Black: ['https://cdn.example.com/black-1.jpg'],
      black: ['https://cdn.example.com/black-2.jpg'],
    };

    // Act
    const result = collapseColorImagesCaseInsensitive(input);

    // Assert: first-seen casing wins; images from both buckets are merged
    // under that casing, preserving insertion order and deduplicated.
    expect(Object.keys(result)).toEqual(['Black']);
    expect(result.Black).toEqual([
      'https://cdn.example.com/black-1.jpg',
      'https://cdn.example.com/black-2.jpg',
    ]);
  });

  it('deduplicates images within the merged bucket', () => {
    // Arrange: same image present under both casings of the key.
    const input = {
      Gold: [
        'https://cdn.example.com/gold.jpg',
        'https://cdn.example.com/gold-2.jpg',
      ],
      gold: ['https://cdn.example.com/gold.jpg'],
    };

    // Act
    const result = collapseColorImagesCaseInsensitive(input);

    // Assert: the duplicate URL appears once in the canonical bucket.
    expect(result).toEqual({
      Gold: [
        'https://cdn.example.com/gold.jpg',
        'https://cdn.example.com/gold-2.jpg',
      ],
    });
  });

  it('returns an empty record for an empty input', () => {
    // Arrange, Act
    const result = collapseColorImagesCaseInsensitive({});

    // Assert
    expect(result).toEqual({});
  });
});

describe('mergeColorImagesCaseInsensitive', () => {
  it('preserves legacy-only colors unchanged in their original slots', () => {
    // Arrange: a legacy color with no variant counterpart should flow through
    // untouched, in its original insertion position.
    const legacy = {
      Silver: ['https://cdn.example.com/silver.jpg'],
    };
    const variants = {};

    // Act
    const result = mergeColorImagesCaseInsensitive(legacy, variants);

    // Assert
    expect(result).toEqual({
      Silver: ['https://cdn.example.com/silver.jpg'],
    });
  });

  it('replaces legacy images with variant images under the variant casing when colors match case-insensitively', () => {
    // Arrange: legacy `Black` and variant `black` refer to the same color.
    const legacy = {
      Black: ['https://cdn.example.com/legacy-black.jpg'],
    };
    const variants = {
      black: ['https://cdn.example.com/variant-black.jpg'],
    };

    // Act
    const result = mergeColorImagesCaseInsensitive(legacy, variants);

    // Assert: the variant casing replaces the legacy casing and the variant
    // images override — no split buckets left behind.
    expect(Object.keys(result)).toEqual(['black']);
    expect(result.black).toEqual([
      'https://cdn.example.com/variant-black.jpg',
    ]);
  });

  it('preserves insertion order: legacy entries first (in their original slots), then variant-only entries', () => {
    // Arrange: a legacy entry that survives, a legacy entry that variants
    // override, and a variant-only entry. The surviving legacy entry should
    // keep its original slot; the overridden entry's slot is replaced by the
    // variant casing; variant-only entries come last.
    const legacy = {
      Gold: ['https://cdn.example.com/legacy-gold.jpg'],
      Silver: ['https://cdn.example.com/legacy-silver.jpg'],
    };
    const variants = {
      silver: ['https://cdn.example.com/variant-silver.jpg'],
      Blue: ['https://cdn.example.com/variant-blue.jpg'],
    };

    // Act
    const result = mergeColorImagesCaseInsensitive(legacy, variants);

    // Assert: Gold (legacy-only) first, then silver (variant casing in the
    // Silver slot), then Blue (variant-only) last.
    expect(Object.keys(result)).toEqual(['Gold', 'silver', 'Blue']);
  });

  it('deduplicates images within each bucket', () => {
    // Arrange: variant images contain a duplicate URL.
    const legacy = {};
    const variants = {
      Red: [
        'https://cdn.example.com/red.jpg',
        'https://cdn.example.com/red.jpg',
      ],
    };

    // Act
    const result = mergeColorImagesCaseInsensitive(legacy, variants);

    // Assert: deduplicated in the output.
    expect(result.Red).toEqual(['https://cdn.example.com/red.jpg']);
  });

  it('does not mutate the input records', () => {
    // Arrange
    const legacy = { Black: ['https://cdn.example.com/legacy-black.jpg'] };
    const variants = { black: ['https://cdn.example.com/variant-black.jpg'] };
    const legacyBefore = JSON.stringify(legacy);
    const variantsBefore = JSON.stringify(variants);

    // Act
    mergeColorImagesCaseInsensitive(legacy, variants);

    // Assert
    expect(JSON.stringify(legacy)).toBe(legacyBefore);
    expect(JSON.stringify(variants)).toBe(variantsBefore);
  });

  it('returns an empty record when both inputs are empty', () => {
    // Arrange, Act
    const result = mergeColorImagesCaseInsensitive({}, {});

    // Assert
    expect(result).toEqual({});
  });
});
