import { describe, expect, it } from 'vitest';
import { STOREFRONT_EDGE_MEDIA_SUBRESOURCE_ROWS } from './storefront-edge-media-subresource-rows';

describe('external storefront media inventory', () => {
  it('keeps CDN and storage image requests destination-aware', () => {
    expect(
      STOREFRONT_EDGE_MEDIA_SUBRESOURCE_ROWS.map(
        ({ destinationCondition, decision, methods }) => ({
          decision,
          hostKind: destinationCondition?.hostKind,
          methods,
        })
      )
    ).toEqual([
      {
        decision: 'origin_dynamic',
        hostKind: 'configured_media_cdn_origin',
        methods: ['GET', 'HEAD'],
      },
      {
        decision: 'origin_dynamic',
        hostKind: 'configured_supabase_storage_origin',
        methods: ['GET', 'HEAD'],
      },
    ]);
  });
});
