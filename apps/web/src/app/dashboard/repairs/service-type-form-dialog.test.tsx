import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { RepairServiceTypeAdmin } from '@/lib/repairs/catalog-admin-mappers';

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
  createServiceType: vi.fn(),
  updateServiceType: vi.fn(),
}));

import { createServiceType, updateServiceType } from './catalog-api';
import ServiceTypeFormDialog from './service-type-form-dialog';

const mockCreateServiceType = vi.mocked(createServiceType);
const mockUpdateServiceType = vi.mocked(updateServiceType);

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

describe('ServiceTypeFormDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates a service type and reports the saved row', async () => {
    const created = buildServiceType({
      id: 'st-new',
      name: 'Water Damage',
      slug: 'water-damage',
      description: 'Liquid diagnostics',
      sortOrder: 7,
    });
    mockCreateServiceType.mockResolvedValue(created);
    const onOpenChange = vi.fn();
    const onSaved = vi.fn();

    render(
      <ServiceTypeFormDialog
        open
        onOpenChange={onOpenChange}
        initial={null}
        onSaved={onSaved}
      />
    );

    const dialog = screen.getByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText('Name'), {
      target: { value: 'Water Damage' },
    });
    fireEvent.change(within(dialog).getByLabelText('Description'), {
      target: { value: 'Liquid diagnostics' },
    });
    fireEvent.change(within(dialog).getByLabelText('Sort order'), {
      target: { value: '7' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(mockCreateServiceType).toHaveBeenCalledWith({
        name: 'Water Damage',
        description: 'Liquid diagnostics',
        sortOrder: 7,
        isActive: true,
      });
    });
    expect(onSaved).toHaveBeenCalledWith(created);
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(mockToast).toHaveBeenCalledWith({ title: 'Service type added' });
  });

  it('updates an existing service type', async () => {
    const initial = buildServiceType();
    const updated = buildServiceType({ name: 'Screen Repair Plus' });
    mockUpdateServiceType.mockResolvedValue(updated);
    const onSaved = vi.fn();

    render(
      <ServiceTypeFormDialog
        open
        onOpenChange={vi.fn()}
        initial={initial}
        onSaved={onSaved}
      />
    );

    const dialog = screen.getByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText('Name'), {
      target: { value: 'Screen Repair Plus' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(mockUpdateServiceType).toHaveBeenCalledWith(
        'st-1',
        expect.objectContaining({ name: 'Screen Repair Plus' })
      );
    });
    expect(onSaved).toHaveBeenCalledWith(updated);
    expect(mockToast).toHaveBeenCalledWith({ title: 'Service type updated' });
  });

  it('keeps the dialog open and shows a destructive toast when saving fails', async () => {
    mockCreateServiceType.mockRejectedValue(new Error('Name already exists'));
    const onOpenChange = vi.fn();

    render(
      <ServiceTypeFormDialog
        open
        onOpenChange={onOpenChange}
        initial={null}
        onSaved={vi.fn()}
      />
    );

    const dialog = screen.getByRole('dialog');
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
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });
});
