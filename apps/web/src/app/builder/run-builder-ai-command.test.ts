import type { Data } from '@puckeditor/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchWithCsrf } from '@/lib/api-client';
import { applyTheme } from '@/lib/theme-manager';
import { runBuilderAiCommand } from './run-builder-ai-command';

type RunBuilderAiCommandParams = Parameters<typeof runBuilderAiCommand>[0];

vi.mock('@/lib/api-client', () => ({
  fetchWithCsrf: vi.fn(),
}));

vi.mock('@/lib/theme-manager', () => ({
  applyTheme: vi.fn(),
}));

function createToastMock<T extends { toast: unknown }>() {
  return Object.assign(vi.fn(), { promise: vi.fn() }) as unknown as T['toast'];
}

const mockFetchWithCsrf = vi.mocked(fetchWithCsrf);
const mockApplyTheme = vi.mocked(applyTheme);

function jsonResponse(body: unknown, ok = true): Response {
  return {
    ok,
    json: vi.fn().mockResolvedValue(body),
  } as unknown as Response;
}

function createParams() {
  return {
    merchantId: 'merchant-1',
    isCurrentRequest: () => true,
    command: 'make it premium',
    currentConfig: { content: [], root: {}, zones: {} } as Data,
    setData: vi.fn(),
    setIsAiLoading: vi.fn(),
    toast: createToastMock<RunBuilderAiCommandParams>(),
  };
}

describe('runBuilderAiCommand', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not apply a deferred original merchant A success after A to B to A switches', async () => {
    let resolveRequest!: (value: Response) => void;
    const pendingResponse = new Promise<Response>((resolve) => {
      resolveRequest = resolve;
    });
    let activeRequest = 1;
    mockFetchWithCsrf.mockReturnValue(pendingResponse);
    const params = {
      ...createParams(),
      isCurrentRequest: () => activeRequest === 1,
    };
    const command = runBuilderAiCommand(params);

    activeRequest = 2;
    activeRequest = 3;
    resolveRequest(
      jsonResponse({
        config: { content: [], root: { title: 'Merchant A' }, zones: {} },
      })
    );
    await command;

    expect(params.setData).not.toHaveBeenCalled();
    expect(mockApplyTheme).not.toHaveBeenCalled();
    expect(params.toast).not.toHaveBeenCalled();
  });

  it('does not show a deferred merchant A error after the active merchant switches to B', async () => {
    let rejectRequest!: (error: Error) => void;
    const pendingRequest = new Promise<Response>((_resolve, reject) => {
      rejectRequest = reject;
    });
    let activeRequest = 1;
    mockFetchWithCsrf.mockReturnValue(pendingRequest);
    const params = {
      ...createParams(),
      isCurrentRequest: () => activeRequest === 1,
    };
    const command = runBuilderAiCommand(params);

    activeRequest = 2;
    rejectRequest(new Error('Merchant A request failed'));
    await command;

    expect(params.setData).not.toHaveBeenCalled();
    expect(mockApplyTheme).not.toHaveBeenCalled();
    expect(params.toast).not.toHaveBeenCalled();
  });

  it('lets only the latest same-merchant AI request control updates and loading', async () => {
    let resolveFirst!: (value: Response) => void;
    let resolveSecond!: (value: Response) => void;
    const firstResponse = new Promise<Response>((resolve) => {
      resolveFirst = resolve;
    });
    const secondResponse = new Promise<Response>((resolve) => {
      resolveSecond = resolve;
    });
    let activeRequest = 1;
    mockFetchWithCsrf
      .mockReturnValueOnce(firstResponse)
      .mockReturnValueOnce(secondResponse);
    const firstParams = {
      ...createParams(),
      isCurrentRequest: () => activeRequest === 1,
    };
    const secondParams = {
      ...createParams(),
      isCurrentRequest: () => activeRequest === 2,
    };
    const first = runBuilderAiCommand(firstParams);
    activeRequest = 2;
    const second = runBuilderAiCommand(secondParams);

    resolveFirst(
      jsonResponse({
        config: { content: [], root: { title: 'Older' }, zones: {} },
      })
    );
    await first;
    expect(firstParams.setData).not.toHaveBeenCalled();
    expect(firstParams.setIsAiLoading).toHaveBeenCalledWith(true);
    expect(firstParams.setIsAiLoading).not.toHaveBeenCalledWith(false);
    expect(firstParams.toast).not.toHaveBeenCalled();

    resolveSecond(
      jsonResponse({
        config: { content: [], root: { title: 'Latest' }, zones: {} },
      })
    );
    await second;
    expect(secondParams.setData).toHaveBeenCalledWith({
      content: [],
      root: { title: 'Latest' },
      zones: {},
    });
    expect(secondParams.setIsAiLoading).toHaveBeenLastCalledWith(false);
    expect(secondParams.toast).toHaveBeenCalledTimes(1);
  });

  it('applies successful AI config updates and theme changes', async () => {
    const config = {
      content: [],
      root: {},
      zones: {},
      theme: { primary: '#000000' },
    };
    mockFetchWithCsrf.mockResolvedValue(jsonResponse({ config }));
    const params = createParams();

    await runBuilderAiCommand(params);

    expect(params.setIsAiLoading).toHaveBeenNthCalledWith(1, true);
    expect(mockFetchWithCsrf).toHaveBeenCalledWith('/api/builder/gemini', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        merchantId: params.merchantId,
        prompt: params.command,
        currentConfig: params.currentConfig,
      }),
    });
    expect(params.setData).toHaveBeenCalledWith(config);
    expect(mockApplyTheme).toHaveBeenCalledWith(config.theme);
    expect(params.toast).toHaveBeenCalledWith({
      title: '✨ Design Updated',
      description: 'Gemini AI has applied your changes successfully!',
    });
    expect(params.setIsAiLoading).toHaveBeenLastCalledWith(false);
  });

  it('shows a warning toast when the AI response is incomplete', async () => {
    mockFetchWithCsrf.mockResolvedValue(jsonResponse({}));
    const params = createParams();

    await runBuilderAiCommand(params);

    expect(params.setData).not.toHaveBeenCalled();
    expect(params.toast).toHaveBeenCalledWith({
      title: 'Warning',
      description: 'AI response was incomplete. Please try again.',
      variant: 'destructive',
    });
    expect(params.setIsAiLoading).toHaveBeenLastCalledWith(false);
  });

  it('shows an error toast for non-ok responses', async () => {
    mockFetchWithCsrf.mockResolvedValue(
      jsonResponse({ details: 'Model unavailable' }, false)
    );
    const params = createParams();

    await runBuilderAiCommand(params);

    expect(params.toast).toHaveBeenCalledWith({
      title: 'Error',
      description: 'Model unavailable',
      variant: 'destructive',
    });
    expect(params.setIsAiLoading).toHaveBeenLastCalledWith(false);
  });

  it('shows an error toast for network failures', async () => {
    mockFetchWithCsrf.mockRejectedValue(new Error('Network down'));
    const params = createParams();

    await runBuilderAiCommand(params);

    expect(params.toast).toHaveBeenCalledWith({
      title: 'Error',
      description: 'Network down',
      variant: 'destructive',
    });
    expect(params.setIsAiLoading).toHaveBeenLastCalledWith(false);
  });
});
