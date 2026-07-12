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
import type { RepairDeviceAdmin } from '@/lib/repairs/catalog-admin-mappers';

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
  createDevice: vi.fn(),
  updateDevice: vi.fn(),
  searchLinkableProducts: vi.fn(),
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
      aria-label={name === 'deviceType' ? 'Device type' : name}
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

import { createDevice, updateDevice } from './catalog-api';
import DeviceFormDialog from './device-form-dialog';

const mockCreateDevice = vi.mocked(createDevice);
const mockUpdateDevice = vi.mocked(updateDevice);

const DEVICE: RepairDeviceAdmin = {
  id: 'device-1',
  brand: 'Apple',
  model: 'iPhone 14',
  slug: 'apple-iphone-14',
  deviceType: 'Smartphone',
  productId: null,
  aliases: ['iphone14'],
  imageUrl: null,
  isActive: true,
  sortOrder: 0,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

describe('DeviceFormDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates a new device from the form', async () => {
    const onSaved = vi.fn();
    const onOpenChange = vi.fn();
    mockCreateDevice.mockResolvedValue({ ...DEVICE, id: 'new-device' });

    render(
      <DeviceFormDialog
        open
        onOpenChange={onOpenChange}
        initial={null}
        onSaved={onSaved}
      />
    );

    fireEvent.change(screen.getByLabelText('Brand'), {
      target: { value: 'Samsung' },
    });
    fireEvent.change(screen.getByLabelText('Model'), {
      target: { value: 'Galaxy S24' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(mockCreateDevice).toHaveBeenCalledWith(
        expect.objectContaining({
          brand: 'Samsung',
          model: 'Galaxy S24',
          deviceType: null,
          productId: null,
        })
      );
    });
    expect(onSaved).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'new-device' })
    );
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('shows a validation error when brand or model is missing', () => {
    render(
      <DeviceFormDialog
        open
        onOpenChange={vi.fn()}
        initial={null}
        onSaved={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(
      screen.getByText('Brand and model are required.')
    ).toBeInTheDocument();
    expect(mockCreateDevice).not.toHaveBeenCalled();
  });

  it('prefills the form for edit and shows an error toast on failure', async () => {
    mockUpdateDevice.mockRejectedValue(new Error('boom'));

    render(
      <DeviceFormDialog
        open
        onOpenChange={vi.fn()}
        initial={DEVICE}
        onSaved={vi.fn()}
      />
    );

    expect(screen.getByLabelText('Brand')).toHaveValue('Apple');
    expect(screen.getByLabelText('Model')).toHaveValue('iPhone 14');

    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(mockUpdateDevice).toHaveBeenCalledWith(
        'device-1',
        expect.objectContaining({ brand: 'Apple', model: 'iPhone 14' })
      );
    });
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Could not update device',
        variant: 'destructive',
      })
    );
  });
});
