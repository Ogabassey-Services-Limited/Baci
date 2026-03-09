import { beforeEach, describe, expect, it, vi } from 'vitest';
import { shareProductLink } from './product-share';

const SHARE_ARGS = {
  merchantName: 'Ogabassey',
  productName: 'Pixel 9',
  url: 'https://ogabassey.com/products/pixel-9',
  toast: vi.fn(),
};

beforeEach(() => {
  vi.clearAllMocks();
  // Remove any navigator APIs set by previous tests
  Object.defineProperty(navigator, 'share', {
    configurable: true,
    writable: true,
    value: undefined,
  });
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    writable: true,
    value: undefined,
  });
});

describe('shareProductLink', () => {
  it('uses navigator.share when available and does not call toast on success', async () => {
    const shareMock = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'share', {
      configurable: true,
      writable: true,
      value: shareMock,
    });

    await shareProductLink(SHARE_ARGS);

    expect(shareMock).toHaveBeenCalledWith({
      title: 'Pixel 9',
      text: 'Check out Pixel 9 on Ogabassey',
      url: 'https://ogabassey.com/products/pixel-9',
    });
    expect(SHARE_ARGS.toast).not.toHaveBeenCalled();
  });

  it('returns early without toast when navigator.share rejects with AbortError', async () => {
    const abortError = new Error('Aborted');
    abortError.name = 'AbortError';
    const shareMock = vi.fn().mockRejectedValue(abortError);
    Object.defineProperty(navigator, 'share', {
      configurable: true,
      writable: true,
      value: shareMock,
    });

    await shareProductLink(SHARE_ARGS);

    expect(SHARE_ARGS.toast).not.toHaveBeenCalled();
  });

  it('copies to clipboard and shows "Link copied!" toast when navigator.share is unavailable', async () => {
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      writable: true,
      value: { writeText: writeTextMock },
    });

    await shareProductLink(SHARE_ARGS);

    expect(writeTextMock).toHaveBeenCalledWith(
      'https://ogabassey.com/products/pixel-9'
    );
    expect(SHARE_ARGS.toast).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Link copied!' })
    );
  });

  it('creates and removes a textarea fallback when clipboard.writeText rejects', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      writable: true,
      value: {
        writeText: vi.fn().mockRejectedValue(new Error('Clipboard denied')),
      },
    });

    // jsdom does not implement execCommand; stub it to prevent TypeError
    document.execCommand = vi.fn().mockReturnValue(false);

    const appendChildSpy = vi.spyOn(document.body, 'appendChild');
    const removeChildSpy = vi.spyOn(document.body, 'removeChild');

    await shareProductLink(SHARE_ARGS);

    // A textarea should have been appended then removed
    expect(appendChildSpy).toHaveBeenCalledTimes(1);
    const appended = appendChildSpy.mock.calls[0][0] as HTMLTextAreaElement;
    expect(appended.tagName).toBe('TEXTAREA');
    expect(appended.value).toBe('https://ogabassey.com/products/pixel-9');

    expect(removeChildSpy).toHaveBeenCalledTimes(1);
  });
});
