import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { RenderBuilderConfig } from './render-builder-config';

vi.mock('@puckeditor/core', () => ({
  Render: ({
    data,
  }: {
    data: {
      content: Array<{ props: { isPreview?: boolean; title?: string } }>;
    };
  }) => (
    <output
      data-header-preview={String(data.content[0]?.props.isPreview ?? false)}
      data-testid="puck-render"
    >
      {data.content[0]?.props.title}
    </output>
  ),
}));
vi.mock('@/components/builder/config', () => ({ builderConfig: {} }));

const merchantContext = {
  basePath: '/acme-store',
  id: 'preview-merchant-1',
  slug: 'acme-store',
};

describe('RenderBuilderConfig', () => {
  it('renders the supplied in-memory Puck candidate in deterministic preview context', () => {
    render(
      <RenderBuilderConfig
        config={{
          content: [
            { props: { id: 'text-1', title: 'Welcome' }, type: 'Text' },
          ],
          root: { props: { title: 'Home' } },
          theme: { colors: { primary: '#14532d' } },
        }}
        merchantContext={merchantContext}
      />
    );

    expect(screen.getByTestId('puck-render')).toHaveTextContent('Welcome');
    expect(screen.getByTestId('builder-preview-surface')).toHaveAttribute(
      'data-base-path',
      '/acme-store'
    );
    expect(screen.getByTestId('builder-preview-surface')).toHaveStyle({
      '--theme-primary': '#14532d',
    });
  });

  it('does not create a database, merchant-hook, or public-storefront loader dependency', () => {
    const source = readFileSync(
      resolve(__dirname, 'render-builder-config.tsx'),
      'utf8'
    );

    expect(source).not.toMatch(
      /supabase|useMerchant|page_configs|published_config/
    );
  });

  it('forces header candidates into local preview mode before Puck renders them', () => {
    render(
      <RenderBuilderConfig
        config={{
          content: [{ props: { id: 'header-1' }, type: 'Header' }],
          root: { props: { title: 'Home' } },
        }}
        merchantContext={merchantContext}
      />
    );

    expect(screen.getByTestId('puck-render')).toHaveAttribute(
      'data-header-preview',
      'true'
    );
  });
});
