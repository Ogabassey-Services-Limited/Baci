import { render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockHomeCssImport = vi.hoisted(() => vi.fn());

vi.mock('@/app/(storefront)/storefront-home.css', () => {
  mockHomeCssImport();
  return {};
});

import { OgabasseyHomeStyleLoader } from './ogabassey-home-style-loader';

describe('OgabasseyHomeStyleLoader', () => {
  beforeEach(() => {
    mockHomeCssImport.mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders no visible content while deferring non-critical styles', () => {
    const { container } = render(
      <OgabasseyHomeStyleLoader loadStyles={() => Promise.resolve({})} />
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('loads the default non-critical stylesheet after hydration', async () => {
    render(<OgabasseyHomeStyleLoader />);

    await waitFor(() => {
      expect(mockHomeCssImport).toHaveBeenCalledOnce();
    });
  });

  it('loads the non-critical stylesheet with an injected loader after hydration', async () => {
    const loadStyles = vi.fn(() => Promise.resolve({}));

    render(<OgabasseyHomeStyleLoader loadStyles={loadStyles} />);

    await waitFor(() => {
      expect(loadStyles).toHaveBeenCalledOnce();
    });
  });

  it('logs stylesheet load failures with context', async () => {
    const error = new Error('css failed');
    const loadStyles = vi.fn(() => Promise.reject(error));
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);

    render(<OgabasseyHomeStyleLoader loadStyles={loadStyles} />);

    await waitFor(() => {
      expect(consoleError).toHaveBeenCalledWith(
        'Failed to load OgaBassey homepage stylesheet',
        error
      );
    });
  });
});
