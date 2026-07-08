import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { RepairImportDraftRow } from '@/lib/repairs/import-match';

const { toastMock } = vi.hoisted(() => ({ toastMock: vi.fn() }));

vi.mock('./catalog-api', () => ({
  parseImport: vi.fn(),
  commitImport: vi.fn(),
}));
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: toastMock }),
}));

import { commitImport, parseImport } from './catalog-api';
import ImportManager from './import-manager';

function makeDraft(
  overrides: Partial<RepairImportDraftRow> = {}
): RepairImportDraftRow {
  return {
    brand: 'Apple',
    model: 'iPhone 12',
    repairType: 'Screen replacement',
    price: 25000,
    partQuality: null,
    status: 'new_device',
    deviceId: null,
    suggestedProductId: null,
    serviceTypeId: null,
    newServiceTypeName: 'Screen replacement',
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('ImportManager', () => {
  it('parses a pasted list and renders the review table rows', async () => {
    vi.mocked(parseImport).mockResolvedValue([
      makeDraft(),
      makeDraft({
        model: 'iPhone 13',
        status: 'existing_device',
        deviceId: 'device-1',
      }),
    ]);

    render(<ImportManager />);

    fireEvent.change(screen.getByLabelText('Price list'), {
      target: { value: 'iPhone 12 screen 25000\niPhone 13 screen 30000' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Parse list' }));

    await waitFor(() => {
      expect(
        screen.getByRole('switch', { name: 'Include row 1' })
      ).toBeInTheDocument();
    });
    expect(
      screen.getByRole('switch', { name: 'Include row 2' })
    ).toBeInTheDocument();
    expect(
      screen.getByText('2 of 2 rows will be imported')
    ).toBeInTheDocument();
    expect(parseImport).toHaveBeenCalledWith(
      'iPhone 12 screen 25000\niPhone 13 screen 30000'
    );
  });

  it('shows a destructive toast and no rows when parsing fails', async () => {
    vi.mocked(parseImport).mockRejectedValue(
      new Error('AI import is not configured')
    );

    render(<ImportManager />);

    fireEvent.change(screen.getByLabelText('Price list'), {
      target: { value: 'iPhone 12 screen 25000' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Parse list' }));

    await waitFor(() => {
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({
          variant: 'destructive',
          description: 'AI import is not configured',
        })
      );
    });
    expect(screen.queryByRole('switch')).not.toBeInTheDocument();
  });

  it('commits only the non-rejected rows and shows the result counts', async () => {
    vi.mocked(parseImport).mockResolvedValue([
      makeDraft(),
      makeDraft({
        model: 'iPhone 13',
        status: 'existing_device',
        deviceId: 'device-1',
        serviceTypeId: 'service-1',
        suggestedProductId: 'product-1',
      }),
    ]);
    vi.mocked(commitImport).mockResolvedValue({
      serviceTypesCreated: 1,
      devicesCreated: 1,
      quotesCreated: 1,
      quotesUpdated: 1,
    });

    render(<ImportManager />);

    fireEvent.change(screen.getByLabelText('Price list'), {
      target: { value: 'iPhone 12 screen 25000\niPhone 13 screen 30000' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Parse list' }));

    await waitFor(() => {
      expect(
        screen.getByRole('switch', { name: 'Include row 1' })
      ).toBeInTheDocument();
    });

    // Reject the first (new-device) row — only the second row should commit.
    fireEvent.click(screen.getByRole('switch', { name: 'Include row 1' }));
    expect(
      screen.getByText('1 of 2 rows will be imported')
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Commit 1 row' }));

    await waitFor(() => {
      expect(commitImport).toHaveBeenCalledWith([
        {
          brand: 'Apple',
          model: 'iPhone 13',
          repairType: 'Screen replacement',
          price: 25000,
          partQuality: null,
          isFromPrice: true,
          deviceId: 'device-1',
          serviceTypeId: 'service-1',
          productId: 'product-1',
        },
      ]);
    });

    expect(
      await screen.findByText('Service types created')
    ).toBeInTheDocument();
    expect(screen.getByText('Devices created')).toBeInTheDocument();
    expect(screen.getByText('Quotes created')).toBeInTheDocument();
    expect(screen.getByText('Quotes updated')).toBeInTheDocument();
    expect(screen.getAllByText('1')).toHaveLength(4);
    expect(screen.queryByRole('switch')).not.toBeInTheDocument();
    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Import committed' })
    );
  });
});
