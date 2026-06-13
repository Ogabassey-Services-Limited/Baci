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
