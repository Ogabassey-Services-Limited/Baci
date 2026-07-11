import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import type {
  RepairQuoteAdmin,
  RepairServiceTypeAdmin,
} from '@/lib/repairs/catalog-admin-mappers';

// QuoteFormDialog renders a Switch, which uses Radix's useSize internally —
// this needs ResizeObserver, which isn't implemented in jsdom.
const OriginalResizeObserver = globalThis.ResizeObserver;

beforeAll(() => {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {
      // intentional noop
    }
    unobserve() {
      // intentional noop
    }
    disconnect() {
      // intentional noop
    }
  };
});

afterAll(() => {
  globalThis.ResizeObserver = OriginalResizeObserver;
});

vi.mock('./catalog-api', () => ({
  listQuotes: vi.fn(),
  deleteQuote: vi.fn(),
  createQuote: vi.fn(),
  updateQuote: vi.fn(),
}));

const mockToast = vi.fn();
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

vi.mock('@/components/ui/select', () => ({
  Select: ({
    children,
    onValueChange,
    value,
  }: {
    children: ReactNode;
    onValueChange: (val: string) => void;
    value: string;
  }) => (
    <select
      value={value}
      onChange={(event) => onValueChange(event.target.value)}
      aria-label="Service type"
    >
      {children}
    </select>
  ),
  SelectContent: ({ children }: { children: ReactNode }) => <>{children}</>,
  SelectItem: ({ children, value }: { children: ReactNode; value: string }) => (
    <option value={value}>{children}</option>
  ),
  SelectTrigger: () => null,
  SelectValue: () => null,
}));

import { deleteQuote, listQuotes } from './catalog-api';
import DeviceQuotesPanel from './device-quotes-panel';

const mockListQuotes = vi.mocked(listQuotes);
const mockDeleteQuote = vi.mocked(deleteQuote);

const SERVICE_TYPES: RepairServiceTypeAdmin[] = [
  {
    id: 'st-1',
    name: 'Screen replacement',
    slug: 'screen-replacement',
    description: null,
    sortOrder: 0,
    isActive: true,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  },
];

const QUOTE: RepairQuoteAdmin = {
  id: 'quote-1',
  deviceId: 'device-1',
  serviceTypeId: 'st-1',
  price: 15000,
  isFromPrice: true,
  partQuality: 'OEM',
  turnaround: '2 hours',
  warrantyDays: 30,
  description: 'Original screen',
  internalNotes: 'Keep stock low',
  isActive: true,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

describe('DeviceQuotesPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('lists quotes with the resolved service-type name and price', async () => {
    mockListQuotes.mockResolvedValue([QUOTE]);

    render(
      <DeviceQuotesPanel deviceId="device-1" serviceTypes={SERVICE_TYPES} />
    );

    await waitFor(() => {
      expect(screen.getByText('Screen replacement')).toBeInTheDocument();
    });
    expect(screen.getByText(/From/)).toBeInTheDocument();
    expect(screen.getByText('OEM')).toBeInTheDocument();
    expect(mockListQuotes).toHaveBeenCalledWith('device-1');
  });

  it('shows an empty state when there are no quotes', async () => {
    mockListQuotes.mockResolvedValue([]);

    render(
      <DeviceQuotesPanel deviceId="device-1" serviceTypes={SERVICE_TYPES} />
    );

    await waitFor(() => {
      expect(
        screen.getByText('No quotes yet for this device.')
      ).toBeInTheDocument();
    });
  });

  it('deletes a quote after confirming', async () => {
    mockListQuotes.mockResolvedValue([QUOTE]);
    mockDeleteQuote.mockResolvedValue(undefined);

    render(
      <DeviceQuotesPanel deviceId="device-1" serviceTypes={SERVICE_TYPES} />
    );

    await screen.findByText('Screen replacement');

    fireEvent.click(
      screen.getByRole('button', { name: 'Delete Screen replacement quote' })
    );
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

    await waitFor(() => {
      expect(mockDeleteQuote).toHaveBeenCalledWith('quote-1');
    });
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Quote removed' })
    );
  });

  it('disables quote mutation controls for view-only staff', async () => {
    mockListQuotes.mockResolvedValue([QUOTE]);

    render(
      <DeviceQuotesPanel
        deviceId="device-1"
        canEdit={false}
        canDelete={false}
        serviceTypes={SERVICE_TYPES}
      />
    );

    await screen.findByText('Screen replacement');
    expect(screen.getByRole('button', { name: 'Add quote' })).toBeDisabled();
    expect(
      screen.getByRole('button', { name: 'Edit Screen replacement quote' })
    ).toBeDisabled();
    expect(
      screen.getByRole('button', { name: 'Delete Screen replacement quote' })
    ).toBeDisabled();
  });

  it('shows a retry option when loading fails', async () => {
    mockListQuotes.mockRejectedValue(new Error('boom'));

    render(
      <DeviceQuotesPanel deviceId="device-1" serviceTypes={SERVICE_TYPES} />
    );

    await waitFor(() => {
      expect(screen.getByText('Could not load quotes.')).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });
});
