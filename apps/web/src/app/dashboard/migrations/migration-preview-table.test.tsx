import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import MigrationPreviewTable from '@/app/dashboard/migrations/migration-preview-table';

describe('MigrationPreviewTable', () => {
  it('renders preview rows and advances pagination', () => {
    const onPageChange = vi.fn();

    render(
      <MigrationPreviewTable
        entityType="orders"
        loading={false}
        onPageChange={onPageChange}
        page={1}
        pageSize={25}
        rows={[
          {
            id: 'row-1',
            meta: { unmatchedItemCount: 1 },
            normalized_payload: {
              orderNumber: 'ORD-1001',
              customer: { fullName: 'Ada Lovelace' },
              total: 25000,
              currency: 'NGN',
              items: [{ id: 'item-1' }],
            },
            row_number: 2,
            row_status: 'create',
            source_external_id: 'bumpa-1',
            validation_errors: [],
          },
        ]}
        total={30}
      />
    );

    expect(screen.getByText('ORD-1001 · Ada Lovelace')).toBeInTheDocument();
    expect(
      screen.getByText('25000 NGN · 1 item · 1 unmatched')
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /next/i }));

    expect(onPageChange).toHaveBeenCalledWith(2);
  });

  it('renders loading and empty states', () => {
    const { rerender } = render(
      <MigrationPreviewTable
        entityType="products"
        loading
        onPageChange={vi.fn()}
        page={1}
        pageSize={25}
        rows={[]}
        total={0}
      />
    );

    expect(screen.getByText(/loading preview rows/i)).toBeInTheDocument();

    rerender(
      <MigrationPreviewTable
        entityType="products"
        loading={false}
        onPageChange={vi.fn()}
        page={1}
        pageSize={25}
        rows={[]}
        total={0}
      />
    );

    expect(
      screen.getByText(/no preview rows available yet/i)
    ).toBeInTheDocument();
  });
});
