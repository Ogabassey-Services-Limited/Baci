import { describe, expect, it } from 'vitest';
import {
  EMAIL_SEQUENCE_BLUEPRINTS,
  getEmailSequenceBlueprints,
} from './email-sequence-blueprints';

describe('email sequence blueprints', () => {
  it('separates operational ZeptoMail sequences from marketing Zoho Campaigns sequences', () => {
    const marketing = EMAIL_SEQUENCE_BLUEPRINTS.filter(
      (sequence) => sequence.audienceKind === 'marketing'
    );
    const operational = EMAIL_SEQUENCE_BLUEPRINTS.filter(
      (sequence) => sequence.audienceKind === 'operational'
    );

    expect(marketing.every((sequence) => sequence.provider === 'zoho')).toBe(
      true
    );
    expect(
      operational.every((sequence) => sequence.provider === 'zeptomail')
    ).toBe(true);
  });

  it('includes Ogabassey ecommerce lifecycle and Baci merchant-admin summaries', () => {
    expect(
      getEmailSequenceBlueprints('ogabassey').map((item) => item.id)
    ).toEqual(
      expect.arrayContaining([
        'ogabassey-blog-announcement',
        'ogabassey-new-arrivals',
        'ogabassey-abandoned-cart',
        'ogabassey-post-purchase-care',
      ])
    );
    expect(
      getEmailSequenceBlueprints('baci-admin').map((item) => item.id)
    ).toEqual(
      expect.arrayContaining([
        'merchant-daily-sales-summary',
        'merchant-weekly-sales-summary',
        'merchant-low-stock-alert',
      ])
    );
  });
});
