import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CancelOrderDialog } from '@/app/(storefront)/[slug]/(customer)/account/orders/[orderId]/cancel-order-dialog';

const mockFetchWithCsrf = vi.fn();
const dialogState = vi.hoisted(() => ({
  open: false,
  onOpenChange: undefined as ((open: boolean) => void) | undefined,
}));

vi.mock('@/lib/api-client', () => ({
  fetchWithCsrf: (...args: unknown[]) => mockFetchWithCsrf(...args),
}));

// The Radix dialog brings react-remove-scroll into this test's graph. Under
// the monorepo Vitest resolver that can load a second React instance and fail
// before the cancellation behavior is exercised, so keep the test at the
// component contract boundary.
vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({
    children,
    open,
    onOpenChange,
  }: {
    children: React.ReactNode;
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
  }) => {
    dialogState.open = open ?? false;
    dialogState.onOpenChange = onOpenChange;
    return <div>{children}</div>;
  },
  DialogContent: ({ children }: { children: React.ReactNode }) =>
    dialogState.open ? <div role="dialog">{children}</div> : null,
  DialogDescription: ({ children }: { children: React.ReactNode }) => (
    <p>{children}</p>
  ),
  DialogFooter: ({ children }: { children: React.ReactNode }) => (
    <footer>{children}</footer>
  ),
  DialogHeader: ({ children }: { children: React.ReactNode }) => (
    <header>{children}</header>
  ),
  DialogTitle: ({ children }: { children: React.ReactNode }) => (
    <h2>{children}</h2>
  ),
  DialogTrigger: ({ children }: { children: React.ReactNode }) => {
    if (!children || typeof children !== 'object' || !('props' in children))
      return <>{children}</>;
    const trigger = children as {
      props?: { children?: React.ReactNode };
    };
    return (
      <button type="button" onClick={() => dialogState.onOpenChange?.(true)}>
        {trigger.props?.children}
      </button>
    );
  },
}));

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

function openDialog() {
  fireEvent.click(screen.getByRole('button', { name: /cancel order/i }));
}

