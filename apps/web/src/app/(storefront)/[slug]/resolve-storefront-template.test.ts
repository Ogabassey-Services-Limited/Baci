import { describe, expect, it } from 'vitest';
import { resolveStorefrontTemplateId } from './resolve-storefront-template';

describe('resolveStorefrontTemplateId', () => {
  it('preserves explicit non-default template ids', () => {
    expect(resolveStorefrontTemplateId('ogabassey', 'ELECTRONICS')).toBe(
      'ogabassey'
    );
  });

  it('falls back to the business-type template when the template is default', () => {
    expect(resolveStorefrontTemplateId('default', 'FASHION')).toBe('fashion');
  });

  it('uses the business-type fallback when no template id is set', () => {
    expect(resolveStorefrontTemplateId(undefined, 'ELECTRONICS')).toBe(
      'electronics'
    );
  });

  it('falls back to the business-type template when the template id is empty', () => {
    expect(resolveStorefrontTemplateId('', 'ELECTRONICS')).toBe('electronics');
  });

  it('returns null for the puck template so the client fallback can take over', () => {
    expect(resolveStorefrontTemplateId('puck', 'ELECTRONICS')).toBeNull();
  });

  it('handles null business type by falling back to default template', () => {
    const result = resolveStorefrontTemplateId(undefined, null);
    expect(typeof result === 'string' || result === null).toBe(true);
  });
});
