import { render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockHomeCssImport = vi.hoisted(() => {
  const state = {
    error: undefined as Error | undefined,
    load: vi.fn(),
  };

  return {
    factory: () => {
      state.load();
      if (state.error) {
        throw state.error;
      }
      return {};
    },
    state,
  };
});

vi.mock('@/app/(storefront)/storefront-home.css', mockHomeCssImport.factory);

import { OgabasseyHomeStyleLoader } from './ogabassey-home-style-loader';

describe('OgabasseyHomeStyleLoader', () => {
  beforeEach(() => {
    mockHomeCssImport.state.error = undefined;
    mockHomeCssImport.state.load.mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders no visible content while loading the default non-critical stylesheet after hydration', async () => {
    const { container } = render(<OgabasseyHomeStyleLoader />);

    expect(container).toBeEmptyDOMElement();

    await waitFor(() => {
      expect(mockHomeCssImport.state.load).toHaveBeenCalledOnce();
    });
  });

  it('logs stylesheet load failures with context', async () => {
    const error = new Error('css failed');
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);

    mockHomeCssImport.state.error = error;
    vi.resetModules();
    vi.doMock(
      '@/app/(storefront)/storefront-home.css',
      mockHomeCssImport.factory
    );

    const { OgabasseyHomeStyleLoader: ThrowingStyleLoader } = await import(
      './ogabassey-home-style-loader'
    );

    render(<ThrowingStyleLoader />);

    await waitFor(() => {
      expect(consoleError).toHaveBeenCalledOnce();
    });

    const [loggedError] = consoleError.mock.calls[0] ?? [];
    expect(loggedError).toBeInstanceOf(Error);
    const contextualError = loggedError as Error & {
      cause?: Error & { cause?: unknown };
    };
    expect(contextualError.message).toBe(
      'Failed to load OgaBassey homepage stylesheet'
    );
    expect(contextualError.cause).toBeInstanceOf(Error);
    expect(contextualError.cause?.cause).toBe(error);
  });
});