describe('CancelOrderDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dialogState.open = false;
    dialogState.onOpenChange = undefined;
  });

  it('renders the trigger button', () => {
    render(<CancelOrderDialog orderId="order-1" />);

    expect(
      screen.getByRole('button', { name: /cancel order/i })
    ).toBeInTheDocument();
  });

  it('keeps dialog content closed until the trigger is activated', () => {
    render(<CancelOrderDialog orderId="order-1" />);

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    openDialog();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('posts to the cancel endpoint with a CSRF-protected request on confirm', async () => {
    mockFetchWithCsrf.mockResolvedValue(
      jsonResponse(200, { success: true, cancelled: true })
    );
    const onCancelled = vi.fn();

    render(<CancelOrderDialog orderId="order-1" onCancelled={onCancelled} />);
    openDialog();

    fireEvent.click(
      screen.getByRole('button', { name: /^confirm cancellation$/i })
    );

    await waitFor(() => {
      expect(mockFetchWithCsrf).toHaveBeenCalledWith(
        '/api/storefront/account/orders/order-1/cancel',
        expect.objectContaining({ method: 'POST' })
      );
    });
    await waitFor(() => {
      expect(onCancelled).toHaveBeenCalledTimes(1);
    });
  });

  it('sends the selected reason in the request body', async () => {
    mockFetchWithCsrf.mockResolvedValue(
      jsonResponse(200, { success: true, cancelled: true })
    );

    render(<CancelOrderDialog orderId="order-1" />);
    openDialog();

    fireEvent.click(screen.getByRole('radio', { name: /changed my mind/i }));
    fireEvent.click(
      screen.getByRole('button', { name: /^confirm cancellation$/i })
    );

    await waitFor(() => {
      expect(mockFetchWithCsrf).toHaveBeenCalledWith(
        '/api/storefront/account/orders/order-1/cancel',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ reason: 'Changed my mind' }),
        })
      );
    });
  });

  it('uses the free-text value when the reason is "Other"', async () => {
    mockFetchWithCsrf.mockResolvedValue(
      jsonResponse(200, { success: true, cancelled: true })
    );

    render(<CancelOrderDialog orderId="order-1" />);
    openDialog();

    fireEvent.click(screen.getByRole('radio', { name: /^other$/i }));
    fireEvent.change(screen.getByRole('textbox', { name: /tell us more/i }), {
      target: { value: 'Found it cheaper elsewhere' },
    });
    fireEvent.click(
      screen.getByRole('button', { name: /^confirm cancellation$/i })
    );

    await waitFor(() => {
      expect(mockFetchWithCsrf).toHaveBeenCalledWith(
        '/api/storefront/account/orders/order-1/cancel',
        expect.objectContaining({
          body: JSON.stringify({ reason: 'Found it cheaper elsewhere' }),
        })
      );
    });
  });

  it('uses whitespace-free unique ids for cancellation reason radio items', () => {
    render(<CancelOrderDialog orderId="order-1" />);
    openDialog();

    const ids = screen.getAllByRole('radio').map((radio) => radio.id);

    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) {
      expect(id).not.toMatch(/\s/);
    }
  });

  it('cancels without a reason when none is selected (skippable)', async () => {
    mockFetchWithCsrf.mockResolvedValue(
      jsonResponse(200, { success: true, cancelled: true })
    );

    render(<CancelOrderDialog orderId="order-1" />);
    openDialog();

    fireEvent.click(
      screen.getByRole('button', { name: /^confirm cancellation$/i })
    );

    await waitFor(() => {
      expect(mockFetchWithCsrf).toHaveBeenCalledWith(
        '/api/storefront/account/orders/order-1/cancel',
        expect.objectContaining({ body: JSON.stringify({}) })
      );
    });
  });

  it('shows a not-cancellable message and still refreshes on a 409', async () => {
    mockFetchWithCsrf.mockResolvedValue(
      jsonResponse(409, {
        error: 'This order can no longer be cancelled',
        code: 'order_not_cancellable',
      })
    );
    const onCancelled = vi.fn();

    render(<CancelOrderDialog orderId="order-1" onCancelled={onCancelled} />);
    openDialog();

    fireEvent.click(
      screen.getByRole('button', { name: /^confirm cancellation$/i })
    );

    expect(
      await screen.findByText(/this order can no longer be cancelled/i)
    ).toBeInTheDocument();
    await waitFor(() => {
      expect(onCancelled).toHaveBeenCalledTimes(1);
    });
  });

  it('shows an error message when the request fails', async () => {
    mockFetchWithCsrf.mockResolvedValue(
      jsonResponse(500, { error: 'Failed to cancel order' })
    );
    const onCancelled = vi.fn();

    render(<CancelOrderDialog orderId="order-1" onCancelled={onCancelled} />);
    openDialog();

    fireEvent.click(
      screen.getByRole('button', { name: /^confirm cancellation$/i })
    );

    expect(
      await screen.findByText(/we couldn't cancel this order/i)
    ).toBeInTheDocument();
    expect(onCancelled).not.toHaveBeenCalled();
  });

  it('shows an error message when the network request throws', async () => {
    mockFetchWithCsrf.mockRejectedValue(new Error('network down'));

    render(<CancelOrderDialog orderId="order-1" />);
    openDialog();

    fireEvent.click(
      screen.getByRole('button', { name: /^confirm cancellation$/i })
    );

    expect(
      await screen.findByText(/we couldn't cancel this order/i)
    ).toBeInTheDocument();
  });

  it('disables the confirm button while the request is in flight', async () => {
    let resolveRequest: ((value: Response) => void) | undefined;
    mockFetchWithCsrf.mockImplementation(
      () =>
        new Promise<Response>((resolve) => {
          resolveRequest = resolve;
        })
    );

    render(<CancelOrderDialog orderId="order-1" />);
    openDialog();

    const confirmButton = screen.getByRole('button', {
      name: /^confirm cancellation$/i,
    });
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /cancelling/i })
      ).toBeDisabled();
    });

    resolveRequest?.(jsonResponse(200, { success: true, cancelled: true }));
  });
});
