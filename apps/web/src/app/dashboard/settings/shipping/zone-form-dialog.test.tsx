import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ShippingZoneLocationOverlapError } from './shipping-errors';
import type { ShippingZone } from './shipping-types';

const mockUpsertZone = vi.fn();
const mockToast = vi.fn();

vi.mock('./actions', () => ({
  upsertZone: (...args: unknown[]) => mockUpsertZone(...args),
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

const { ZoneFormDialog } = await import('./zone-form-dialog');

const lagosZone: ShippingZone = {
  id: 'z-lagos',
  name: 'Lagos',
  isRestOfWorld: false,
  active: true,
  locations: [{ countryCode: 'NG', subdivisionCode: 'NG-LA' }],
};

const restOfWorldZone: ShippingZone = {
  id: 'z-row',
  name: 'Everywhere else',
  isRestOfWorld: true,
  active: true,
  locations: [],
};

describe('ZoneFormDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates a new zone with the entered name and no locations by default', async () => {
    mockUpsertZone.mockResolvedValue({ success: true, zoneId: 'z-new' });
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    const onSaved = vi.fn();

    render(
      <ZoneFormDialog
        open={true}
        onOpenChange={onOpenChange}
        zone={null}
        onSaved={onSaved}
      />
    );

    expect(
      screen.getByRole('heading', { name: /create zone/i })
    ).toBeInTheDocument();

    await user.type(screen.getByLabelText(/zone name/i), 'Abuja');
    await user.click(screen.getByRole('button', { name: /create zone/i }));

    expect(mockUpsertZone).toHaveBeenCalledWith({
      id: undefined,
      name: 'Abuja',
      locations: [],
    });
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Created!' })
    );
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onSaved).toHaveBeenCalledOnce();
  });

  it('shows a validation error and does not save when the name is whitespace-only', async () => {
    const user = userEvent.setup();

    render(
      <ZoneFormDialog
        open={true}
        onOpenChange={vi.fn()}
        zone={null}
        onSaved={vi.fn()}
      />
    );

    // The name input has an HTML `required` attribute, which blocks
    // submission of a genuinely empty field before React ever sees the
    // submit event — a whitespace-only value satisfies `required` but still
    // fails the component's own `.trim()` check.
    await user.type(screen.getByLabelText(/zone name/i), '   ');
    await user.click(screen.getByRole('button', { name: /create zone/i }));

    expect(mockToast).toHaveBeenCalledWith({
      title: 'Validation Error',
      description: 'Zone name is required',
      variant: 'destructive',
    });
    expect(mockUpsertZone).not.toHaveBeenCalled();
  });

  it('pre-fills the name and locations for an existing zone and saves the edit', async () => {
    mockUpsertZone.mockResolvedValue({ success: true, zoneId: 'z-lagos' });
    const user = userEvent.setup();

    render(
      <ZoneFormDialog
        open={true}
        onOpenChange={vi.fn()}
        zone={lagosZone}
        onSaved={vi.fn()}
      />
    );

    expect(
      screen.getByRole('heading', { name: /edit zone/i })
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/zone name/i)).toHaveValue('Lagos');
    expect(screen.getByText('Nigeria')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /save changes/i }));

    expect(mockUpsertZone).toHaveBeenCalledWith({
      id: 'z-lagos',
      name: 'Lagos',
      locations: [{ countryCode: 'NG', subdivisionCode: 'NG-LA' }],
    });
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Updated!' })
    );
  });

  it('hides the location picker and always sends empty locations for the rest-of-world zone', async () => {
    mockUpsertZone.mockResolvedValue({ success: true, zoneId: 'z-row' });
    const user = userEvent.setup();

    render(
      <ZoneFormDialog
        open={true}
        onOpenChange={vi.fn()}
        zone={restOfWorldZone}
        onSaved={vi.fn()}
      />
    );

    expect(
      screen.queryByText(/leave a country's states/i)
    ).not.toBeInTheDocument();
    expect(
      screen.getByText(/always matches any destination/i)
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /save changes/i }));

    expect(mockUpsertZone).toHaveBeenCalledWith({
      id: 'z-row',
      name: 'Everywhere else',
      locations: [],
    });
  });

  it('shows an error toast and keeps the dialog open when saving fails', async () => {
    mockUpsertZone.mockRejectedValue(new Error('Zone not found'));
    const user = userEvent.setup();
    const onOpenChange = vi.fn();

    render(
      <ZoneFormDialog
        open={true}
        onOpenChange={onOpenChange}
        zone={null}
        onSaved={vi.fn()}
      />
    );

    await user.type(screen.getByLabelText(/zone name/i), 'Abuja');
    await user.click(screen.getByRole('button', { name: /create zone/i }));

    expect(mockToast).toHaveBeenCalledWith({
      title: 'Error',
      description: 'Zone not found',
      variant: 'destructive',
    });
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });

  it('surfaces a cross-zone overlap error, naming the conflicting zone, in the toast', async () => {
    mockUpsertZone.mockRejectedValue(
      new ShippingZoneLocationOverlapError('Lagos')
    );
    const user = userEvent.setup();
    const onOpenChange = vi.fn();

    render(
      <ZoneFormDialog
        open={true}
        onOpenChange={onOpenChange}
        zone={null}
        onSaved={vi.fn()}
      />
    );

    await user.type(screen.getByLabelText(/zone name/i), 'Lagos copy');
    await user.click(screen.getByRole('button', { name: /create zone/i }));

    expect(mockToast).toHaveBeenCalledWith({
      title: 'Error',
      description: expect.stringContaining('Lagos'),
      variant: 'destructive',
    });
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });

  it('cancels without saving', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();

    render(
      <ZoneFormDialog
        open={true}
        onOpenChange={onOpenChange}
        zone={null}
        onSaved={vi.fn()}
      />
    );

    await user.click(screen.getByRole('button', { name: /cancel/i }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(mockUpsertZone).not.toHaveBeenCalled();
  });
});
