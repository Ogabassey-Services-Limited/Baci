import { Alert } from 'react-native';
import { describe, expect, it, vi } from 'vitest';

vi.mock('react-native', () => ({
  Alert: { alert: vi.fn() },
}));

vi.mock('@/lib/order-shipment', () => ({
  getDispatchPhoneFromOrder: vi.fn(() => null),
  getInitialFulfillmentDetails: vi.fn(() => ({ imei: '', serialNumber: '' })),
  shouldPersistFulfillmentDetails: vi.fn(() => false),
}));

vi.mock('./completeOrderShipment', () => ({
  completeOrderShipment: vi.fn(),
}));

import { createOrderDetailsShipmentActions } from './createOrderDetailsShipmentActions';

function makeActions(
  overrides?: Partial<Parameters<typeof createOrderDetailsShipmentActions>[0]>
) {
  return createOrderDetailsShipmentActions({
    fulfillmentDetails: { imei: '', serialNumber: '' },
    handleSaveRider: vi.fn(),
    order: undefined,
    pendingShipmentMode: 'self_fulfillment',
    providerBookingAvailable: false,
    providerLabel: null,
    queryClient: {} as never,
    requiresShipmentDetails: false,
    riderPhone: '',
    setFulfillmentDetails: vi.fn(),
    setIsShipmentSubmitting: vi.fn(),
    setPendingShipmentMode: vi.fn(),
    setRiderPhone: vi.fn(),
    setShipmentFlowStep: vi.fn(),
    setShowShipmentFlow: vi.fn(),
    setShowStatusModal: vi.fn(),
    setSuccessModal: vi.fn(),
    shipmentFlowStep: 'details',
    showShipmentFlow: false,
    updateStatus: vi.fn(),
    ...overrides,
  });
}

describe('createOrderDetailsShipmentActions', () => {
  it('does nothing in openShipmentFlow when order is undefined', () => {
    const setShowShipmentFlow = vi.fn();
    const actions = makeActions({ setShowShipmentFlow });

    actions.openShipmentFlow();

    expect(setShowShipmentFlow).not.toHaveBeenCalled();
  });

  it('resets state in closeShipmentFlow', () => {
    const setShowShipmentFlow = vi.fn();
    const setShipmentFlowStep = vi.fn();
    const setIsShipmentSubmitting = vi.fn();
    const actions = makeActions({
      setShowShipmentFlow,
      setShipmentFlowStep,
      setIsShipmentSubmitting,
    });

    actions.closeShipmentFlow();

    expect(setShowShipmentFlow).toHaveBeenCalledWith(false);
    expect(setShipmentFlowStep).toHaveBeenCalledWith('details');
    expect(setIsShipmentSubmitting).toHaveBeenCalledWith(false);
  });

  it('shows alert when fulfillment details are required but missing', () => {
    const setShipmentFlowStep = vi.fn();
    const actions = makeActions({
      requiresShipmentDetails: true,
      setShipmentFlowStep,
    });

    actions.proceedFromFulfillmentDetails();

    expect(Alert.alert).toHaveBeenCalledWith('Required', expect.any(String));
    expect(setShipmentFlowStep).not.toHaveBeenCalled();
  });

  it('advances to method step when fulfillment details are not required', () => {
    const setShipmentFlowStep = vi.fn();
    const actions = makeActions({
      requiresShipmentDetails: false,
      setShipmentFlowStep,
    });

    actions.proceedFromFulfillmentDetails();

    expect(setShipmentFlowStep).toHaveBeenCalledWith('method');
  });
});
