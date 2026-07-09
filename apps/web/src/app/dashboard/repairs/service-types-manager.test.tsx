import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { RepairServiceTypeAdmin } from '@/lib/repairs/catalog-admin-mappers';

// Radix's Switch measures itself via ResizeObserver, which jsdom does not
// implement. Stub it so the dialog can mount without crashing.
class ResizeObserverStub {
  observe() {
    // noop
  }
  unobserve() {
    // noop
  }
  disconnect() {
    // noop
  }
}
const globalWithResizeObserver = globalThis as unknown as {
  ResizeObserver?: typeof ResizeObserverStub;
};
globalWithResizeObserver.ResizeObserver ??= ResizeObserverStub;

const { mockToast } = vi.hoisted(() => ({ mockToast: vi.fn() }));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

vi.mock('./catalog-api', () => ({
  listServiceTypes: vi.fn(),
  createServiceType: vi.fn(),
  updateServiceType: vi.fn(),
  deleteServiceType: vi.fn(),
}));

import {
  createServiceType,
  deleteServiceType,
  listServiceTypes,
  updateServiceType,
} from './catalog-api';
import ServiceTypesManager from './service-types-manager';

const mockListServiceTypes = vi.mocked(listServiceTypes);
const mockCreateServiceType = vi.mocked(createServiceType);
const mockUpdateServiceType = vi.mocked(updateServiceType);
const mockDeleteServiceType = vi.mocked(deleteServiceType);

