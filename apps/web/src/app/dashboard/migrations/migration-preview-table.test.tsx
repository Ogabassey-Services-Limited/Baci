import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import MigrationPreviewTable from '@/app/dashboard/migrations/migration-preview-table';
import type { NormalizedImportedOrder } from '@/lib/imports/bumpa/bumpa-types';

function createOrderPayload(
  overrides: Partial<NormalizedImportedOrder> = {}
): NormalizedImportedOrder {
  return {
    sourcePlatform: 'bumpa',
    externalSourceId: 'bumpa-1',
    orderNumber: 'ORD-1001',
    customer: {
      claimable: true,
      email: 'ada@example.com',
      firstName: 'Ada',
      fullName: 'Ada Lovelace',
      lastName: 'Lovelace',
      phone: null,
    },
    paymentStatus: 'paid',
    shippingStatus: 'pending',
    sourceOrderStatus: 'pending',
    sourceShippingStatus: null,
    sourceChannel: 'MOBILE',
    sourceOrigin: 'instagram',
    total: 25000,
    subtotal: 25000,
    discountAmount: 0,
    shippingFee: 0,
    taxAmount: 0,
    amountPaid: 25000,
    amountDue: 0,
    currency: 'NGN',
    orderDate: '2026-03-23T00:00:00.000Z',
    createdAt: '2026-03-23T00:00:00.000Z',
    updatedAt: null,
    couponCode: null,
    shippingOption: null,
    shippingAddress: null,
    receiptReady: false,
    items: [
      {
        lineTotal: 25000,
        matched: false,
        matchSource: 'unmatched',
        productId: null,
        productName: 'Widget',
        quantity: 1,
        sku: null,
        unitPrice: 25000,
      },
    ],
    importMetadata: {},
    ...overrides,
  };
}

describe('MigrationPreviewTable', () => {
  it('renders preview rows and advances pagination', () => {
    const onPageChange = vi.fn();

    render(
      <MigrationPreviewTable
        entityType="orders"
        filter="all"
        loading={false}
        onPageChange={onPageChange}
        page={1}
        pageSize={25}
        rows={[
          {
            id: 'row-1',
            meta: { unmatchedItemCount: 1 },
            normalized_payload: createOrderPayload(),
            row_number: 2,
            row_status: 'create',
            source_external_id: 'bumpa-1',
            source_payload: {},
            validation_errors: [],
          },
        ]}
        total={30}
      />
    );

    expect(screen.getByText('ORD-1001')).toBeInTheDocument();
    expect(screen.getByText('Ada Lovelace')).toBeInTheDocument();
    expect(screen.getByText('Instagram')).toBeInTheDocument();
    expect(screen.getByText('Create new')).toBeInTheDocument();
    expect(
      screen.getByText('25000 NGN · 1 item · 1 unmatched')
    ).toBeInTheDocument();
    expect(screen.queryByText('bumpa-1')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /next/i }));

    expect(onPageChange).toHaveBeenCalledWith(2);
  });

  it('renders loading and empty states', () => {
    const { rerender } = render(
      <MigrationPreviewTable
        entityType="products"
        filter="all"
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
        filter="needs_fix"
        loading={false}
        onPageChange={vi.fn()}
        page={1}
        pageSize={25}
        rows={[]}
        total={0}
      />
    );

    expect(
      screen.getByText(/no rows currently need fixes/i)
    ).toBeInTheDocument();
  });

  it('shows helper copy when focusing on importable rows', () => {
    render(
      <MigrationPreviewTable
        entityType="orders"
        filter="importable"
        loading={false}
        onPageChange={vi.fn()}
        page={1}
        pageSize={25}
        rows={[
          {
            id: 'row-1',
            meta: { unmatchedItemCount: 1 },
            normalized_payload: createOrderPayload(),
            row_number: 2,
            row_status: 'create',
            source_external_id: 'bumpa-1',
            source_payload: {},
            validation_errors: [],
          },
        ]}
        total={1}
      />
    );

    expect(
      screen.getByText(/showing rows ready to import/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/these rows will be created or updated/i)
    ).toBeInTheDocument();
  });

  it('renders invalid rows with source payload context instead of generic labels', () => {
    render(
      <MigrationPreviewTable
        entityType="orders"
        filter="needs_fix"
        loading={false}
        onPageChange={vi.fn()}
        page={1}
        pageSize={25}
        rows={[
          {
            id: 'row-invalid',
            meta: {},
            normalized_payload: null,
            row_number: 4749,
            row_status: 'invalid',
            source_external_id: null,
            source_payload: {
              'Order Number': '01160',
              'Customer Name': 'Ajewole Oluwatoni',
              'Customer Email': 'ajewoleoluwatoni@gmail.com',
              Origin: 'whatsapp',
              Channel: 'MOBILE',
              Total: '575700.00',
            },
            validation_errors: [
              'Products is missing',
              'Product quantity is missing',
            ],
          },
        ]}
        total={1}
      />
    );

    expect(screen.getByText('01160')).toBeInTheDocument();
    expect(screen.getByText('CSV Row 4749')).toBeInTheDocument();
    expect(screen.getByText('Ajewole Oluwatoni')).toBeInTheDocument();
    expect(screen.getByText('WhatsApp')).toBeInTheDocument();
    expect(
      screen.getByText('575700.00 NGN · ajewoleoluwatoni@gmail.com')
    ).toBeInTheDocument();
    const errorsCell = screen.getByText(/Products is missing/);
    expect(errorsCell).toHaveTextContent('Products is missing');
    expect(errorsCell).toHaveTextContent('Product quantity is missing');
  });
});
