import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { JumiaIntegration } from './use-jumia-integrations';

/* ------------------------------------------------------------------ */
/*  Mocks                                                              */
/* ------------------------------------------------------------------ */

const mockToast = vi.fn();
vi.mock('@/hooks/use-toast', () => ({
  useToast: vi.fn(() => ({ toast: mockToast })),
}));

const mockPush = vi.fn();
const mockReplace = vi.fn();
let mockSearchParams = new URLSearchParams();

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(() => ({ push: mockPush, replace: mockReplace })),
  useSearchParams: vi.fn(() => mockSearchParams),
}));

vi.mock('next/link', () => ({
  default: ({
    children,
    href,
    ...props
  }: {
    children: React.ReactNode;
    href: string;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock('@/components/ui/bag-loader', () => ({
  BagLoader: () => <div data-testid="bag-loader">Loading...</div>,
}));

const mockRefetch = vi.fn(async (): Promise<JumiaIntegration[]> => []);
const mockSetIntegrations = vi.fn();
const mockDisconnectIntegration = vi.fn();
const mockSyncOrders = vi.fn();

vi.mock('./use-jumia-integrations', () => ({
  useJumiaIntegrations: vi.fn(),
  disconnectIntegration: (...args: unknown[]) =>
    mockDisconnectIntegration(...args),
  syncOrders: (...args: unknown[]) => mockSyncOrders(...args),
}));

vi.mock('./connect-jumia-dialog', () => ({
  ConnectJumiaDialog: ({
    open,
    onOpenChange,
  }: {
    open: boolean;
    onOpenChange: (v: boolean) => void;
    onConnected: () => void;
  }) =>
    open ? (
      <div data-testid="connect-dialog">
        <button type="button" onClick={() => onOpenChange(false)}>
          Close
        </button>
      </div>
    ) : null,
}));

import ChannelsClientPage from './client-page';
import { useJumiaIntegrations } from './use-jumia-integrations';

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function setupHook(overrides: {
  integrations?: JumiaIntegration[];
  loading?: boolean;
  error?: string | null;
}) {
  vi.mocked(useJumiaIntegrations).mockReturnValue({
    integrations: overrides.integrations ?? [],
    setIntegrations: mockSetIntegrations,
    loading: overrides.loading ?? false,
    error: overrides.error ?? null,
    refetch: mockRefetch,
  });
}

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe('ChannelsClientPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSearchParams = new URLSearchParams();
  });

  describe('loading state', () => {
    it('renders the loader when loading is true', () => {
      setupHook({ loading: true });
      render(<ChannelsClientPage />);

      expect(screen.getByTestId('bag-loader')).toBeInTheDocument();
      expect(screen.queryByText('Marketplaces')).not.toBeInTheDocument();
    });
  });

  describe('error state', () => {
    it('displays the fetch error message', () => {
      setupHook({ error: 'Failed to load integrations (500)' });
      render(<ChannelsClientPage />);

      expect(
        screen.getByText('Failed to load integrations (500)')
      ).toBeInTheDocument();
    });

    it('renders a retry button that calls refetch', async () => {
      setupHook({ error: 'Something went wrong' });
      const user = userEvent.setup();
      render(<ChannelsClientPage />);

      await user.click(screen.getByRole('button', { name: /retry/i }));

      expect(mockRefetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('empty state (no integrations)', () => {
    it('renders page heading and Jumia card', () => {
      setupHook({});
      render(<ChannelsClientPage />);

      expect(screen.getByText('Marketplaces')).toBeInTheDocument();
      expect(screen.getByText('Jumia')).toBeInTheDocument();
      expect(
        screen.getByText("Africa's largest e-commerce platform")
      ).toBeInTheDocument();
    });

    it('renders Connect button when no integrations exist', () => {
      setupHook({});
      render(<ChannelsClientPage />);

      expect(
        screen.getByRole('button', { name: /connect/i })
      ).toBeInTheDocument();
    });

    it('renders Konga coming soon card', () => {
      setupHook({});
      render(<ChannelsClientPage />);

      expect(screen.getByText('Konga')).toBeInTheDocument();
      expect(screen.getByText('Coming Soon')).toBeInTheDocument();
    });

    it('opens connect dialog when Connect is clicked', async () => {
      setupHook({});
      const user = userEvent.setup();
      render(<ChannelsClientPage />);

      await user.click(screen.getByRole('button', { name: /connect/i }));

      expect(screen.getByTestId('connect-dialog')).toBeInTheDocument();
    });
  });

  describe('with integrations', () => {
    const mockIntegrations: JumiaIntegration[] = [
      {
        id: 'int-1',
        shop_id: 'shop-1',
        shop_name: 'Test Shop',
        country_code: 'NG',
        is_active: true,
        last_sync_at: '2026-01-15T10:30:00Z',
        sync_error: null,
      },
      {
        id: 'int-2',
        shop_id: 'shop-2',
        shop_name: 'Second Shop',
        country_code: 'KE',
        is_active: true,
        last_sync_at: null,
        sync_error: 'Token expired',
      },
    ];

    it('renders Connected badge instead of Connect button', () => {
      setupHook({ integrations: mockIntegrations });
      render(<ChannelsClientPage />);

      expect(screen.getByText('Connected')).toBeInTheDocument();
      expect(
        screen.queryByRole('button', { name: /^connect$/i })
      ).not.toBeInTheDocument();
    });

    it('renders shop names and country codes', () => {
      setupHook({ integrations: mockIntegrations });
      render(<ChannelsClientPage />);

      expect(screen.getByText('Test Shop')).toBeInTheDocument();
      expect(screen.getByText('Second Shop')).toBeInTheDocument();
    });

    it('renders Never for shops with no last_sync_at', () => {
      setupHook({ integrations: [mockIntegrations[1]] });
      render(<ChannelsClientPage />);

      expect(screen.getByText(/never/i)).toBeInTheDocument();
    });

    it('renders sync error when present on an integration', () => {
      setupHook({ integrations: [mockIntegrations[1]] });
      render(<ChannelsClientPage />);

      expect(screen.getByText('Token expired')).toBeInTheDocument();
    });

    it('renders Sync buttons for each integration', () => {
      setupHook({ integrations: mockIntegrations });
      render(<ChannelsClientPage />);

      const syncButtons = screen.getAllByRole('button', {
        name: /sync orders/i,
      });
      expect(syncButtons).toHaveLength(2);
    });

    it('renders visible disconnect buttons for each integration', () => {
      setupHook({ integrations: mockIntegrations });
      render(<ChannelsClientPage />);

      expect(
        screen.getByRole('button', { name: /disconnect jumia.*test shop/i })
      ).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: /disconnect jumia.*second shop/i })
      ).toBeInTheDocument();
      expect(screen.getAllByText('Disconnect Jumia')).toHaveLength(2);
    });

    it('renders quick action links', () => {
      setupHook({ integrations: mockIntegrations });
      render(<ChannelsClientPage />);

      expect(
        screen.getByRole('link', { name: /view jumia orders/i })
      ).toHaveAttribute('href', '/dashboard/orders?source=jumia');
      expect(
        screen.getByRole('link', { name: /vendor center/i })
      ).toHaveAttribute('href', 'https://vendorcenter.jumia.com');
    });
  });

  describe('disconnect flow', () => {
    const integration: JumiaIntegration = {
      id: 'int-1',
      shop_id: 'shop-1',
      shop_name: 'Test Shop',
      country_code: 'NG',
      is_active: true,
      last_sync_at: null,
      sync_error: null,
    };

    it('shows disconnect confirmation dialog when disconnect button is clicked', async () => {
      setupHook({ integrations: [integration] });
      const user = userEvent.setup();
      render(<ChannelsClientPage />);

      await user.click(
        screen.getByRole('button', { name: /disconnect jumia.*test shop/i })
      );

      expect(screen.getByText('Disconnect Jumia Account?')).toBeInTheDocument();
    });

    it('calls disconnectIntegration and shows success toast', async () => {
      mockDisconnectIntegration.mockResolvedValueOnce({ ok: true });
      setupHook({ integrations: [integration] });
      const user = userEvent.setup();
      render(<ChannelsClientPage />);

      await user.click(
        screen.getByRole('button', { name: /disconnect jumia.*test shop/i })
      );

      await user.click(screen.getByRole('button', { name: /^disconnect$/i }));

      await waitFor(() => {
        expect(mockDisconnectIntegration).toHaveBeenCalledWith('int-1');
      });

      expect(mockToast).toHaveBeenCalledWith({
        title: 'Jumia account disconnected',
      });
    });

    it('shows error toast when disconnect fails', async () => {
      mockDisconnectIntegration.mockResolvedValueOnce({
        ok: false,
        error: 'Failed to disconnect',
      });
      setupHook({ integrations: [integration] });
      const user = userEvent.setup();
      render(<ChannelsClientPage />);

      await user.click(
        screen.getByRole('button', { name: /disconnect jumia.*test shop/i })
      );
      await user.click(screen.getByRole('button', { name: /^disconnect$/i }));

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({
          title: 'Disconnect failed',
          description: 'Failed to disconnect',
          variant: 'destructive',
        });
      });
    });

    it('closes the confirmation dialog when Cancel is clicked', async () => {
      setupHook({ integrations: [integration] });
      const user = userEvent.setup();
      render(<ChannelsClientPage />);

      await user.click(
        screen.getByRole('button', { name: /disconnect jumia.*test shop/i })
      );

      expect(screen.getByText('Disconnect Jumia Account?')).toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: /cancel/i }));

      await waitFor(() => {
        expect(
          screen.queryByText('Disconnect Jumia Account?')
        ).not.toBeInTheDocument();
      });
    });
  });

  describe('sync flow', () => {
    const integration: JumiaIntegration = {
      id: 'int-1',
      shop_id: 'shop-1',
      shop_name: 'Test Shop',
      country_code: 'NG',
      is_active: true,
      last_sync_at: null,
      sync_error: null,
    };

    it('calls syncOrders and shows success toast', async () => {
      mockSyncOrders.mockResolvedValueOnce({
        ok: true,
        message: 'Synced 5 orders (2 new)',
      });
      setupHook({ integrations: [integration] });
      const user = userEvent.setup();
      render(<ChannelsClientPage />);

      await user.click(screen.getByRole('button', { name: /sync orders/i }));

      await waitFor(() => {
        expect(mockSyncOrders).toHaveBeenCalledWith('int-1');
      });

      expect(mockToast).toHaveBeenCalledWith({
        title: 'Synced 5 orders (2 new)',
      });
      expect(mockRefetch).toHaveBeenCalled();
    });

    it('shows error toast when sync fails', async () => {
      mockSyncOrders.mockResolvedValueOnce({
        ok: false,
        error: 'Token expired',
      });
      setupHook({ integrations: [integration] });
      const user = userEvent.setup();
      render(<ChannelsClientPage />);

      await user.click(screen.getByRole('button', { name: /sync orders/i }));

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({
          title: 'Sync failed',
          description: 'Token expired',
          variant: 'destructive',
        });
      });
    });
  });

  describe('OAuth callback params', () => {
    it('shows success toast and refetches on success=jumia_connected', async () => {
      mockSearchParams = new URLSearchParams('success=jumia_connected');
      setupHook({});
      render(<ChannelsClientPage />);

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({
          title: 'Jumia account connected successfully!',
        });
        expect(mockRefetch).toHaveBeenCalled();
        expect(mockReplace).toHaveBeenCalledWith('/dashboard/channels');
      });
    });

    it('auto-syncs only newly connected shops after connect', async () => {
      const existingShop: JumiaIntegration = {
        id: 'int-1',
        shop_id: 'shop-1',
        shop_name: 'Existing Shop',
        country_code: 'NG',
        is_active: true,
        last_sync_at: null,
        sync_error: null,
      };
      const newShop: JumiaIntegration = {
        id: 'int-new',
        shop_id: 'shop-new',
        shop_name: 'New Shop',
        country_code: 'NG',
        is_active: true,
        last_sync_at: null,
        sync_error: null,
      };
      mockRefetch.mockResolvedValueOnce([existingShop, newShop]);
      mockSyncOrders.mockResolvedValueOnce({
        ok: true,
        message: 'Synced 3 orders (3 new)',
      });

      mockSearchParams = new URLSearchParams(
        'success=jumia_connected&shops=shop-new'
      );
      setupHook({ integrations: [existingShop] });
      render(<ChannelsClientPage />);

      await waitFor(() => {
        expect(mockSyncOrders).toHaveBeenCalledWith('int-new');
      });
      expect(mockSyncOrders).toHaveBeenCalledTimes(1);
    });

    it('shows error toast for known error code', () => {
      mockSearchParams = new URLSearchParams('error=no_code');
      setupHook({});
      render(<ChannelsClientPage />);

      expect(mockToast).toHaveBeenCalledWith({
        title: 'Connection Error',
        description: 'Authorization failed — no code received',
        variant: 'destructive',
      });
      expect(mockReplace).toHaveBeenCalledWith('/dashboard/channels');
    });

    it('shows fallback error for unknown error code', () => {
      mockSearchParams = new URLSearchParams('error=unknown_code');
      setupHook({});
      render(<ChannelsClientPage />);

      expect(mockToast).toHaveBeenCalledWith({
        title: 'Connection Error',
        description: 'Error: unknown_code',
        variant: 'destructive',
      });
    });

    it('does nothing when no callback params are present', () => {
      mockSearchParams = new URLSearchParams();
      setupHook({});
      render(<ChannelsClientPage />);

      expect(mockToast).not.toHaveBeenCalled();
      expect(mockReplace).not.toHaveBeenCalled();
    });
  });
});
