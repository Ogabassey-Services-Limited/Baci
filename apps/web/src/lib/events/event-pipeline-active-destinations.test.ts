import { afterEach, describe, expect, it } from 'vitest';
import { getEventPipelineActiveDestinations } from './event-pipeline-active-destinations';

const original = process.env.EVENT_PIPELINE_ACTIVE_DESTINATIONS;

afterEach(() => {
  if (original === undefined)
    delete process.env.EVENT_PIPELINE_ACTIVE_DESTINATIONS;
  else process.env.EVENT_PIPELINE_ACTIVE_DESTINATIONS = original;
});

describe('getEventPipelineActiveDestinations', () => {
  it('returns supported destinations in canonical order', () => {
    process.env.EVENT_PIPELINE_ACTIVE_DESTINATIONS =
      'tiktok,unknown,SNAPCHAT,facebook';
    expect(getEventPipelineActiveDestinations()).toEqual([
      'facebook',
      'snapchat',
      'tiktok',
    ]);
  });

  it('fails closed on invalid destinations', () => {
    process.env.EVENT_PIPELINE_ACTIVE_DESTINATIONS =
      'facebook,unknown,SNAPCHAT';

    expect(getEventPipelineActiveDestinations()).toEqual([
      'facebook',
      'snapchat',
    ]);
  });

  it('fails closed when no destinations are configured', () => {
    delete process.env.EVENT_PIPELINE_ACTIVE_DESTINATIONS;
    expect(getEventPipelineActiveDestinations()).toEqual([]);
  });

  it('does not activate the cache-transition lane from analytics configuration', () => {
    process.env.EVENT_PIPELINE_ACTIVE_DESTINATIONS =
      'storefront_cache_transition,facebook';
    expect(getEventPipelineActiveDestinations()).toEqual(['facebook']);
  });
});
