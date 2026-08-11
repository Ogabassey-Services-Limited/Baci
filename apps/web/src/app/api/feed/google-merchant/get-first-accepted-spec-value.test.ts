import { describe, expect, it } from 'vitest';

import { getFirstAcceptedSpecValue } from './get-first-accepted-spec-value';

describe('getFirstAcceptedSpecValue', () => {
  it('retains positive camera measurements when category data is unavailable', () => {
    expect(getFirstAcceptedSpecValue({}, 'main_camera_mp', 50)).toBe(50);
  });

  it('does not bypass the category-aware policy when a category is known', () => {
    expect(
      getFirstAcceptedSpecValue({ category: 'Gaming' }, 'main_camera_mp', 50)
    ).toBeUndefined();
  });
});
