import './builder-client.test-support';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import BuilderClient from './builder-client';
import {
  builderClientTestMocks,
  cleanupBuilderClientTest,
  createBuilderPayload,
  mockBuilderBootstrap,
  resetBuilderClientTest,
  setBuilderClientMerchant,
} from './builder-client.test-support';

describe('BuilderClient AI drafts', () => {
  beforeEach(resetBuilderClientTest);
  afterEach(cleanupBuilderClientTest);

  it('includes the AI draft job id from the URL when bootstrapping', async () => {
    const aiDraftJobId = '5c0a0676-bd3f-495e-9f98-589f208c0d79';
    window.history.pushState({}, '', `/builder?aiDraftJobId=${aiDraftJobId}`);
    mockBuilderBootstrap(
      createBuilderPayload({
        aiDraftJobId,
        canEdit: false,
        config: { content: [], root: { title: 'AI Home' }, zones: {} },
        degraded: false,
        degradedReason: null,
        isDefault: false,
        lastUpdated: '2026-04-28T10:00:00.000Z',
        previewMode: 'ai_draft',
      })
    );

    render(<BuilderClient />);

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledWith(
        expect.stringContaining(`aiDraftJobId=${aiDraftJobId}`),
        expect.objectContaining({ signal: expect.any(AbortSignal) })
      );
    });
  });

  it('clears an AI draft URL parameter before loading after the active merchant changes', async () => {
    const aiDraftJobId = '5c0a0676-bd3f-495e-9f98-589f208c0d79';
    window.history.pushState({}, '', `/builder?aiDraftJobId=${aiDraftJobId}`);
    mockBuilderBootstrap(createBuilderPayload());

    const view = render(<BuilderClient />);

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    });

    setBuilderClientMerchant('merchant-2', 'second-store');
    view.rerender(<BuilderClient />);

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledTimes(2);
    });

    const [requestUrl] = vi.mocked(globalThis.fetch).mock.calls[1];
    const url = new URL(String(requestUrl));
    expect(url.searchParams.get('merchantId')).toBe('merchant-2');
    expect(url.searchParams.get('aiDraftJobId')).toBeNull();
    expect(window.location.search).toBe('');
  });

  it('renders AI draft previews without apply controls for view-only staff', async () => {
    mockBuilderBootstrap(
      createBuilderPayload({
        aiDraftJobId: '5c0a0676-bd3f-495e-9f98-589f208c0d79',
        config: { content: [], root: { title: 'AI Home' }, zones: {} },
        degraded: false,
        degradedReason: null,
        isDefault: false,
        lastUpdated: '2026-04-28T10:00:00.000Z',
        previewMode: 'ai_draft',
      })
    );

    render(<BuilderClient />);

    await waitFor(() => {
      expect(screen.getAllByText(/AI draft preview/i).length).toBeGreaterThan(
        0
      );
    });

    expect(
      screen.queryByRole('button', { name: /apply ai design/i })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /save draft/i })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /publish/i })
    ).not.toBeInTheDocument();
  });

  it('applies AI draft previews for users with builder edit access', async () => {
    const aiDraftJobId = '5c0a0676-bd3f-495e-9f98-589f208c0d79';
    mockBuilderBootstrap(
      createBuilderPayload({
        aiDraftJobId,
        canApplyAiDraft: true,
        config: { content: [], root: { title: 'AI Home' }, zones: {} },
        degraded: false,
        degradedReason: null,
        isDefault: false,
        lastUpdated: '2026-04-28T10:00:00.000Z',
        previewMode: 'ai_draft',
      })
    );
    builderClientTestMocks.fetchWithCsrf.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        lastUpdated: '2026-04-28T10:10:00.000Z',
      }),
    } as Response);

    render(<BuilderClient />);

    const applyButton = await screen.findByRole('button', {
      name: /apply ai design/i,
    });
    fireEvent.click(applyButton);

    await waitFor(() => {
      expect(builderClientTestMocks.fetchWithCsrf).toHaveBeenCalledWith(
        `/api/ai-jobs/${aiDraftJobId}/apply`,
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ merchantId: 'merchant-1' }),
        })
      );
    });
    expect(builderClientTestMocks.toast).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'AI design applied' })
    );
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /save draft/i })).toBeEnabled();
      expect(
        screen.queryByRole('button', { name: /apply ai design/i })
      ).not.toBeInTheDocument();
    });
    expect(builderClientTestMocks.push).toHaveBeenCalledWith('/builder');
  });

  it('confirms before force-applying a stale AI draft preview', async () => {
    const aiDraftJobId = '5c0a0676-bd3f-495e-9f98-589f208c0d79';
    mockBuilderBootstrap(
      createBuilderPayload({
        aiDraftJobId,
        canApplyAiDraft: true,
        config: { content: [], root: { title: 'AI Home' }, zones: {} },
        degraded: false,
        degradedReason: null,
        isDefault: false,
        lastUpdated: '2026-04-28T10:00:00.000Z',
        previewMode: 'ai_draft',
      })
    );
    builderClientTestMocks.fetchWithCsrf
      .mockResolvedValueOnce({
        ok: false,
        status: 409,
        json: async () => ({ code: 'ai_draft_stale' }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          lastUpdated: '2026-04-28T10:10:00.000Z',
        }),
      } as Response);

    render(<BuilderClient />);

    const applyButton = await screen.findByRole('button', {
      name: /apply ai design/i,
    });
    fireEvent.click(applyButton);

    const dialog = await screen.findByRole('alertdialog', {
      name: /replace your current draft/i,
    });
    expect(dialog).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /replace draft/i }));

    await waitFor(() => {
      expect(builderClientTestMocks.fetchWithCsrf).toHaveBeenCalledTimes(2);
    });
    expect(builderClientTestMocks.fetchWithCsrf).toHaveBeenLastCalledWith(
      `/api/ai-jobs/${aiDraftJobId}/apply`,
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ merchantId: 'merchant-1', force: true }),
      })
    );
  });
});
