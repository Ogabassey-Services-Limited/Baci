import { describe, expect, it } from 'vitest';
import { FAQPageClient } from './faq-page-client';

describe('FAQPageClient', () => {
  it('exports a valid component', () => {
    expect(FAQPageClient).toBeDefined();
    expect(typeof FAQPageClient).toBe('function');
  });
});
