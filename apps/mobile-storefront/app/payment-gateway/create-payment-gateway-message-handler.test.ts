import { jest } from '@jest/globals';
import { router } from 'expo-router';
import { PAYMENT_CLIPBOARD_BRIDGE } from '@/constants/payment-clipboard-bridge';
import { createPaymentGatewayMessageHandler } from './create-payment-gateway-message-handler';

jest.mock('expo-router', () => ({
  router: {
    replace: jest.fn(),
  },
}));

function createHandler() {
  const copiedGatewayTextRef = { current: null as string | null };
  const clearCart = jest.fn();
  const copyGatewayText = jest.fn<
    (text: string, success: string, failure?: string) => Promise<void>
  >(() => Promise.resolve());
  const markPaymentCompletionStarted = jest.fn();
  const scheduleDelayedNavigation = jest.fn<(navigate: () => void) => void>();
  const setSuccessStatus = jest.fn();
  const handler = createPaymentGatewayMessageHandler({
    clearCart,
    copiedGatewayTextRef,
    copyGatewayText,
    gateway: undefined,
    orderId: ' order-123 ',
    orderNumber: ' ORD-123 ',
    reference: ' ref-123 ',
    markPaymentCompletionStarted,
    scheduleDelayedNavigation,
    setSuccessStatus,
  });

  return {
    clearCart,
    copiedGatewayTextRef,
    copyGatewayText,
    handler,
    markPaymentCompletionStarted,
    scheduleDelayedNavigation,
    setSuccessStatus,
  };
}

function sendMessage(
  handler: ReturnType<typeof createPaymentGatewayMessageHandler>,
  data: unknown
) {
  handler({ nativeEvent: { data: JSON.stringify(data) } });
}

describe('createPaymentGatewayMessageHandler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
  });

  it('copies clipboard text once and trims the payload', () => {
    const { copiedGatewayTextRef, copyGatewayText, handler } = createHandler();

    sendMessage(handler, {
      text: '  1234567890  ',
      type: PAYMENT_CLIPBOARD_BRIDGE.clipboardMessageType,
    });
    sendMessage(handler, {
      text: '1234567890',
      type: PAYMENT_CLIPBOARD_BRIDGE.clipboardMessageType,
    });

    expect(copiedGatewayTextRef.current).toBe('1234567890');
    expect(copyGatewayText).toHaveBeenCalledTimes(1);
    expect(copyGatewayText).toHaveBeenCalledWith('1234567890', 'Text copied.');
  });

  it('uses account-number specific copy messages', () => {
    const { copyGatewayText, handler } = createHandler();

    sendMessage(handler, {
      text: '1234567890',
      type: PAYMENT_CLIPBOARD_BRIDGE.accountNumberMessageType,
    });

    expect(copyGatewayText).toHaveBeenCalledWith(
      '1234567890',
      'Account number copied.',
      'Unable to copy account number.'
    );
  });

  it('routes crypto success with sanitized fallback params', () => {
    const {
      clearCart,
      handler,
      markPaymentCompletionStarted,
      scheduleDelayedNavigation,
      setSuccessStatus,
    } = createHandler();

    sendMessage(handler, { type: 'crypto_success' });

    expect(markPaymentCompletionStarted).toHaveBeenCalledTimes(1);
    expect(setSuccessStatus).toHaveBeenCalledTimes(1);
    expect(clearCart).toHaveBeenCalledTimes(1);
    expect(scheduleDelayedNavigation).toHaveBeenCalledTimes(1);
    expect(router.replace).not.toHaveBeenCalled();

    const scheduledNavigation = scheduleDelayedNavigation.mock.calls[0]?.[0];
    expect(scheduledNavigation).toBeDefined();
    scheduledNavigation?.();
    expect(router.replace).toHaveBeenCalledWith({
      pathname: '/order-success',
      params: {
        orderId: 'order-123',
        orderNumber: 'ORD-123',
        paymentMethod: 'crypto',
        reference: 'ref-123',
      },
    });
  });

  it('ignores invalid JSON and non-record messages', () => {
    const { copyGatewayText, handler } = createHandler();

    handler({ nativeEvent: { data: '{' } });
    sendMessage(handler, ['payment_clipboard_copy']);

    expect(copyGatewayText).not.toHaveBeenCalled();
  });
});
