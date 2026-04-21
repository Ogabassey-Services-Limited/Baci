import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const backHandlerMock = vi.hoisted(() => {
  type Listener = () => boolean;
  const state: { listener: Listener | null } = { listener: null };

  const addEventListener = vi.fn((_event: string, handler: Listener) => {
    state.listener = handler;
    return {
      remove: vi.fn(() => {
        state.listener = null;
      }),
    };
  });

  return { addEventListener, state };
});

vi.mock('react-native', () => ({
  BackHandler: {
    addEventListener: backHandlerMock.addEventListener,
  },
  Platform: { OS: 'android' },
}));

import { useOrderDetailsBackHandler } from './useOrderDetailsBackHandler';

type HookParams = Parameters<typeof useOrderDetailsBackHandler>[0];

function buildParams(overrides: Partial<HookParams> = {}): HookParams {
  return {
    requiresShipmentDetails: false,
    selectedOrderItemOpen: false,
    setIsShipmentSubmitting: vi.fn(),
    setSelectedOrderItemOpen: vi.fn(),
    setShowCreditModal: vi.fn(),
    setShowPaymentOptionModal: vi.fn(),
    setShowRecordPaymentModal: vi.fn(),
    setShowShipmentFlow: vi.fn(),
    setShowStatusModal: vi.fn(),
    setShipmentFlowStep: vi.fn(),
    showCreditModal: false,
    showPaymentOptionModal: false,
    showRecordPaymentModal: false,
    showShipmentFlow: false,
    showStatusModal: false,
    shipmentFlowStep: 'details',
    ...overrides,
  };
}

describe('useOrderDetailsBackHandler', () => {
  beforeEach(() => {
    backHandlerMock.addEventListener.mockClear();
    backHandlerMock.state.listener = null;
  });

  it('closes the status modal and intercepts back when showStatusModal is true', () => {
    const setShowStatusModal = vi.fn();
    renderHook(() =>
      useOrderDetailsBackHandler(
        buildParams({ showStatusModal: true, setShowStatusModal })
      )
    );

    expect(backHandlerMock.state.listener).not.toBeNull();
    const result = backHandlerMock.state.listener?.();

    expect(result).toBe(true);
    expect(setShowStatusModal).toHaveBeenCalledWith(false);
  });

  it('does not register a listener when no modal is open', () => {
    renderHook(() => useOrderDetailsBackHandler(buildParams()));

    expect(backHandlerMock.addEventListener).not.toHaveBeenCalled();
    expect(backHandlerMock.state.listener).toBeNull();
  });
});
