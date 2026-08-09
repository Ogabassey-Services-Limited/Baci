import { describe, expect, it } from 'vitest';
import { previewRenderProjection } from './builder-preview-render-projection';

describe('preview render projection', () => {
  it('removes external assets and known refused blocks before rendering', () => {
    const result = previewRenderProjection.projectCandidate({
      content: [
        {
          props: {
            id: 'header-1',
            logoUrl: 'https://cdn.example.test/logo.webp',
          },
          type: 'Header',
        },
        {
          props: { code: '<script>ignored()</script>', id: 'code-1' },
          type: 'CodeEmbed',
        },
      ],
      root: { props: { title: 'Home' } },
    });

    expect(result.content).toEqual([
      { props: { id: 'header-1' }, type: 'Header' },
    ]);
  });
});
