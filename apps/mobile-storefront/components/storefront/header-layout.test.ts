import { SPACING } from '@/constants/Colors';
import { getEliteHeaderTopPadding } from './header-layout';

describe('getEliteHeaderTopPadding', () => {
  it('removes the extra stacked spacing without entering the unsafe area', () => {
    expect(getEliteHeaderTopPadding(59)).toBe(59);
    expect(getEliteHeaderTopPadding(0)).toBe(SPACING.xs);
  });
});
