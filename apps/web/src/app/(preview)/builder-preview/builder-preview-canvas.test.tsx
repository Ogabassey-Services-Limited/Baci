import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { builderDesignCapabilities } from '@baci/shared/contracts';
import { act, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BuilderPreviewCanvas } from './builder-preview-canvas';

vi.mock('@/components/storefront/render-builder-config', () => ({
  RenderBuilderConfig: ({
    config,
    merchantContext,
  }: {
    config: { content: Array<{ props: { id: string } }> };
    merchantContext: { basePath: string };
  }) => (
    <output
      data-base-path={merchantContext.basePath}
      data-testid="builder-preview-render"
    >
      {config.content[0]?.props.id}
    </output>
  ),
}));

const validMessage = (revision: number, id = 'text-1') => ({
  candidateConfig: {
    content: [{ props: { id, title: 'Welcome' }, type: 'Text' }],
    root: { props: { title: 'Home' } },
  },
  capabilityHash: builderDesignCapabilities.capabilityHash,
  capabilityVersion: builderDesignCapabilities.capabilityVersion,
  merchant: {
    basePath: '/acme-store',
    id: 'merchant-1',
    slug: 'acme-store',
  },
  revision,
  type: 'baci.builder-preview.render',
  version: 1,
});

function installBridge() {
  const postMessage = vi.fn();
  Object.defineProperty(window, 'ReactNativeWebView', {
    configurable: true,
    value: { postMessage },
  });
  return postMessage;
}

function send(data: unknown) {
  act(() => window.dispatchEvent(new MessageEvent('message', { data })));
}

describe('BuilderPreviewCanvas', () => {
  afterEach(() => {
    delete (window as Window & { ReactNativeWebView?: unknown })
      .ReactNativeWebView;
  });

  it('announces ready only after mounting and renders no merchant content first', async () => {
    const postMessage = installBridge();
    render(<BuilderPreviewCanvas />);

    expect(
      screen.queryByTestId('builder-preview-render')
    ).not.toBeInTheDocument();
    await waitFor(() => expect(postMessage).toHaveBeenCalledTimes(1));
    expect(JSON.parse(postMessage.mock.calls[0][0])).toEqual({
      capabilityHash: builderDesignCapabilities.capabilityHash,
      capabilityVersion: builderDesignCapabilities.capabilityVersion,
      type: 'baci.builder-preview.ready',
      version: 1,
    });
  });

  it('renders only a valid in-memory candidate with its merchant base path', async () => {
    const postMessage = installBridge();
    render(<BuilderPreviewCanvas />);

    send(validMessage(3));

    expect(
      await screen.findByTestId('builder-preview-render')
    ).toHaveTextContent('text-1');
    expect(screen.getByTestId('builder-preview-render')).toHaveAttribute(
      'data-base-path',
      '/acme-store'
    );
    await waitFor(() =>
      expect(postMessage).toHaveBeenCalledWith(
        expect.stringContaining('"revision":3')
      )
    );
  });

  it('ignores stale and lower revisions after accepting a newer candidate', async () => {
    installBridge();
    render(<BuilderPreviewCanvas />);

    send(validMessage(4, 'newer'));
    expect(await screen.findByText('newer')).toBeInTheDocument();
    send(validMessage(3, 'older'));
    send(validMessage(4, 'stale'));

    expect(screen.getByTestId('builder-preview-render')).toHaveTextContent(
      'newer'
    );
  });

  it('responds to hostile invalid payloads with a bounded error that never echoes the candidate', async () => {
    const postMessage = installBridge();
    render(<BuilderPreviewCanvas />);
    const secret = '<script>merchant-secret</script>';

    send({
      ...validMessage(1),
      candidateConfig: { content: [], root: { props: {} }, secret },
    });

    await waitFor(() => expect(postMessage).toHaveBeenCalledTimes(2));
    const response = JSON.parse(postMessage.mock.calls[1][0]);
    expect(response).toEqual({
      code: 'invalid_message',
      type: 'baci.builder-preview.error',
      version: 1,
    });
    expect(JSON.stringify(response)).not.toContain(secret);
    expect(
      screen.queryByTestId('builder-preview-render')
    ).not.toBeInTheDocument();
  });

  it('declares a private no-store and noindex preview route', () => {
    const source = readFileSync(resolve(__dirname, 'page.tsx'), 'utf8');

    expect(source).toContain("fetchCache = 'force-no-store'");
    expect(source).toContain("dynamic = 'force-dynamic'");
    expect(source).toContain('follow: false');
    expect(source).toContain('index: false');
  });
});
