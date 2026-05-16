import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NegotiationModal } from './NegotiationModal';

// ── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('@/env', () => ({
  getSupabaseUrl: () => 'https://test.supabase.co',
  getSupabaseAnonKey: () => 'test-anon-key',
  getSupabaseServiceRoleKey: () => 'test-service-role-key',
  getRootDomain: () => 'localhost',
}));

const mockInsert = vi.fn().mockResolvedValue({ error: null });
const mockGetUser = vi.fn();

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    from: () => ({ insert: mockInsert }),
    auth: { getUser: mockGetUser },
  }),
}));

// ── Helpers ──────────────────────────────────────────────────────────────────

const defaultProps = {
  isOpen: true,
  onClose: vi.fn(),
  productName: 'Test Product',
  currentPrice: 10000,
  onSuccess: vi.fn(),
  type: 'single' as const,
  itemId: 'item-123',
  merchantId: 'merchant-test-id',
};

/** Submit a low offer and advance fake timers past the 1500ms setTimeout */
function submitLowOffer(value: string) {
  const input = screen.getByPlaceholderText('Enter amount...');
  fireEvent.change(input, { target: { value } });
  fireEvent.click(screen.getByRole('button', { name: 'Submit Offer' }));
  // Advance past the 1500ms simulated AI delay
  act(() => {
    vi.advanceTimersByTime(1600);
  });
}

