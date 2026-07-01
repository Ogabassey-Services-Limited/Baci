import { describe, expect, it } from 'vitest';
import {
  hostedFlowUpdateColumns,
  normalizeMyCoverHostedLink,
} from './webhook-hosted-flows';

describe('MyCover hosted flow helpers', () => {
  it('keeps only HTTPS MyCover hosted links', () => {
    expect(normalizeMyCoverHostedLink('https://mycover.ai/purchase?q=1')).toBe(
      'https://mycover.ai/purchase?q=1'
    );
    expect(
      normalizeMyCoverHostedLink('https://forms.mycover.ai/purchase?q=1')
    ).toBe('https://forms.mycover.ai/purchase?q=1');
    expect(normalizeMyCoverHostedLink('http://mycover.ai/purchase?q=1')).toBe(
      null
    );
    expect(normalizeMyCoverHostedLink('https://evil.test/purchase?q=1')).toBe(
      null
    );
  });

  it('does not re-arm activation reminders when the inspection URL is replayed', () => {
    const update = hostedFlowUpdateColumns(
      { inspection_link: 'https://mycover.ai/purchase?q=inspect' },
      {
        inspection_link: 'https://mycover.ai/purchase?q=inspect',
        inspection_status: 'pending',
      }
    );

    expect(update).toEqual({
      inspection_link: 'https://mycover.ai/purchase?q=inspect',
    });
  });

  it('re-arms activation reminders when the inspection URL changes', () => {
    const update = hostedFlowUpdateColumns(
      { inspection_link: 'https://mycover.ai/purchase?q=new' },
      {
        inspection_link: 'https://mycover.ai/purchase?q=old',
        inspection_status: 'pending',
      }
    );

    expect(update).toEqual({
      activation_reminder_sent_at: null,
      inspection_link: 'https://mycover.ai/purchase?q=new',
      inspection_status: 'pending',
    });
  });

  it('does not reopen a completed inspection when the URL is rotated', () => {
    const update = hostedFlowUpdateColumns(
      { inspection_link: 'https://mycover.ai/purchase?q=new' },
      {
        inspection_link: 'https://mycover.ai/purchase?q=old',
        inspection_status: 'completed',
      }
    );

    // Only the (new) link is written; status stays completed and no reminder
    // is re-armed.
    expect(update).toEqual({
      inspection_link: 'https://mycover.ai/purchase?q=new',
    });
  });
});
