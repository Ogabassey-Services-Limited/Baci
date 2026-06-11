import type { RefObject } from 'react';
import type { WebView } from 'react-native-webview';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  alert: vi.fn(),
  getSession: vi.fn(),
  injectJavaScript: vi.fn(),
  requestBlogEditorAiEdit: vi.fn(),
}));

vi.mock('react-native', () => ({
  Alert: {
    alert: mocks.alert,
  },
}));

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: mocks.getSession,
    },
  },
}));

vi.mock('@/components/blog-editor/blog-editor-api', () => ({
  requestBlogEditorAiEdit: mocks.requestBlogEditorAiEdit,
}));

import { processBlogEditorAiRequest } from './useBlogEditor.processAiRequest';

function createOptions(overrides?: {
  currentHtml?: string;
  webViewRef?: RefObject<WebView | null>;
}) {
  return {
    aiInstruction: 'Polish this',
    currentHtml: overrides?.currentHtml ?? '<p>Hello world</p>',
    setAiInstruction: vi.fn(),
    setContent: vi.fn(),
    setIsAIProcessing: vi.fn(),
    webViewRef:
      overrides?.webViewRef ??
      ({
        current: {
          injectJavaScript: mocks.injectJavaScript,
        } as unknown as WebView,
      } satisfies RefObject<WebView | null>),
  };
}

describe('processBlogEditorAiRequest', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    mocks.getSession.mockResolvedValue({
      data: {
        session: {
          access_token: 'token',
        },
      },
      error: null,
    });
    mocks.requestBlogEditorAiEdit.mockResolvedValue('<p>Polished</p>');
  });

  it('injects the AI result, updates content, and clears the instruction', async () => {
    const options = createOptions();

    await processBlogEditorAiRequest(options);

    expect(mocks.requestBlogEditorAiEdit).toHaveBeenCalledWith(
      expect.objectContaining({
        accessToken: 'token',
        content: '<p>Hello world</p>',
        instruction: 'Polish this',
      })
    );
    expect(mocks.injectJavaScript).toHaveBeenCalledWith(
      expect.stringContaining(JSON.stringify('<p>Polished</p>'))
    );
    expect(options.setContent).toHaveBeenCalledWith('<p>Polished</p>');
    expect(options.setAiInstruction).toHaveBeenCalledWith('');
    expect(mocks.alert).toHaveBeenCalledWith(
      'Success',
      'Content has been polished by AI!'
    );
    expect(options.setIsAIProcessing).toHaveBeenCalledWith(false);
  });

  it('warns and stops processing when the editor content is empty', async () => {
    const options = createOptions({ currentHtml: '   ' });

    await processBlogEditorAiRequest(options);

    expect(mocks.alert).toHaveBeenCalledWith(
      'Empty',
      'Write some content first!'
    );
    expect(mocks.requestBlogEditorAiEdit).not.toHaveBeenCalled();
    expect(options.setContent).not.toHaveBeenCalled();
    expect(options.setIsAIProcessing).toHaveBeenCalledWith(false);
  });

  it('surfaces an AI error when there is no session', async () => {
    mocks.getSession.mockResolvedValue({
      data: { session: null },
      error: null,
    });
    const options = createOptions();

    await processBlogEditorAiRequest(options);

    expect(mocks.alert).toHaveBeenCalledWith('AI Error', 'No session');
    expect(options.setContent).not.toHaveBeenCalled();
    expect(options.setIsAIProcessing).toHaveBeenCalledWith(false);
  });

  it('surfaces an AI error when the editor web view is unavailable', async () => {
    const options = createOptions({ webViewRef: { current: null } });

    await processBlogEditorAiRequest(options);

    expect(mocks.alert).toHaveBeenCalledWith('AI Error', 'Editor unavailable');
    expect(options.setContent).not.toHaveBeenCalled();
    expect(options.setIsAIProcessing).toHaveBeenCalledWith(false);
  });
});
