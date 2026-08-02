import './builder-client.test-support';
import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import BuilderClient from './builder-client';
import {
  builderClientTestMocks,
  cleanupBuilderClientTest,
  createBuilderPayload,
  mockBuilderBootstrap,
  resetBuilderClientTest,
} from './builder-client.test-support';

vi.mock('@/components/ui/alert-dialog', async () => {
  const { default: alertDialogMock } = await import(
    './builder-client-alert-dialog.test-support'
  );
  return alertDialogMock;
});

describe('BuilderClient', () => {
  beforeEach(resetBuilderClientTest);
  afterEach(cleanupBuilderClientTest);

  it('creates the initial store and setup defaults in one factory call', () => {
    render(<BuilderClient />);

    expect(builderClientTestMocks.defaultSettingsFactory).toHaveBeenCalledTimes(
      1
    );
  });

  it('renders the builder in read-only recovery mode when the payload is degraded', async () => {
    render(<BuilderClient />);

    await waitFor(() => {
      expect(
        screen.getByText('Builder is in read-only mode')
      ).toBeInTheDocument();
    });

    expect(screen.getByRole('button', { name: /save draft/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /publish/i })).toBeDisabled();
    expect(screen.getAllByTestId('gemini-command-bar')).toHaveLength(2);
    expect(builderClientTestMocks.toast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Builder opened in read-only mode',
      })
    );
  });

  it('renders the builder in editable mode when the payload is healthy', async () => {
    mockBuilderBootstrap(
      createBuilderPayload({
        canApplyAiDraft: true,
        canEdit: true,
        degraded: false,
        degradedReason: null,
        lastUpdated: '2026-03-20T18:00:00.000Z',
      })
    );

    render(<BuilderClient />);

    const saveButton = await screen.findByRole('button', {
      name: /save draft/i,
    });

    expect(
      screen.queryByText('Builder is in read-only mode')
    ).not.toBeInTheDocument();
    expect(saveButton).not.toBeDisabled();
    expect(screen.getByRole('button', { name: /publish/i })).not.toBeDisabled();
  });

  it('wraps the builder preview in CartProvider', async () => {
    mockBuilderBootstrap(
      createBuilderPayload({
        canApplyAiDraft: true,
        canEdit: true,
        config: {
          content: [{ type: 'Header', props: { id: 'header' } }],
          root: { title: 'Home' },
          zones: {},
        },
        degraded: false,
        degradedReason: null,
        isDefault: false,
        lastUpdated: '2026-03-20T18:00:00.000Z',
      })
    );

    render(<BuilderClient />);

    const preview = await screen.findByTestId('puck-preview');

    expect(screen.getByTestId('cart-provider')).toContainElement(preview);
  });

  it('aborts the bootstrap request when the builder unmounts', async () => {
    let bootstrapSignal: AbortSignal | undefined;
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      (_input: string | URL | Request, init?: RequestInit) => {
        bootstrapSignal = init?.signal as AbortSignal | undefined;

        return new Promise<Response>(() => {
          // Intentionally unresolved so unmount cleanup owns cancellation.
        });
      }
    );

    const { unmount } = render(<BuilderClient />);

    await waitFor(() => {
      expect(bootstrapSignal).toBeInstanceOf(AbortSignal);
    });
    expect(bootstrapSignal?.aborted).toBe(false);

    unmount();

    expect(bootstrapSignal?.aborted).toBe(true);
  });
});
