import { BRAND } from './Colors';
import { palette, withAlpha } from './palette';

describe('BRAND primary alpha tokens', () => {
  it('exposes primaryAlpha12 as a 12% tint of primary red', () => {
    expect(BRAND.primaryAlpha12).toBe(withAlpha(palette.red[600], 0.12));
  });

  it('keeps primaryAlpha06 as a 6% tint of primary red (unchanged)', () => {
    expect(BRAND.primaryAlpha06).toBe(withAlpha(palette.red[600], 0.06));
  });
});