function reachUploadForm() {
  submitLowOffer('1000');
  fireEvent.click(screen.getByText('Negotiate Again'));
  submitLowOffer('1000');
  fireEvent.click(screen.getByText('Negotiate Again'));
  submitLowOffer('1000');
  fireEvent.click(screen.getByRole('button', { name: /i saw it cheaper/i }));
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('NegotiationModal', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'user-abc' } },
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns null when not open', () => {
    const { container } = render(
      <NegotiationModal {...defaultProps} isOpen={false} />
    );
    expect(container.innerHTML).toBe('');
  });

  it('renders product name and price', () => {
    render(<NegotiationModal {...defaultProps} />);
    expect(screen.getByText('Test Product')).toBeInTheDocument();
    expect(screen.getByText(/10,000/)).toBeInTheDocument();
  });

  it('shows the offer input form initially', () => {
    render(<NegotiationModal {...defaultProps} />);
    expect(
      screen.getByPlaceholderText('Enter amount...')
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Submit Offer' })
    ).toBeInTheDocument();
  });

  it('accepts an offer within the 3% threshold and marks it as AI-reviewed', () => {
    render(<NegotiationModal {...defaultProps} />);

    const input = screen.getByPlaceholderText('Enter amount...');
    fireEvent.change(input, { target: { value: '9700' } }); // 3% off
    fireEvent.click(screen.getByRole('button', { name: 'Submit Offer' }));

    act(() => {
      vi.advanceTimersByTime(1600);
    });

    expect(defaultProps.onSuccess).toHaveBeenCalledWith(9700);
    expect(
      screen.getByText(/accepted by our AI/i)
    ).toBeInTheDocument();
    expect(screen.getByText(/human review/i)).toBeInTheDocument();
  });

  it('counters a first offer beyond 3% at 1% off', () => {
    render(<NegotiationModal {...defaultProps} />);

    const input = screen.getByPlaceholderText('Enter amount...');
    fireEvent.change(input, { target: { value: '9600' } }); // 4% off
    fireEvent.click(screen.getByRole('button', { name: 'Submit Offer' }));

    act(() => {
      vi.advanceTimersByTime(1600);
    });

    expect(defaultProps.onSuccess).not.toHaveBeenCalled();
    expect(screen.getByText('Counter Offer')).toBeInTheDocument();
    expect(screen.getByText('₦9,900')).toBeInTheDocument();
  });

  it('cancels pending submit timers when unmounted', () => {
    const onSuccess = vi.fn();
    const { unmount } = render(
      <NegotiationModal {...defaultProps} onSuccess={onSuccess} />
    );

    const input = screen.getByPlaceholderText('Enter amount...');
    fireEvent.change(input, { target: { value: '9600' } });
    fireEvent.click(screen.getByRole('button', { name: 'Submit Offer' }));

    unmount();

    act(() => {
      vi.advanceTimersByTime(1600);
    });

    expect(onSuccess).not.toHaveBeenCalled();
  });

  it('shows counter offer for a low first attempt', () => {
    render(<NegotiationModal {...defaultProps} />);
    submitLowOffer('1000');

    expect(screen.getByText('Counter Offer')).toBeInTheDocument();
    expect(screen.getByText("That's a bit low. But I can do:")).toBeInTheDocument();
    expect(screen.getByText('₦9,900')).toBeInTheDocument();
  });

  it('steps counter offers through 1%, 2%, and 3%', () => {
    render(<NegotiationModal {...defaultProps} />);

    submitLowOffer('1000');
    expect(screen.getByText('₦9,900')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Negotiate Again'));
    submitLowOffer('1000');
    expect(screen.getByText('₦9,800')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Negotiate Again'));
    submitLowOffer('1000');
    expect(screen.getByText('₦9,700')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /i saw it cheaper/i })
    ).toBeInTheDocument();
  });

  it('includes customer_id and unique session_id in the insert payload', async () => {
    render(<NegotiationModal {...defaultProps} />);

    reachUploadForm();

    // Now in upload state — provide file and submit form directly
    const fileInput = screen.getByLabelText('Upload proof') as HTMLInputElement;
    const file = new File(['proof'], 'screenshot.png', { type: 'image/png' });
    fireEvent.change(fileInput, { target: { files: [file] } });

    // Switch to real timers — the async submitMerchantRequest flow
    // (getUser + insert) needs real microtask scheduling, not fake timers
    vi.useRealTimers();

    const form = fileInput.closest('form') as HTMLFormElement;
    await act(async () => {
      fireEvent.submit(form);
    });

    expect(mockInsert).toHaveBeenCalledTimes(1);

    const insertPayload = mockInsert.mock.calls[0][0];
    expect(insertPayload).toMatchObject({
      customer_id: 'user-abc',
      type: 'single',
      offered_price: 1000,
      status: 'pending',
    });
    // session_id should be a unique web-prefixed string, not the old hardcoded 'web-session'
    expect(insertPayload.session_id).toMatch(/^web-/);
    expect(insertPayload.session_id).not.toBe('web-session');
  });

  it('sets customer_id to null for unauthenticated users', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });

    render(<NegotiationModal {...defaultProps} />);

    reachUploadForm();

    // Switch to real timers before async form submission
    vi.useRealTimers();

    const fileInput = screen.getByLabelText('Upload proof') as HTMLInputElement;
    const file = new File(['proof'], 'screenshot.png', { type: 'image/png' });
    fireEvent.change(fileInput, { target: { files: [file] } });

    const form = fileInput.closest('form') as HTMLFormElement;
    await act(async () => {
      fireEvent.submit(form);
    });

    expect(mockInsert).toHaveBeenCalledTimes(1);
    expect(mockInsert.mock.calls[0][0].customer_id).toBeNull();
  });

  it('shows alert when insert fails', async () => {
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
    mockInsert.mockResolvedValue({
      error: { message: 'DB insert failed' },
    });

    render(<NegotiationModal {...defaultProps} />);

    reachUploadForm();

    vi.useRealTimers();

    const fileInput = screen.getByLabelText('Upload proof') as HTMLInputElement;
    const file = new File(['proof'], 'screenshot.png', { type: 'image/png' });
    fireEvent.change(fileInput, { target: { files: [file] } });

    const form = fileInput.closest('form') as HTMLFormElement;
    await act(async () => {
      fireEvent.submit(form);
    });

    expect(alertSpy).toHaveBeenCalledWith(
      expect.stringContaining('Failed to submit')
    );
    alertSpy.mockRestore();
  });

  it('skips async submit state updates after unmount', async () => {
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
    let resolveInsert:
      | ((value: { error: { message: string } | null }) => void)
      | undefined;
    const insertPromise = new Promise<{ error: { message: string } | null }>(
      (resolve) => {
        resolveInsert = resolve;
      }
    );

    mockInsert.mockReturnValueOnce(insertPromise);

    const { unmount } = render(<NegotiationModal {...defaultProps} />);

    reachUploadForm();

    vi.useRealTimers();

    const fileInput = screen.getByLabelText('Upload proof') as HTMLInputElement;
    const file = new File(['proof'], 'screenshot.png', { type: 'image/png' });
    fireEvent.change(fileInput, { target: { files: [file] } });

    const form = fileInput.closest('form') as HTMLFormElement;
    await act(async () => {
      fireEvent.submit(form);
    });

    unmount();

    await act(async () => {
      resolveInsert?.({ error: { message: 'DB insert failed' } });
      await Promise.resolve();
    });

    expect(alertSpy).not.toHaveBeenCalled();
    alertSpy.mockRestore();
  });

  it('calls onClose when backdrop is clicked', () => {
    render(<NegotiationModal {...defaultProps} />);
    const backdrop = screen.getByTestId('modal-backdrop');
    fireEvent.click(backdrop);
    expect(defaultProps.onClose).toHaveBeenCalled();
  });
});
