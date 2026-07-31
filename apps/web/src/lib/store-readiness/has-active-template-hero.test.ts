import { describe, expect, it } from 'vitest';
import { hasActiveTemplateHero } from './has-active-template-hero';

describe('hasActiveTemplateHero', () => {
  it('recognizes a registered storefront template as the active hero source', () => {
    expect(hasActiveTemplateHero('electronics', 'FASHION')).toBe(true);
  });

  it('keeps Puck as the active source when selected explicitly', () => {
    expect(hasActiveTemplateHero('puck', 'ELECTRONICS')).toBe(false);
  });

  it('falls back to Puck when an unregistered template cannot render', () => {
    expect(hasActiveTemplateHero('removed-template', 'ELECTRONICS')).toBe(
      false
    );
  });
});
