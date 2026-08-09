import { describe, expect, it } from 'vitest';
import { shouldIncludeProductSchemaSpec } from './product-schema-specs';

describe('shouldIncludeProductSchemaSpec non-phone capabilities', () => {
  it('preserves meaningful negative facts that are unrelated to stale phone capabilities', () => {
    for (const candidate of [
      { label: 'Weather Sealing', value: 'No' },
      { label: 'Requires Assembly', value: false },
      { label: 'Built-in Flash', value: 'No' },
    ]) {
      expect(
        shouldIncludeProductSchemaSpec(
          { category: 'Cameras', categories: null },
          candidate
        )
      ).toBe(true);
    }

    expect(
      shouldIncludeProductSchemaSpec(
        { category: 'Cameras', categories: null },
        { label: 'NFC', value: 'No' }
      )
    ).toBe(false);
  });

  it('preserves verified positive NFC for camera hardware without enabling it for unrelated families', () => {
    expect(
      shouldIncludeProductSchemaSpec(
        { category: 'Action Cameras', categories: null },
        { key: 'has_nfc', value: true }
      )
    ).toBe(true);
    expect(
      shouldIncludeProductSchemaSpec(
        { category: 'Action Cameras', categories: null },
        { key: 'has_nfc', value: false }
      )
    ).toBe(false);
    expect(
      shouldIncludeProductSchemaSpec(
        { category: 'PlayStation 5', categories: null },
        { key: 'has_nfc', value: true }
      )
    ).toBe(false);
  });
});
