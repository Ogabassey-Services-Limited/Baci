import { describe, expect, it } from 'vitest';
import { NewsletterWidget } from './newsletter-widget';

describe('NewsletterWidget', () => {
  it('exports a valid component', () => {
    expect(NewsletterWidget).toBeDefined();
    expect(typeof NewsletterWidget).toBe('function');
  });
});
