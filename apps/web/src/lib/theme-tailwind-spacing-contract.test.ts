import { join } from 'node:path';
import tailwindcss from '@tailwindcss/postcss';
import postcss from 'postcss';
import { describe, expect, it } from 'vitest';
import tailwindConfig from '../../tailwind.config.mjs';

const containerTokens = [
  ['xs', '20rem'],
  ['sm', '24rem'],
  ['md', '28rem'],
  ['lg', '32rem'],
  ['xl', '36rem'],
  ['2xl', '42rem'],
  ['3xl', '48rem'],
] as const;

const themeSpacingTokens = [
  'theme-xs',
  'theme-sm',
  'theme-md',
  'theme-lg',
  'theme-xl',
  'theme-2xl',
  'theme-3xl',
] as const;

async function compileThemeUtilities() {
  const candidates = [
    ...containerTokens.map(([token]) => `max-w-${token}`),
    ...themeSpacingTokens.map((token) => `p-${token}`),
    'safe-all',
    'touch-manipulation',
    'touch-target',
    'touch-target-lg',
  ].join(' ');
  const configPath = join(process.cwd(), 'tailwind.config.mjs');
  const stylesheet = `@config "${configPath}";\n@import "tailwindcss" source(none);\n@source inline("${candidates}");`;

  return (
    await postcss([tailwindcss()]).process(stylesheet, { from: undefined })
  ).css;
}

describe('theme spacing namespace', () => {
  it('does not collapse standard max-width tokens into theme spacing values', () => {
    const spacing = tailwindConfig.theme?.extend?.spacing;

    for (const [token] of containerTokens) {
      expect(spacing).not.toHaveProperty(token);
    }

    expect(spacing).toMatchObject({
      'theme-xs': 'var(--theme-space-xs)',
      'theme-sm': 'var(--theme-space-sm)',
      'theme-md': 'var(--theme-space-md)',
      'theme-lg': 'var(--theme-space-lg)',
      'theme-xl': 'var(--theme-space-xl)',
      'theme-2xl': 'var(--theme-space-2xl)',
      'theme-3xl': 'var(--theme-space-3xl)',
    });
  });

  it('compiles standard max-width and renamed theme padding utilities', async () => {
    const css = (await compileThemeUtilities()).replace(/\s+/g, '');

    for (const [token, value] of containerTokens) {
      expect(css).toContain(`--container-${token}:${value}`);
      expect(css).toContain(
        `.max-w-${token}{max-width:var(--container-${token});}`
      );
    }

    for (const token of themeSpacingTokens) {
      expect(css).toContain(
        `.p-${token}{padding:var(--theme-space-${token.replace('theme-', '')});}`
      );
    }
  });

  it('preserves custom responsive utility output', async () => {
    const css = (await compileThemeUtilities()).replace(/\s+/g, '');

    expect(css).toContain(
      '.safe-all{padding-top:env(safe-area-inset-top);padding-right:env(safe-area-inset-right);padding-bottom:env(safe-area-inset-bottom);padding-left:env(safe-area-inset-left);}'
    );
    expect(css).toContain('.touch-manipulation{touch-action:manipulation;}');
    expect(css).toContain(
      '.touch-target{min-width:44px;min-height:44px;display:inline-flex;align-items:center;justify-content:center;}'
    );
    expect(css).toContain(
      '.touch-target-lg{min-width:48px;min-height:48px;display:inline-flex;align-items:center;justify-content:center;}'
    );
  });
});
