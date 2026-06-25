import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CartItem } from '@/hooks/cart';
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
      screen.getByRole('spinbutton', { name: /your offer/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Submit Offer' })
    ).toBeInTheDocument();
  });

  it('moves initial dialog focus to the offer amount input', () => {
    render(<NegotiationModal {...defaultProps} />);

    act(() => {
      vi.advanceTimersByTime(16);
    });

    expect(screen.getByPlaceholderText('Enter amount...')).toHaveFocus();
  });

  it('accepts an offer within the 2% threshold and marks it as AI-reviewed', () => {
    render(<NegotiationModal {...defaultProps} />);

    const input = screen.getByPlaceholderText('Enter amount...');
    fireEvent.change(input, { target: { value: '9800' } }); // 2% off
    fireEvent.click(screen.getByRole('button', { name: 'Submit Offer' }));

    act(() => {
      vi.advanceTimersByTime(1600);
    });

    expect(defaultProps.onSuccess).toHaveBeenCalledWith(9800);
    expect(
      screen.getByText(/accepted by our AI/i)
    ).toBeInTheDocument();
    expect(screen.getByText(/human review/i)).toBeInTheDocument();
  });

  it('rejects offers above the current price before entering processing', () => {
    render(<NegotiationModal {...defaultProps} />);

    const input = screen.getByPlaceholderText('Enter amount...');
    fireEvent.change(input, { target: { value: '12000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Submit Offer' }));

    expect(screen.getByRole('alert')).toHaveTextContent(
      /between ₦1 and ₦10,000/i
    );
    expect(
      screen.queryByText(/reviewing your offer/i)
    ).not.toBeInTheDocument();
    expect(defaultProps.onSuccess).not.toHaveBeenCalled();
  });

  it('counters a first offer beyond 2% at 1% off', () => {
    render(<NegotiationModal {...defaultProps} />);

    const input = screen.getByPlaceholderText('Enter amount...');
    fireEvent.change(input, { target: { value: '9700' } }); // 3% off
    fireEvent.click(screen.getByRole('button', { name: 'Submit Offer' }));

    act(() => {
      vi.advanceTimersByTime(1600);
    });

    expect(defaultProps.onSuccess).not.toHaveBeenCalled();
    expect(screen.getByText('Counter Offer')).toBeInTheDocument();
    expect(screen.getByText('₦9,900')).toBeInTheDocument();
  });

  it.each([
    ['Infinix products', 'Infinix Hot 50'],
    ['Tecno products', 'Tecno Spark 50'],
    ['Vivo products', 'Vivo Y28'],
    ['Redmi products', 'Redmi Note 13'],
    ['Xiaomi products', 'Xiaomi 14T'],
    ['Oppo products', 'Oppo A58'],
    ['Itel products', 'Itel S24'],
    ['Honor products', 'Honor X8b'],
    ['Samsung A-series products', 'Samsung Galaxy A16 5G'],
  ])('returns a final-price response for %s', (_label, productName) => {
    const onSuccess = vi.fn();
    render(
      <NegotiationModal
        {...defaultProps}
        productName={productName}
        onSuccess={onSuccess}
      />
    );

    submitLowOffer('9000');

    expect(onSuccess).not.toHaveBeenCalled();
    expect(screen.getByText('Final Price')).toBeInTheDocument();
    expect(
      screen.getByText(/already the best price|can't discount it further/i)
    ).toBeInTheDocument();
    expect(screen.queryByText('Counter Offer')).not.toBeInTheDocument();
  });

  it('treats a non-negotiable brand from the productBrand prop as final price', () => {
    const onSuccess = vi.fn();
    render(
      <NegotiationModal
        {...defaultProps}
        productName="Hot 50"
        productBrand="Infinix"
        onSuccess={onSuccess}
      />
    );

    submitLowOffer('9000');

    expect(onSuccess).not.toHaveBeenCalled();
    expect(screen.getByText('Final Price')).toBeInTheDocument();
    expect(screen.queryByText('Counter Offer')).not.toBeInTheDocument();
  });

  it('keeps Samsung non-A-series products negotiable', () => {
    render(
      <NegotiationModal
        {...defaultProps}
        productName="Samsung Galaxy S25 Ultra"
      />
    );

    submitLowOffer('9000');

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

  it('cancels pending submit timers when the modal closes before completion', () => {
    const onSuccess = vi.fn();
    const { rerender } = render(
      <NegotiationModal {...defaultProps} onSuccess={onSuccess} isOpen />
    );

    const input = screen.getByPlaceholderText('Enter amount...');
    fireEvent.change(input, { target: { value: '9600' } });
    fireEvent.click(screen.getByRole('button', { name: 'Submit Offer' }));

    rerender(<NegotiationModal {...defaultProps} onSuccess={onSuccess} isOpen={false} />);

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

  it('steps counter offers through 1%, 1.5%, and 2%', () => {
    render(<NegotiationModal {...defaultProps} />);

    submitLowOffer('1000');
    expect(screen.getByText('₦9,900')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Negotiate Again'));
    submitLowOffer('1000');
    expect(screen.getByText('₦9,850')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Negotiate Again'));
    submitLowOffer('1000');
    expect(screen.getByText('₦9,800')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /i saw it cheaper/i })
    ).toBeInTheDocument();
  });

  it('keeps final 2% counter-offer within server-acceptable bounds for low subtotals', () => {
    render(<NegotiationModal {...defaultProps} currentPrice={999} />);

    submitLowOffer('500');
    fireEvent.click(screen.getByText('Negotiate Again'));
    submitLowOffer('500');
    fireEvent.click(screen.getByText('Negotiate Again'));
    submitLowOffer('500');

    expect(screen.getByText('₦980')).toBeInTheDocument();
    expect(screen.queryByText('₦979')).not.toBeInTheDocument();
  });

  it('clamps final 2% counter-offers for fractional non-VAT totals', () => {
    render(<NegotiationModal {...defaultProps} currentPrice={1048.95} />);

    submitLowOffer('500');
    fireEvent.click(screen.getByText('Negotiate Again'));
    submitLowOffer('500');
    fireEvent.click(screen.getByText('Negotiate Again'));
    submitLowOffer('500');

    expect(screen.getByText('₦1,028.95')).toBeInTheDocument();
    expect(screen.queryByText('₦1,027')).not.toBeInTheDocument();
  });

  it('keeps final 2% counter-offers within VAT-aware backend bounds', () => {
    render(
      <NegotiationModal
        {...defaultProps}
        currentPrice={1001}
        vatRate={0.075}
      />
    );

    submitLowOffer('500');
    fireEvent.click(screen.getByText('Negotiate Again'));
    submitLowOffer('500');
    fireEvent.click(screen.getByText('Negotiate Again'));
    submitLowOffer('500');

    expect(screen.getByText('₦981')).toBeInTheDocument();
    expect(screen.queryByText('₦980')).not.toBeInTheDocument();
  });

  it('clears counter-offer message when returning to input state', () => {
    render(<NegotiationModal {...defaultProps} />);

    submitLowOffer('1000');
    fireEvent.click(screen.getByText('Negotiate Again'));

    expect(
      screen.getByPlaceholderText('Enter amount...')
    ).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('returns focus to the offer input when negotiating again', () => {
    render(<NegotiationModal {...defaultProps} />);

    submitLowOffer('1000');
    fireEvent.click(screen.getByText('Negotiate Again'));

    act(() => {
      vi.advanceTimersByTime(16);
    });

    expect(
      screen.getByRole('spinbutton', { name: /your offer/i })
    ).toHaveFocus();
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

  it('persists a normalized customer_phone when one is entered', async () => {
    render(<NegotiationModal {...defaultProps} />);

    reachUploadForm();

    const fileInput = screen.getByLabelText('Upload proof') as HTMLInputElement;
    const file = new File(['proof'], 'screenshot.png', { type: 'image/png' });
    fireEvent.change(fileInput, { target: { files: [file] } });

    const phoneInput = screen.getByLabelText(
      'Phone / WhatsApp (Optional)'
    ) as HTMLInputElement;
    fireEvent.change(phoneInput, { target: { value: '0803 123 4567' } });

    vi.useRealTimers();

    const form = fileInput.closest('form') as HTMLFormElement;
    await act(async () => {
      fireEvent.submit(form);
    });

    expect(mockInsert).toHaveBeenCalledTimes(1);
    expect(mockInsert.mock.calls[0][0].customer_phone).toBe('2348031234567');
  });

  it('rejects an invalid customer_phone instead of silently storing null', async () => {
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
    render(<NegotiationModal {...defaultProps} />);

    reachUploadForm();

    const fileInput = screen.getByLabelText('Upload proof') as HTMLInputElement;
    const file = new File(['proof'], 'screenshot.png', { type: 'image/png' });
    fireEvent.change(fileInput, { target: { files: [file] } });

    const phoneInput = screen.getByLabelText(
      'Phone / WhatsApp (Optional)'
    ) as HTMLInputElement;
    fireEvent.change(phoneInput, { target: { value: 'not a phone' } });

    vi.useRealTimers();

    const form = fileInput.closest('form') as HTMLFormElement;
    await act(async () => {
      fireEvent.submit(form);
    });

    expect(mockInsert).not.toHaveBeenCalled();
    expect(alertSpy).toHaveBeenCalledWith(
      'Enter a valid Phone / WhatsApp number.'
    );
    alertSpy.mockRestore();
  });

  it('sends a null customer_phone when the field is left blank', async () => {
    render(<NegotiationModal {...defaultProps} />);

    reachUploadForm();

    const fileInput = screen.getByLabelText('Upload proof') as HTMLInputElement;
    const file = new File(['proof'], 'screenshot.png', { type: 'image/png' });
    fireEvent.change(fileInput, { target: { files: [file] } });

    vi.useRealTimers();

    const form = fileInput.closest('form') as HTMLFormElement;
    await act(async () => {
      fireEvent.submit(form);
    });

    expect(mockInsert).toHaveBeenCalledTimes(1);
    expect(mockInsert.mock.calls[0][0].customer_phone).toBeNull();
  });

  it('snapshots total-cart offers with variant labels and zero-priced quiz gifts', async () => {
    const cart = [
      {
        id: 'p1',
        cartItemId: 'ci-1',
        name: 'Galaxy S24',
        description: 'Phone',
        status: 'active',
        price: 900_000,
        negotiatedPrice: 850_000,
        manage_stock: true,
        stock: 4,
        quantity: 1,
        image: '/s24.jpg',
        imageLarge: '/s24.jpg',
        imageHint: 'phone',
        brand: 'Samsung',
        gtin: '',
        mpn: '',
        variantId: 'variant-blue-256',
        variantAttributes: { color: 'Blue', storage: '256GB' },
        selectedColor: 'Blue',
        selectedStorage: '256GB',
        condition: 'new',
      },
      {
        id: 'gift-1',
        cartItemId: 'gift-1::quiz',
        name: 'Quiz Gift',
        description: 'Prize',
        status: 'active',
        price: 205_000,
        manage_stock: true,
        stock: 1,
        quantity: 1,
        image: '/gift.jpg',
        imageLarge: '/gift.jpg',
        imageHint: 'gift',
        brand: 'Tecno',
        gtin: '',
        mpn: '',
        quizAwardId: 'award-1',
        quizVoucherToken: 'signed-token',
      },
    ] satisfies CartItem[];

    render(
      <NegotiationModal
        {...defaultProps}
        productName="Entire Cart"
        currentPrice={850_000}
        type="total"
        cart={cart}
      />
    );

    reachUploadForm();

    const fileInput = screen.getByLabelText('Upload proof') as HTMLInputElement;
    const file = new File(['proof'], 'screenshot.png', { type: 'image/png' });
    fireEvent.change(fileInput, { target: { files: [file] } });

    vi.useRealTimers();

    const form = fileInput.closest('form') as HTMLFormElement;
    await act(async () => {
      fireEvent.submit(form);
    });

    expect(mockInsert).toHaveBeenCalledTimes(1);
    expect(mockInsert.mock.calls[0][0]).toMatchObject({
      type: 'total',
      cart_snapshot: [
        {
          product_id: 'p1',
          name: 'Galaxy S24',
          price: 850_000,
          quantity: 1,
          image: '/s24.jpg',
          variant_id: 'variant-blue-256',
          variant_name: 'color: Blue · storage: 256GB',
          brand: 'Samsung',
          condition: 'new',
        },
        {
          product_id: 'gift-1',
          name: 'Quiz Gift',
          price: 0,
          quantity: 1,
        },
      ],
      item_info: {
        current_price: 850_000,
        image: '/s24.jpg',
        name: '2 items: Galaxy S24, Quiz Gift',
      },
    });
  });

  it('fails closed when a total-cart offer has no cart snapshot', async () => {
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
    render(
      <NegotiationModal
        {...defaultProps}
        productName="Entire Cart"
        type="total"
      />
    );

    reachUploadForm();

    const fileInput = screen.getByLabelText('Upload proof') as HTMLInputElement;
    const file = new File(['proof'], 'screenshot.png', { type: 'image/png' });
    fireEvent.change(fileInput, { target: { files: [file] } });

    vi.useRealTimers();

    const form = fileInput.closest('form') as HTMLFormElement;
    await act(async () => {
      fireEvent.submit(form);
    });

    expect(mockInsert).not.toHaveBeenCalled();
    expect(alertSpy).toHaveBeenCalledWith(
      'Whole-cart negotiations require at least one cart item.'
    );
    alertSpy.mockRestore();
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

  it('calls onClose when Escape is pressed', () => {
    render(<NegotiationModal {...defaultProps} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(defaultProps.onClose).toHaveBeenCalled();
  });
});
