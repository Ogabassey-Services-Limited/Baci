import { describe, expect, it } from 'vitest';
import type { TransactionReviewOrder } from './transaction-review-types';
import {
  filterOrdersForTransactionTab,
  formatCostPriceInput,
  formatCostPriceInputText,
  formatPickerDateInput,
  getSupplierOptionsFromOrders,
  parseDateInputForPicker,
  parseCostPriceInput,
  toSentenceCaseSupplierName,
} from './transaction-review-inputs';

const baseOrder: Omit<TransactionReviewOrder, 'items' | 'missingCostCount'> = {
  createdAt: '2026-05-11T12:30:00.000Z',
  customerEmail: null,
  customerName: 'Customer',
  customerPhone: null,
  estimatedProfit: 1000,
  id: 'order-1',
  orderNumber: 'ORD-1',
  paymentMethod: 'transfer',
  searchText: 'ord-1 customer',
  total: 9000,
};

describe('transaction review input helpers', () => {
  it('formats and parses currency cost price text', () => {
    expect(formatCostPriceInput(null, '₦')).toBe('');
    expect(formatCostPriceInput(1200, '₦')).toBe('₦1,200');
    expect(formatCostPriceInput(-1200, '₦')).toBe('-₦1,200');
    expect(formatCostPriceInputText('1200000.50', '₦')).toBe('₦1,200,000.50');
    expect(formatCostPriceInputText('-1200', '₦')).toBe('-₦1,200');
    expect(parseCostPriceInput('₦1,200,000.50')).toBe(1_200_000.5);
    expect(parseCostPriceInput('-₦1,200')).toBe(-1200);
    expect(parseCostPriceInput('₦-1,200')).toBe(-1200);
    expect(Number.isNaN(parseCostPriceInput('₦'))).toBe(true);
  });

  it('formats local picker dates for transaction date input fields', () => {
    expect(formatPickerDateInput(new Date(2026, 4, 14))).toBe('2026-05-14');
    expect(parseDateInputForPicker('2026-05-14').getFullYear()).toBe(2026);
    expect(parseDateInputForPicker('bad-date').getTime()).not.toBeNaN();
  });

  it('sentence-cases suppliers and filters missing-cost tab line items', () => {
    const orders: TransactionReviewOrder[] = [
      {
        ...baseOrder,
        items: [
          {
            costPrice: 3000,
            id: 'item-known',
            imeiValues: [],
            name: 'Known Cost',
            productId: 'product-1',
            profit: 2000,
            quantity: 1,
            revenue: 5000,
            searchText: 'known cost',
            serialValues: [],
            sku: null,
            supplierName: 'SLOT WHOLESALE',
          },
          {
            costPrice: null,
            id: 'item-missing',
            imeiValues: [],
            name: 'Missing Cost',
            productId: 'product-2',
            profit: null,
            quantity: 1,
            revenue: 4000,
            searchText: 'missing cost',
            serialValues: [],
            sku: null,
            supplierName: 'slot wholesale',
          },
        ],
        missingCostCount: 1,
      },
    ];

    expect(toSentenceCaseSupplierName('  MAIN SUPPLIER ltd  ')).toBe(
      'Main supplier ltd'
    );
    expect(getSupplierOptionsFromOrders(orders)).toEqual(['Slot wholesale']);
    expect(filterOrdersForTransactionTab(orders, 'missing-costs')).toEqual([
      expect.objectContaining({
        items: [expect.objectContaining({ id: 'item-missing' })],
        missingCostCount: 1,
      }),
    ]);
  });
});
