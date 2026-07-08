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

// Nested dialogs render a Switch, which uses Radix's useSize internally —
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
  listDevices: vi.fn(),
  createDevice: vi.fn(),
  updateDevice: vi.fn(),
  deleteDevice: vi.fn(),
  listServiceTypes: vi.fn(),
  listQuotes: vi.fn(),
  createQuote: vi.fn(),
  updateQuote: vi.fn(),
  deleteQuote: vi.fn(),
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
      aria-label={name}
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

import { deleteDevice, listDevices, listServiceTypes } from './catalog-api';
import DevicesManager from './devices-manager';

const mockListDevices = vi.mocked(listDevices);
const mockDeleteDevice = vi.mocked(deleteDevice);
const mockListServiceTypes = vi.mocked(listServiceTypes);

const LINKED_DEVICE: RepairDeviceAdmin = {
  id: 'device-1',
  brand: 'Apple',
  model: 'iPhone 14',
  slug: 'apple-iphone-14',
  deviceType: 'Smartphone',
  productId: 'product-1',
  aliases: [],
  imageUrl: null,
  isActive: true,
  sortOrder: 0,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

const UNLINKED_DEVICE: RepairDeviceAdmin = {
  id: 'device-2',
  brand: 'Samsung',
  model: 'Galaxy S24',
  slug: 'samsung-galaxy-s24',
  deviceType: 'Smartphone',
  productId: null,
  aliases: [],
  imageUrl: null,
  isActive: false,
  sortOrder: 1,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

describe('DevicesManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockListServiceTypes.mockResolvedValue([]);
  });

  it('renders devices with linked and status badges', async () => {
    mockListDevices.mockResolvedValue([LINKED_DEVICE, UNLINKED_DEVICE]);

    render(<DevicesManager />);

    await waitFor(() => {
      expect(screen.getByText('Apple')).toBeInTheDocument();
    });
    expect(screen.getByText('iPhone 14')).toBeInTheDocument();
    expect(screen.getByText('Linked')).toBeInTheDocument();
    expect(screen.getByText('Samsung')).toBeInTheDocument();
    expect(screen.getAllByText('Active')).toHaveLength(1);
    expect(screen.getAllByText('Inactive')).toHaveLength(1);
  });

  it('searches devices by query', async () => {
    mockListDevices.mockResolvedValue([LINKED_DEVICE]);

    render(<DevicesManager />);

    await waitFor(() => {
      expect(mockListDevices).toHaveBeenCalledWith(undefined);
    });

    fireEvent.change(
      screen.getByRole('searchbox', { name: 'Search devices' }),
      {
        target: { value: 'iphone' },
      }
    );
    fireEvent.click(screen.getByRole('button', { name: 'Search' }));

    await waitFor(() => {
      expect(mockListDevices).toHaveBeenCalledWith('iphone');
    });
  });

  it('deletes a device after confirming', async () => {
    mockListDevices.mockResolvedValue([LINKED_DEVICE]);
    mockDeleteDevice.mockResolvedValue(undefined);

    render(<DevicesManager />);

    await screen.findByText('Apple');

    fireEvent.click(
      screen.getByRole('button', { name: 'Delete Apple iPhone 14' })
    );
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

    await waitFor(() => {
      expect(mockDeleteDevice).toHaveBeenCalledWith('device-1');
    });
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Device removed' })
    );
  });

  it('shows an error state with a working retry action', async () => {
    mockListDevices.mockRejectedValueOnce(new Error('boom'));

    render(<DevicesManager />);

    await waitFor(() => {
      expect(screen.getByText('Could not load devices.')).toBeInTheDocument();
    });

    mockListDevices.mockResolvedValueOnce([LINKED_DEVICE]);
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));

    await waitFor(() => {
      expect(screen.getByText('Apple')).toBeInTheDocument();
    });
  });
});
