import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { createBNPLOpenWindowHandler } from './bnpl-open-window-handler';

const mockResolveAction =
  jest.fn<
    () =>
      | { type: 'ignore' }
      | { targetUrl: string; type: 'untrusted' }
      | { targetUrl: string; type: 'load' }
  >();
const mockGetDebugUrlDetails = jest.fn<(targetUrl?: string) => unknown>(() => ({
  host: 'example.com',
}));

jest.mock('./bnpl-checkout.helpers', () => ({
  BNPL_UNTRUSTED_POPUP_MESSAGE: 'Untrusted popup blocked',
  getBNPLDebugUrlDetails: (targetUrl?: string) =>
    mockGetDebugUrlDetails(targetUrl),
}));

jest.mock('./bnpl-checkout-controller-actions', () => ({
  resolveBNPLPopupTargetAction: () => mockResolveAction(),
}));

jest.mock('./bnpl-checkout-message-handler', () => ({
  logBNPLCheckoutDebug: jest.fn(),
}));

function createDeps() {
  return {
    apiBaseUrl: 'https://www.baci.shop',
    merchantDomain: 'shop.example.com',
    merchantSlug: 'demo',
    clearPendingLoadTimeout: jest.fn(),
    scheduleLoadTimeout: jest.fn(),
    setCheckoutStatus: jest.fn<(status: 'loading' | 'error') => void>(),
    setCurrentUrl: jest.fn<(url: string) => void>(),
    setErrorMessage: jest.fn<(message: string | null) => void>(),
  };
}

const event = {
  nativeEvent: { targetUrl: 'https://www.baci.shop/demo/checkout/bnpl' },
};

describe('createBNPLOpenWindowHandler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('loads a trusted popup target in the same WebView', () => {
    // Arrange
    mockResolveAction.mockReturnValue({
      targetUrl: 'https://www.baci.shop/demo/checkout/bnpl',
      type: 'load',
    });
    const deps = createDeps();
    const handler = createBNPLOpenWindowHandler(deps);

    // Act
    handler(event);

    // Assert
    expect(deps.setErrorMessage).toHaveBeenCalledWith(null);
    expect(deps.scheduleLoadTimeout).toHaveBeenCalledTimes(1);
    expect(deps.setCheckoutStatus).toHaveBeenCalledWith('loading');
    expect(deps.setCurrentUrl).toHaveBeenCalledWith(
      'https://www.baci.shop/demo/checkout/bnpl'
    );
    expect(deps.clearPendingLoadTimeout).not.toHaveBeenCalled();
  });

  it('surfaces a security error for untrusted popup targets', () => {
    // Arrange
    mockResolveAction.mockReturnValue({
      targetUrl: 'https://evil.example/checkout/bnpl',
      type: 'untrusted',
    });
    const deps = createDeps();
    const handler = createBNPLOpenWindowHandler(deps);

    // Act
    handler(event);

    // Assert
    expect(deps.clearPendingLoadTimeout).toHaveBeenCalledTimes(1);
    expect(deps.setCheckoutStatus).toHaveBeenCalledWith('error');
    expect(deps.setErrorMessage).toHaveBeenCalledWith(
      'Untrusted popup blocked'
    );
    expect(deps.setCurrentUrl).not.toHaveBeenCalled();
    expect(deps.scheduleLoadTimeout).not.toHaveBeenCalled();
  });

  it('ignores blank or unactionable popup requests', () => {
    // Arrange
    mockResolveAction.mockReturnValue({ type: 'ignore' });
    const deps = createDeps();
    const handler = createBNPLOpenWindowHandler(deps);

    // Act
    handler(event);

    // Assert
    expect(deps.setCheckoutStatus).not.toHaveBeenCalled();
    expect(deps.setCurrentUrl).not.toHaveBeenCalled();
    expect(deps.setErrorMessage).not.toHaveBeenCalled();
    expect(deps.clearPendingLoadTimeout).not.toHaveBeenCalled();
  });
});
