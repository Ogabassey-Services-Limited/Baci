import { describe, expect, it } from 'vitest';
import { resolveStorefrontTemplateId } from './resolve-storefront-template';

describe('resolveStorefrontTemplateId', () => {
  it('preserves an explicit registered template id', () => {
    expect(resolveStorefrontTemplateId('ogabassey', 'ELECTRONICS')).toBe(
      'ogabassey'
    );
  });

  it('uses the business-type template when the id is default', () => {
    expect(resolveStorefrontTemplateId('default', 'FASHION')).toBe('fashion');
  });

  it('returns null when Puck is the explicit storefront engine', () => {
    expect(resolveStorefrontTemplateId('puck', 'ELECTRONICS')).toBeNull();
  });
});
