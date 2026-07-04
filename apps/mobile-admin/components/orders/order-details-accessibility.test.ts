import { describe, expect, it } from 'vitest';
import { shouldHideOrderDetailsContentFromAccessibility } from './order-details-accessibility';

const baseState = {
  selectedOrderItem: null,
  showCreditModal: false,
  showPaymentOptionModal: false,
  showReceiptPreview: false,
  showRecordPaymentModal: false,
  showShipmentFlow: false,
  showStatusModal: false,
  successModal: {
    visible: false,
  },
};

describe('shouldHideOrderDetailsContentFromAccessibility', () => {
  it('keeps order content accessible when no overlay is active', () => {
    expect(shouldHideOrderDetailsContentFromAccessibility(baseState)).toBe(
      false
    );
  });

  it.each([
    ['status drawer', { showStatusModal: true }],
    ['credit dialog', { showCreditModal: true }],
    ['payment option dialog', { showPaymentOptionModal: true }],
    ['record payment sheet', { showRecordPaymentModal: true }],
    ['shipment flow', { showShipmentFlow: true }],
    ['receipt preview', { showReceiptPreview: true }],
    ['success modal', { successModal: { visible: true } }],
    ['item modal', { selectedOrderItem: { id: 'item-1' } }],
  ])('hides order content while the %s is active', (_label, override) => {
    expect(
      shouldHideOrderDetailsContentFromAccessibility({
        ...baseState,
        ...override,
      })
    ).toBe(true);
  });
});
