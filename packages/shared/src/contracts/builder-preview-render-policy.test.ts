import { describe, expect, it } from 'vitest';
import { previewRenderPolicy } from './builder-preview-render-policy';

describe('preview render policy', () => {
  it('accepts established Puck dropzone keys while rejecting unsafe keys', () => {
    expect(previewRenderPolicy.isPuckZoneKey('Flex-1234:children')).toBe(true);
    expect(previewRenderPolicy.isPuckZoneKey('aside')).toBe(true);
    expect(previewRenderPolicy.isPuckZoneKey('Flex-1234:<script>')).toBe(false);
    expect(previewRenderPolicy.isPuckZoneKey('Flex-1234:children:next')).toBe(
      false
    );
  });

  it('accepts bounded curated render props without allowing unreviewed props', () => {
    expect(
      previewRenderPolicy.isPuckComponent(
        {
          props: {
            backgroundColor: '#111111',
            id: 'header-1',
            storeName: 'Acme Store',
          },
          type: 'Header',
        },
        new Set()
      )
    ).toBe(true);
    expect(
      previewRenderPolicy.isPuckComponent(
        {
          props: { headingLevel: 'h1', id: 'hero-1', title: 'Welcome' },
          type: 'Hero',
        },
        new Set()
      )
    ).toBe(true);
    expect(
      previewRenderPolicy.isPuckComponent(
        {
          props: { id: 'button-1', link: 'javascript:alert(1)' },
          type: 'Button',
        },
        new Set()
      )
    ).toBe(false);
    expect(
      previewRenderPolicy.isPuckComponent(
        { props: { id: 'header-1', unreviewed: true }, type: 'Header' },
        new Set()
      )
    ).toBe(false);
    expect(
      previewRenderPolicy.isPuckComponent(
        { props: { id: 'code-1' }, type: 'CodeEmbed' },
        new Set()
      )
    ).toBe(false);
  });
});
