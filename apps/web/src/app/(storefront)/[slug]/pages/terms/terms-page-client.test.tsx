import { describe, expect, it } from 'vitest';
import { TermsPageClient } from './terms-page-client';

describe('TermsPageClient', () => {
  it('exports a valid component', () => {
    expect(TermsPageClient).toBeDefined();
    expect(typeof TermsPageClient).toBe('function');
  });
});
