import { describe, expect, it } from 'vitest';
import { builderDesignCapabilities } from './builder-design-capabilities';
import {
  builderPreviewMessageSchema,
  builderPreviewResponseSchema,
} from './builder-preview-message';
import { builderPreviewMessageSchema as publicBuilderPreviewMessageSchema } from './index';

const validMessage = {
  candidateConfig: {
    content: [{ props: { id: 'text-1', title: 'Welcome' }, type: 'Text' }],
    root: { title: 'Home' },
  },
  capabilityHash: builderDesignCapabilities.capabilityHash,
  capabilityVersion: builderDesignCapabilities.capabilityVersion,
  merchant: {
    basePath: '/acme-store',
    id: 'merchant-123',
    slug: 'acme-store',
    storefrontOrigin: 'https://shop.example.test',
  },
  revision: 7,
  type: 'baci.builder-preview.render',
  version: 1,
};

describe('builder preview bridge contract', () => {
  it('exports the render contract through the public contracts barrel', () => {
    expect(publicBuilderPreviewMessageSchema).toBe(builderPreviewMessageSchema);
  });

  it('accepts a versioned render message with canonical capabilities and a Puck candidate', () => {
    const result = builderPreviewMessageSchema.safeParse(validMessage);

    expect(result.success).toBe(true);
    expect(validMessage.capabilityHash).toMatch(/^[a-f0-9]{64}$/);
    if (!result.success) throw new Error('Expected a valid render message');
    expect(result.data.revision).toBe(7);
    expect(result.data.candidateConfig.content[0]?.type).toBe('Text');
  });

  it('rejects an absent or unsupported envelope version', () => {
    const { version: _version, ...missingVersion } = validMessage;

    expect(builderPreviewMessageSchema.safeParse(missingVersion).success).toBe(
      false
    );
    expect(
      builderPreviewMessageSchema.safeParse({ ...validMessage, version: 2 })
        .success
    ).toBe(false);
  });

  it('rejects a capability version or hash that the rendering shell does not support', () => {
    expect(
      builderPreviewMessageSchema.safeParse({
        ...validMessage,
        capabilityVersion: 'mobile-builder-v2',
      }).success
    ).toBe(false);
    expect(
      builderPreviewMessageSchema.safeParse({
        ...validMessage,
        capabilityHash: 'a'.repeat(64),
      }).success
    ).toBe(false);
  });

  it('rejects blank merchant identifiers and invalid optimistic revisions', () => {
    expect(
      builderPreviewMessageSchema.safeParse({
        ...validMessage,
        merchant: { ...validMessage.merchant, id: ' ' },
      }).success
    ).toBe(false);
    expect(
      builderPreviewMessageSchema.safeParse({
        ...validMessage,
        merchant: { ...validMessage.merchant, slug: ' ' },
      }).success
    ).toBe(false);
    expect(
      builderPreviewMessageSchema.safeParse({ ...validMessage, revision: -1 })
        .success
    ).toBe(false);
    expect(
      builderPreviewMessageSchema.safeParse({ ...validMessage, revision: 1.5 })
        .success
    ).toBe(false);
  });

  it('rejects malformed Puck candidate data before the shell can render it', () => {
    expect(
      builderPreviewMessageSchema.safeParse({
        ...validMessage,
        candidateConfig: { content: [], root: [], zones: {} },
      }).success
    ).toBe(false);
    expect(
      builderPreviewMessageSchema.safeParse({
        ...validMessage,
        candidateConfig: {
          content: [{ props: {}, type: 'UnregisteredComponent' }],
          root: {},
        },
      }).success
    ).toBe(false);
  });

  it('accepts only reviewed manifest props for root Puck components', () => {
    expect(
      builderPreviewMessageSchema.safeParse({
        ...validMessage,
        candidateConfig: {
          content: [
            {
              props: { id: 'button-1', link: '/collections/new', text: 'Shop' },
              type: 'Button',
            },
          ],
          root: {},
        },
      }).success
    ).toBe(true);
    expect(
      builderPreviewMessageSchema.safeParse({
        ...validMessage,
        candidateConfig: {
          content: [
            {
              props: { id: 'button-1', link: 'javascript:alert(1)' },
              type: 'Button',
            },
          ],
          root: {},
        },
      }).success
    ).toBe(false);
    expect(
      builderPreviewMessageSchema.safeParse({
        ...validMessage,
        candidateConfig: {
          content: [
            { props: { id: 'button-1', unreviewed: true }, type: 'Button' },
          ],
          root: {},
        },
      }).success
    ).toBe(false);
  });

  it('rejects refused components and malformed identities in Puck zones', () => {
    expect(
      builderPreviewMessageSchema.safeParse({
        ...validMessage,
        candidateConfig: {
          content: [{ props: { id: 'code-1' }, type: 'CodeEmbed' }],
          root: {},
        },
      }).success
    ).toBe(false);
    expect(
      builderPreviewMessageSchema.safeParse({
        ...validMessage,
        candidateConfig: {
          content: [{ props: { id: 'text-1' }, type: 'Text' }],
          root: {},
          zones: {
            Aside: [{ props: { id: 'text-1' }, type: 'Text' }],
            secondary: [{ props: { id: 'code-1' }, type: 'CodeEmbed' }],
          },
        },
      }).success
    ).toBe(false);
  });

  it('accepts a bounded base path and optional secure storefront origin', () => {
    expect(
      builderPreviewMessageSchema.safeParse({
        ...validMessage,
        merchant: {
          ...validMessage.merchant,
          basePath: '/acme-store/catalog',
          storefrontOrigin: 'https://shop.example.test',
        },
      }).success
    ).toBe(true);
    expect(
      builderPreviewMessageSchema.safeParse({
        ...validMessage,
        merchant: { ...validMessage.merchant, basePath: '//outside.test' },
      }).success
    ).toBe(false);
    expect(
      builderPreviewMessageSchema.safeParse({
        ...validMessage,
        merchant: {
          ...validMessage.merchant,
          storefrontOrigin: 'https://merchant:password@example.test',
        },
      }).success
    ).toBe(false);
  });

  it('rejects unknown envelope fields and secret-shaped candidate fields', () => {
    expect(
      builderPreviewMessageSchema.safeParse({ ...validMessage, extra: true })
        .success
    ).toBe(false);
    expect(
      builderPreviewMessageSchema.safeParse({
        ...validMessage,
        candidateConfig: {
          ...validMessage.candidateConfig,
          apiToken: 'do-not-send-secrets-to-the-preview-shell',
        },
      }).success
    ).toBe(false);
    expect(
      builderPreviewMessageSchema.safeParse({
        ...validMessage,
        candidateConfig: {
          ...validMessage.candidateConfig,
          root: { apiKey: 'do-not-send-secrets-to-the-preview-shell' },
        },
      }).success
    ).toBe(false);
  });

  it('accepts strict ready, rendered, and bounded error responses', () => {
    expect(
      builderPreviewResponseSchema.safeParse({
        capabilityHash: builderDesignCapabilities.capabilityHash,
        capabilityVersion: builderDesignCapabilities.capabilityVersion,
        type: 'baci.builder-preview.ready',
        version: 1,
      }).success
    ).toBe(true);
    expect(
      builderPreviewResponseSchema.safeParse({
        revision: 7,
        type: 'baci.builder-preview.rendered',
        version: 1,
      }).success
    ).toBe(true);
    expect(
      builderPreviewResponseSchema.safeParse({
        code: 'unsupported_capability',
        type: 'baci.builder-preview.error',
        version: 1,
      }).success
    ).toBe(true);
    expect(
      builderPreviewResponseSchema.safeParse({
        code: 'unsupported capability',
        type: 'baci.builder-preview.error',
        version: 1,
      }).success
    ).toBe(false);
    expect(
      builderPreviewResponseSchema.safeParse({
        revision: 7,
        type: 'baci.builder-preview.rendered',
        unexpected: true,
        version: 1,
      }).success
    ).toBe(false);
  });
});
