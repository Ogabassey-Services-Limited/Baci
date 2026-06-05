import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { render, waitFor } from '@testing-library/react-native';
import { RouteResumeController, resetRouteResumeForTest } from './RouteResumeController';

let mockPathname = '/';
let mockSearchParams: Record<string, string | string[]> = {};
let mockNavigationState: { key: string } | undefined = { key: 'root' };
const mockReplace = jest.fn();

jest.mock('expo-router', () => ({
  router: {
    replace: (href: unknown) => mockReplace(href),
  },
  useGlobalSearchParams: () => mockSearchParams,
  usePathname: () => mockPathname,
  useRootNavigationState: () => mockNavigationState,
}));

describe('RouteResumeController', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetRouteResumeForTest();
    mockPathname = '/';
    mockSearchParams = {};
    mockNavigationState = { key: 'root' };
  });

  it('restores the last checkout route when the root navigator remounts at home', async () => {
    mockPathname = '/checkout';
    const firstRender = render(<RouteResumeController shouldResume={false} />);

    expect(mockReplace).not.toHaveBeenCalled();

    firstRender.unmount();
    mockPathname = '/';

    render(<RouteResumeController shouldResume />);

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/checkout');
    });
  });

  it('preserves payment route query params when restoring', async () => {
    mockPathname = '/payment-gateway';
    mockSearchParams = {
      authorizationUrl: 'https://checkout.paystack.com/test',
      orderId: 'order-123',
    };
    const firstRender = render(<RouteResumeController shouldResume={false} />);

    firstRender.unmount();
    mockPathname = '/';
    mockSearchParams = {};

    render(<RouteResumeController shouldResume />);

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith(
        '/payment-gateway?authorizationUrl=https%3A%2F%2Fcheckout.paystack.com%2Ftest&orderId=order-123'
      );
    });
  });

  it('preserves repeated array search params when restoring', async () => {
    mockPathname = '/cart';
    mockSearchParams = {
      empty: [],
      items: ['item-1', 'item-2', 'item-3'],
    };
    const firstRender = render(<RouteResumeController shouldResume={false} />);

    firstRender.unmount();
    mockPathname = '/';
    mockSearchParams = {};

    render(<RouteResumeController shouldResume />);

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith(
        '/cart?items=item-1&items=item-2&items=item-3'
      );
    });
  });

  it('does not restore non-commerce routes', () => {
    mockPathname = '/auth/login';
    const firstRender = render(<RouteResumeController shouldResume={false} />);

    firstRender.unmount();
    mockPathname = '/';

    render(<RouteResumeController shouldResume />);

    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('clears the remembered route when the customer intentionally returns home', () => {
    mockPathname = '/checkout';
    const checkoutRender = render(
      <RouteResumeController shouldResume={false} />
    );

    checkoutRender.unmount();
    mockPathname = '/';
    const homeRender = render(<RouteResumeController shouldResume={false} />);

    homeRender.unmount();
    render(<RouteResumeController shouldResume />);

    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('waits until root navigation is ready before restoring', () => {
    mockPathname = '/cart';
    const firstRender = render(<RouteResumeController shouldResume={false} />);

    firstRender.unmount();
    mockPathname = '/';
    mockNavigationState = undefined;

    render(<RouteResumeController shouldResume />);

    expect(mockReplace).not.toHaveBeenCalled();
  });
});
