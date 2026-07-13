import { describe, expect, it } from 'vitest';
import {
  capturePetrockFeedbackBody,
  hashPetrockFeedbackToken,
  petrockFeedbackHashesMatch,
} from './petrock-feedback-capture';

describe('Petrock feedback capture helpers', () => {
  it('accepts only a 32-byte base64url token and compares its hash safely', () => {
    const token = 'a'.repeat(43);
    const hash = hashPetrockFeedbackToken(token);

    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    expect(petrockFeedbackHashesMatch(hash ?? '', hash ?? '')).toBe(true);
    expect(petrockFeedbackHashesMatch(hash ?? '', '0'.repeat(64))).toBe(false);
    expect(hashPetrockFeedbackToken('short')).toBeNull();
  });

  it('stores only bounded metadata and field names, never callback values', async () => {
    const request = new Request('https://example.com/feedback', {
      body: JSON.stringify({ order_uuid: 'secret-order', status: 'success' }),
      headers: { 'content-type': 'application/json' },
      method: 'POST',
    });

    const capture = await capturePetrockFeedbackBody(request);

    expect(capture).toMatchObject({
      bodyBytes: 48,
      bodyKeys: ['order_uuid', 'status'],
      contentType: 'application/json',
      tooLarge: false,
    });
    expect(JSON.stringify(capture)).not.toContain('secret-order');
  });

  it('rejects an oversized callback body', async () => {
    const request = new Request('https://example.com/feedback', {
      body: 'x'.repeat(33_000),
      method: 'POST',
    });

    await expect(capturePetrockFeedbackBody(request)).resolves.toMatchObject({
      tooLarge: true,
    });
  });
});
