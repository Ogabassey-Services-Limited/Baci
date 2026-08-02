import { expect, it } from 'vitest';
import { deriveCuratedTheme } from './derive-curated-theme';

it('uses readable button text', () =>
  expect(
    deriveCuratedTheme({
      primary: '#111111',
      background: '#ffffff',
      accent: '#f97316',
    }).colors.button.primary.text
  ).toBe('#FFFFFF'));
