import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  builderDesignCapabilities,
  builderPreviewMessageSchema,
} from '@baci/shared/contracts';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { RenderBuilderConfig } from './render-builder-config';

vi.mock('@puckeditor/core', () => ({
  Render: ({
    config,
    data,
  }: {
    config: {
      components: {
        Flex?: {
          render: (props: { id: string; puck: unknown }) => React.ReactNode;
        };
        ProductGrid?: {
          render: (props: {
            columns?: number;
            limit?: number;
            title?: string;
          }) => React.ReactNode;
        };
      };
    };
    data: {
      content: Array<{
        props: { isPreview?: boolean; title?: string };
        type: string;
      }>;
      zones?: Record<
        string,
        Array<{ props: { id?: string; isPreview?: boolean; title?: string } }>
      >;
    };
  }) => {
    const flex = data.content.find((block) => block.type === 'Flex');
    const productGrid = data.content.find(
      (block) => block.type === 'ProductGrid'
    );
    if (productGrid && config.components.ProductGrid) {
      return config.components.ProductGrid.render(productGrid.props);
    }
    if (flex && config.components.Flex) {
      return config.components.Flex.render({
        id: 'Flex-1',
        puck: {
          renderDropZone: ({ zone }: { zone: string }) => (
            <output
              data-header-preview={String(
                data.zones?.[`Flex-1:${zone}`]?.[0]?.props.isPreview ?? false
              )}
              data-testid="puck-zone"
            >
              {data.zones?.[`Flex-1:${zone}`]?.[0]?.props.id}
            </output>
          ),
        },
      });
    }
    return (
      <output
        data-header-preview={String(data.content[0]?.props.isPreview ?? false)}
        data-testid="puck-render"
      >
        {data.content[0]?.props.title}
      </output>
    );
  },
}));
vi.mock('@/components/builder/config', () => ({
  builderConfig: { components: { ProductGrid: {} } },
}));

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

  it('preserves a Flex zone and marks a nested Header preview-only', () => {
    const config = {
      content: [{ props: { id: 'Flex-1' }, type: 'Flex' }],
      root: { props: { title: 'Home' } },
      zones: {
        'Flex-1:children': [{ props: { id: 'header-1' }, type: 'Header' }],
      },
    };
    expect(
      builderPreviewMessageSchema.safeParse({
        candidateConfig: config,
        capabilityHash: builderDesignCapabilities.capabilityHash,
        capabilityVersion: builderDesignCapabilities.capabilityVersion,
        merchant: { id: 'merchant-1', slug: 'acme-store' },
        revision: 1,
        type: 'baci.builder-preview.render',
        version: 1,
      }).success
    ).toBe(true);
    render(
      <RenderBuilderConfig config={config} merchantContext={merchantContext} />
    );

    expect(screen.getByTestId('puck-zone')).toHaveTextContent('header-1');
    expect(screen.getByTestId('puck-zone')).toHaveAttribute(
      'data-header-preview',
      'true'
    );
  });

  it('uses the bounded local fixture instead of the public ProductGrid renderer', () => {
    render(
      <RenderBuilderConfig
        config={{
          content: [
            {
              props: { columns: 4, id: 'grid-1', limit: 24, title: 'Shop' },
              type: 'ProductGrid',
            },
          ],
          root: { props: { title: 'Home' } },
        }}
        merchantContext={merchantContext}
      />
    );

    expect(screen.getByTestId('builder-preview-products')).toHaveAttribute(
      'data-fixture-version',
      'v1'
    );
  });

  it('keeps accepted script-like text inert on the renderer path', () => {
    render(
      <RenderBuilderConfig
        config={{
          content: [
            {
              props: { id: 'text-1', title: '<script>alert(1)</script>' },
              type: 'Text',
            },
          ],
          root: { props: { title: 'Home' } },
        }}
        merchantContext={merchantContext}
      />
    );

    expect(screen.getByTestId('puck-render')).toHaveTextContent(
      '<script>alert(1)</script>'
    );
    expect(document.querySelector('script')).toBeNull();
  });

  it('normalizes the same partial theme deterministically', () => {
    const config = {
      content: [{ props: { id: 'text-1', title: 'Welcome' }, type: 'Text' }],
      root: { props: { title: 'Home' } },
      theme: { colors: { primary: '#14532d' } },
    };
    const { rerender } = render(
      <RenderBuilderConfig config={config} merchantContext={merchantContext} />
    );
    const firstTheme = screen
      .getByTestId('builder-preview-surface')
      .getAttribute('style');

    rerender(
      <RenderBuilderConfig config={config} merchantContext={merchantContext} />
    );

    expect(screen.getByTestId('builder-preview-surface')).toHaveAttribute(
      'style',
      firstTheme ?? ''
    );
  });
});
