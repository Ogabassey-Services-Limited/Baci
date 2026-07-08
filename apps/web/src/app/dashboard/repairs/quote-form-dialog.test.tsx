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

// Switch uses Radix's useSize internally, which needs ResizeObserver — not
// implemented in jsdom.
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
    name,
    onValueChange,
    value,
  }: {
    children: ReactNode;
    name?: string;
    onValueChange: (val: string) => void;
    value: string;
  }) => (
    <select
      value={value}
      onChange={(event) => onValueChange(event.target.value)}
      aria-label={name === 'serviceType' ? 'Service type' : name}
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

import { createQuote, updateQuote } from './catalog-api';
import QuoteFormDialog from './quote-form-dialog';

const mockCreateQuote = vi.mocked(createQuote);
const mockUpdateQuote = vi.mocked(updateQuote);

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
  {
    id: 'st-2',
    name: 'Battery replacement',
    slug: 'battery-replacement',
    description: null,
    sortOrder: 1,
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

describe('QuoteFormDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates a new quote for the device', async () => {
    const onSaved = vi.fn();
    mockCreateQuote.mockResolvedValue({ ...QUOTE, id: 'new-quote' });

    render(
      <QuoteFormDialog
        open
        onOpenChange={vi.fn()}
        deviceId="device-1"
        serviceTypes={SERVICE_TYPES}
        initial={null}
        onSaved={onSaved}
      />
    );

    fireEvent.change(screen.getByRole('combobox', { name: 'Service type' }), {
      target: { value: 'st-2' },
    });
    fireEvent.change(screen.getByLabelText('Price'), {
      target: { value: '5000' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(mockCreateQuote).toHaveBeenCalledWith(
        expect.objectContaining({
          deviceId: 'device-1',
          serviceTypeId: 'st-2',
          price: 5000,
          isFromPrice: true,
        })
      );
    });
    expect(onSaved).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'new-quote' })
    );
  });

  it('rejects a submit with an invalid price', () => {
    render(
      <QuoteFormDialog
        open
        onOpenChange={vi.fn()}
        deviceId="device-1"
        serviceTypes={SERVICE_TYPES}
        initial={null}
        onSaved={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(
      screen.getByText('Enter a valid price of 0 or more.')
    ).toBeInTheDocument();
    expect(mockCreateQuote).not.toHaveBeenCalled();
  });

  it('prefills the form for edit and shows an error toast on failure', async () => {
    mockUpdateQuote.mockRejectedValue(new Error('boom'));

    render(
      <QuoteFormDialog
        open
        onOpenChange={vi.fn()}
        deviceId="device-1"
        serviceTypes={SERVICE_TYPES}
        initial={QUOTE}
        onSaved={vi.fn()}
      />
    );

    expect(screen.getByLabelText('Price')).toHaveValue(15000);

    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(mockUpdateQuote).toHaveBeenCalledWith(
        'quote-1',
        expect.objectContaining({ serviceTypeId: 'st-1', price: 15000 })
      );
    });
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Could not update quote',
        variant: 'destructive',
      })
    );
  });
});
