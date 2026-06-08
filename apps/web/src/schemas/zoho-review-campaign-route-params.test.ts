import { describe, expect, it } from 'vitest';
import { zohoReviewCampaignRouteParamsSchema } from './zoho-review-campaign-route-params';

describe('zohoReviewCampaignRouteParamsSchema', () => {
  it('accepts a valid blog post id', () => {
    expect(
      zohoReviewCampaignRouteParamsSchema.parse({
        id: '4db63f48-3577-4ef3-9e09-e3ec6af7a5a2',
      })
    ).toEqual({ id: '4db63f48-3577-4ef3-9e09-e3ec6af7a5a2' });
  });

  it.each([
    ['invalid uuid', { id: 'not-a-uuid' }],
    ['missing id', {}],
    ['empty id', { id: '' }],
    ['null id', { id: null }],
    ['numeric id', { id: 12345 }],
  ])('rejects %s', (_label, input) => {
    expect(() => zohoReviewCampaignRouteParamsSchema.parse(input)).toThrow();
  });
});
