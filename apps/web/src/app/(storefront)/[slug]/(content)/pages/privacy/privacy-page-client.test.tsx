import { describe, expect, it } from 'vitest';
import { PrivacyPageClient } from './privacy-page-client';

describe('PrivacyPageClient', () => {
  it('exports a valid component', () => {
    expect(PrivacyPageClient).toBeDefined();
    expect(typeof PrivacyPageClient).toBe('function');
  });
});
