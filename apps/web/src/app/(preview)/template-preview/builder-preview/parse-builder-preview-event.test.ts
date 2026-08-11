import { builderDesignCapabilities } from '@baci/shared/contracts';
import { describe, expect, it } from 'vitest';
import {
  isBuilderPreviewRenderEvent,
  parseBuilderPreviewEvent,
} from './parse-builder-preview-event';

const validMessage = {
  candidateConfig: {
    content: [{ props: { id: 'text-1', title: 'Welcome' }, type: 'Text' }],
    root: { props: { title: 'Home' } },
  },
  capabilityHash: builderDesignCapabilities.capabilityHash,
  capabilityVersion: builderDesignCapabilities.capabilityVersion,
  merchant: { id: 'merchant-1', slug: 'acme-store' },
  revision: 2,
  type: 'baci.builder-preview.render',
  version: 1,
};

describe('parseBuilderPreviewEvent', () => {
  it('returns a strictly schema-validated render message', () => {
    expect(
      parseBuilderPreviewEvent(
        new MessageEvent('message', { data: validMessage })
      )
    ).toMatchObject({ revision: 2, merchant: { slug: 'acme-store' } });
  });

  it('decodes React Native WebView string JSON before strict validation', () => {
    expect(
      parseBuilderPreviewEvent(
        new MessageEvent('message', { data: JSON.stringify(validMessage) })
      )
    ).toMatchObject({ revision: 2, merchant: { slug: 'acme-store' } });
  });

  it('rejects malformed, unknown, and unsupported event data', () => {
    expect(
      parseBuilderPreviewEvent(
        new MessageEvent('message', {
          data: {
            ...validMessage,
            candidateConfig: { content: [] },
            extra: true,
          },
        })
      )
    ).toBeNull();
    expect(
      parseBuilderPreviewEvent(
        new MessageEvent('message', { data: 'not-json' })
      )
    ).toBeNull();
    expect(
      parseBuilderPreviewEvent(
        new MessageEvent('message', { data: { ...validMessage, version: 2 } })
      )
    ).toBeNull();
  });

  it('classifies unrelated host messages without treating them as preview errors', () => {
    expect(
      isBuilderPreviewRenderEvent(
        new MessageEvent('message', { data: { type: 'host.analytics' } })
      )
    ).toBe(false);
    expect(
      isBuilderPreviewRenderEvent(
        new MessageEvent('message', { data: validMessage })
      )
    ).toBe(true);
  });
});