function buildServiceType(
  overrides: Partial<RepairServiceTypeAdmin> = {}
): RepairServiceTypeAdmin {
  return {
    id: 'st-1',
    name: 'Screen Repair',
    slug: 'screen-repair',
    description: null,
    sortOrder: 0,
    isActive: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('ServiceTypesManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the list of service types after a successful load', async () => {
    mockListServiceTypes.mockResolvedValue([
      buildServiceType({
        id: 'st-1',
        name: 'Screen Repair',
        slug: 'screen-repair',
        isActive: true,
      }),
      buildServiceType({
        id: 'st-2',
        name: 'Battery Replacement',
        slug: 'battery-replacement',
        isActive: false,
      }),
    ]);

    render(<ServiceTypesManager />);

    expect(await screen.findByText('Screen Repair')).toBeInTheDocument();
    expect(screen.getByText('Battery Replacement')).toBeInTheDocument();
    expect(screen.getByText('screen-repair')).toBeInTheDocument();
    expect(screen.getByText('Inactive')).toBeInTheDocument();
  });

  it('shows an empty state when there are no service types', async () => {
    mockListServiceTypes.mockResolvedValue([]);

    render(<ServiceTypesManager />);

    expect(await screen.findByText(/No service types yet/)).toBeInTheDocument();
  });

  it('shows an inline error state and a destructive toast when loading fails', async () => {
    mockListServiceTypes.mockRejectedValue(new Error('network down'));

    render(<ServiceTypesManager />);

    expect(
      await screen.findByText('Could not load service types.')
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({ variant: 'destructive' })
      );
    });
  });

  it('retries loading when the retry button is clicked', async () => {
    mockListServiceTypes
      .mockRejectedValueOnce(new Error('network down'))
      .mockResolvedValueOnce([buildServiceType()]);

    render(<ServiceTypesManager />);

    await screen.findByText('Could not load service types.');
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));

    expect(await screen.findByText('Screen Repair')).toBeInTheDocument();
    expect(mockListServiceTypes).toHaveBeenCalledTimes(2);
  });

  it('creates a service type and adds it to the list', async () => {
    mockListServiceTypes.mockResolvedValue([]);
    const created = buildServiceType({
      id: 'st-new',
      name: 'Water Damage',
      slug: 'water-damage',
    });
    mockCreateServiceType.mockResolvedValue(created);

    render(<ServiceTypesManager />);

    await screen.findByText(/No service types yet/);

    fireEvent.click(screen.getByRole('button', { name: 'Add service type' }));

    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText('Name'), {
      target: { value: 'Water Damage' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(mockCreateServiceType).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Water Damage', isActive: true })
      );
    });
    expect(await screen.findByText('Water Damage')).toBeInTheDocument();
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Service type added' })
    );
  });

  it('shows a destructive toast and keeps the dialog open when creation fails', async () => {
    mockListServiceTypes.mockResolvedValue([]);
    mockCreateServiceType.mockRejectedValue(new Error('Name already exists'));

    render(<ServiceTypesManager />);

    await screen.findByText(/No service types yet/);
    fireEvent.click(screen.getByRole('button', { name: 'Add service type' }));

    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText('Name'), {
      target: { value: 'Duplicate' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          variant: 'destructive',
          description: 'Name already exists',
        })
      );
    });
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('edits an existing service type', async () => {
    mockListServiceTypes.mockResolvedValue([buildServiceType()]);
    const updated = buildServiceType({ name: 'Screen Repair (Premium)' });
    mockUpdateServiceType.mockResolvedValue(updated);

    render(<ServiceTypesManager />);

    await screen.findByText('Screen Repair');
    fireEvent.click(screen.getByRole('button', { name: 'Edit Screen Repair' }));

    const dialog = await screen.findByRole('dialog');
    const nameInput = within(dialog).getByLabelText('Name');
    fireEvent.change(nameInput, {
      target: { value: 'Screen Repair (Premium)' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(mockUpdateServiceType).toHaveBeenCalledWith(
        'st-1',
        expect.objectContaining({ name: 'Screen Repair (Premium)' })
      );
    });
    expect(
      await screen.findByText('Screen Repair (Premium)')
    ).toBeInTheDocument();
  });

  it('deletes a service type after confirmation', async () => {
    mockListServiceTypes.mockResolvedValue([buildServiceType()]);
    mockDeleteServiceType.mockResolvedValue(undefined);

    render(<ServiceTypesManager />);

    await screen.findByText('Screen Repair');
    fireEvent.click(
      screen.getByRole('button', { name: 'Delete Screen Repair' })
    );

    const alertDialog = await screen.findByRole('alertdialog');
    fireEvent.click(
      within(alertDialog).getByRole('button', { name: 'Delete' })
    );

    await waitFor(() => {
      expect(mockDeleteServiceType).toHaveBeenCalledWith('st-1');
    });
    await waitFor(() => {
      expect(screen.queryByText('Screen Repair')).not.toBeInTheDocument();
    });
  });

  it('disables mutation controls for view-only staff', async () => {
    mockListServiceTypes.mockResolvedValue([buildServiceType()]);

    render(<ServiceTypesManager canEdit={false} canDelete={false} />);

    await screen.findByText('Screen Repair');
    expect(
      screen.getByRole('button', { name: 'Add service type' })
    ).toBeDisabled();
    expect(
      screen.getByRole('button', { name: 'Edit Screen Repair' })
    ).toBeDisabled();
    expect(
      screen.getByRole('button', { name: 'Delete Screen Repair' })
    ).toBeDisabled();
  });

  it('shows the server error message and keeps the row when deletion fails', async () => {
    mockListServiceTypes.mockResolvedValue([buildServiceType()]);
    mockDeleteServiceType.mockRejectedValue(
      new Error('Remove the quotes using this service type first')
    );

    render(<ServiceTypesManager />);

    await screen.findByText('Screen Repair');
    fireEvent.click(
      screen.getByRole('button', { name: 'Delete Screen Repair' })
    );

    const alertDialog = await screen.findByRole('alertdialog');
    fireEvent.click(
      within(alertDialog).getByRole('button', { name: 'Delete' })
    );

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          variant: 'destructive',
          description: 'Remove the quotes using this service type first',
        })
      );
    });
    expect(screen.getByText('Screen Repair')).toBeInTheDocument();
  });
});
