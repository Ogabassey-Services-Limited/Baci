import { describe, expect, it } from 'vitest';
import { generateDefaultConfig } from './builder-defaults';
import { applyTheme } from './theme-manager';

describe('generateDefaultConfig', () => {
  it('returns the deterministic compatibility starter', async () => {
    const config = await generateDefaultConfig({
      business_name: 'Baci',
      business_type: 'fashion',
      brand_colors: {
        primary: '#111111',
        background: '#ffffff',
        accent: '#f97316',
      },
    });
    expect(
      config.content.find((block) => block.type === 'Hero')?.props?.id
    ).toBe('Hero-home');
    expect(() => applyTheme(config.theme)).not.toThrow();
    expect(
      document.documentElement.style.getPropertyValue(
        '--theme-container-max-width'
      )
    ).not.toBe('');
  });
});
