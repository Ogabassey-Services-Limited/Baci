import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import type { ShippingRate } from './shipping-types';

const mockUpsertRate = vi.fn();
const mockToast = vi.fn();

vi.mock('./rate-actions', () => ({
  upsertRate: (...args: unknown[]) => mockUpsertRate(...args),
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

Object.defineProperty(HTMLElement.prototype, 'hasPointerCapture', {
  configurable: true,
  value: () => false,
});
Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
  configurable: true,
  value: () => undefined,
});

const { RateFormDialog } = await import('./rate-form-dialog');

const existingRate: ShippingRate = {
  id: 'r-1',
  zoneId: 'zone-1',
  name: 'Express',
  kind: 'ship',
  currency: 'NGN',
  baseAmount: 2000,
  conditionType: 'price_tier',
  minSubtotal: 100,
  maxSubtotal: 5000,
  freeOverAmount: 10_000,
  deliveryMinDays: 1,
  deliveryMaxDays: 2,
  pickupAddress: null,
  sortOrder: 3,
  active: false,
};

beforeAll(() => {
  // The "Type" Select measures its content via ResizeObserver, which jsdom
  // doesn't implement.
  vi.stubGlobal(
    'ResizeObserver',
    class ResizeObserver {
      observe() {
        return undefined;
      }
      unobserve() {
        return undefined;
      }
      disconnect() {
        return undefined;
      }
    }
  );
});

afterAll(() => {
  vi.unstubAllGlobals();
});

describe('RateFormDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not render dialog content when closed', () => {
    render(
      <RateFormDialog
        open={false}
        onOpenChange={vi.fn()}
        zoneId="zone-1"
        rate={null}
        currencySymbol="₦"
        onSaved={vi.fn()}
      />
    );

    expect(
      screen.queryByRole('heading', { name: /create rate/i })
    ).not.toBeInTheDocument();
  });

  it('creates a new rate with the expected defaults', async () => {
    mockUpsertRate.mockResolvedValue({ success: true, rateId: 'r-new' });
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    const onSaved = vi.fn();

    render(
      <RateFormDialog
        open={true}
        onOpenChange={onOpenChange}
        zoneId="zone-1"
        rate={null}
        currencySymbol="₦"
        onSaved={onSaved}
      />
    );

    expect(
      screen.getByRole('heading', { name: /create rate/i })
    ).toBeInTheDocument();

    await user.type(screen.getByLabelText(/^name$/i), 'Standard delivery');
    await user.type(screen.getByLabelText(/price/i), '1500');
    await user.click(screen.getByRole('button', { name: /create rate/i }));

    expect(mockUpsertRate).toHaveBeenCalledWith({
      id: undefined,
      zoneId: 'zone-1',
      name: 'Standard delivery',
      kind: 'ship',
      baseAmount: 1500,
      conditionType: 'always',
      minSubtotal: null,
      maxSubtotal: null,
      freeOverAmount: null,
      deliveryMinDays: null,
      deliveryMaxDays: null,
      pickupAddress: null,
      sortOrder: 0,
      active: true,
    });
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Created!' })
    );
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onSaved).toHaveBeenCalledOnce();
  });

  it('pre-fills fields for an existing rate and preserves its sort order on save', async () => {
    mockUpsertRate.mockResolvedValue({ success: true, rateId: 'r-1' });
    const user = userEvent.setup();

    render(
      <RateFormDialog
        open={true}
        onOpenChange={vi.fn()}
        zoneId="zone-1"
        rate={existingRate}
        currencySymbol="₦"
        onSaved={vi.fn()}
      />
    );

    expect(
      screen.getByRole('heading', { name: /edit rate/i })
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/^name$/i)).toHaveValue('Express');
    expect(screen.getByLabelText(/price/i)).toHaveValue(2000);
    expect(screen.getByLabelText(/min subtotal/i)).toHaveValue(100);
    expect(screen.getByLabelText(/max subtotal/i)).toHaveValue(5000);

    await user.click(screen.getByRole('button', { name: /save changes/i }));

    expect(mockUpsertRate).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'r-1',
        sortOrder: 3,
        active: false,
        minSubtotal: 100,
        maxSubtotal: 5000,
        freeOverAmount: 10_000,
        deliveryMinDays: 1,
        deliveryMaxDays: 2,
      })
    );
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Updated!' })
    );
  });

  it('includes the pickup address only when the rate kind is pickup', async () => {
    mockUpsertRate.mockResolvedValue({ success: true, rateId: 'r-new' });
    const user = userEvent.setup();

    render(
      <RateFormDialog
        open={true}
        onOpenChange={vi.fn()}
        zoneId="zone-1"
        rate={null}
        currencySymbol="₦"
        onSaved={vi.fn()}
      />
    );

    await user.click(screen.getByRole('combobox', { name: /type/i }));
    await user.click(
      await screen.findByRole('option', { name: /local pickup/i })
    );

    await user.type(screen.getByLabelText(/^name$/i), 'Pickup at store');
    await user.type(screen.getByLabelText(/price/i), '0');
    await user.type(screen.getByLabelText(/^address$/i), '12 Adeola Odeku');
    await user.click(screen.getByRole('button', { name: /create rate/i }));

    expect(mockUpsertRate).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'pickup',
        pickupAddress: { address: '12 Adeola Odeku' },
      })
    );
  });

  it('shows an error toast and keeps the dialog open when saving fails', async () => {
    mockUpsertRate.mockRejectedValue(new Error('Zone not found'));
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    const onSaved = vi.fn();

    render(
      <RateFormDialog
        open={true}
        onOpenChange={onOpenChange}
        zoneId="zone-1"
        rate={null}
        currencySymbol="₦"
        onSaved={onSaved}
      />
    );

    await user.type(screen.getByLabelText(/^name$/i), 'Standard delivery');
    await user.type(screen.getByLabelText(/price/i), '1500');
    await user.click(screen.getByRole('button', { name: /create rate/i }));

    expect(mockToast).toHaveBeenCalledWith({
      title: 'Error',
      description: 'Zone not found',
      variant: 'destructive',
    });
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
    expect(onSaved).not.toHaveBeenCalled();
  });

  it('resets the create form when the target zone changes', async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <RateFormDialog
        open={true}
        onOpenChange={vi.fn()}
        zoneId="zone-a"
        rate={null}
        currencySymbol="₦"
        onSaved={vi.fn()}
      />
    );

    await user.type(screen.getByLabelText(/^name$/i), 'Zone A only');
    await user.type(screen.getByLabelText(/price/i), '999');
    expect(screen.getByLabelText(/^name$/i)).toHaveValue('Zone A only');
    expect(screen.getByLabelText(/price/i)).toHaveValue(999);

    // Opening "Add Rate" for a different zone reuses the still-mounted dialog
    // with a new `zoneId`. The create form must remount fresh so zone A's data
    // can't leak into a rate saved against zone B.
    rerender(
      <RateFormDialog
        open={true}
        onOpenChange={vi.fn()}
        zoneId="zone-b"
        rate={null}
        currencySymbol="₦"
        onSaved={vi.fn()}
      />
    );

    expect(screen.getByLabelText(/^name$/i)).toHaveValue('');
    expect(screen.getByLabelText(/price/i)).toHaveValue(null);
  });

  it('cancels without saving', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();

    render(
      <RateFormDialog
        open={true}
        onOpenChange={onOpenChange}
        zoneId="zone-1"
        rate={null}
        currencySymbol="₦"
        onSaved={vi.fn()}
      />
    );

    await user.click(screen.getByRole('button', { name: /cancel/i }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(mockUpsertRate).not.toHaveBeenCalled();
  });
});
