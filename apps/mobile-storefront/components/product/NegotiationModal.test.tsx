import { render } from '@testing-library/react-native';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { NegotiationModal } from './NegotiationModal';

const mockRenderView = jest.fn();
const mockUseNegotiationModalController = jest.fn();

jest.mock('@/components/negotiation/NegotiationModalView', () => ({
  NegotiationModalView: (props: unknown) => {
    mockRenderView(props);
    return null;
  },
}));

jest.mock('@/components/negotiation/useNegotiationModalController', () => ({
  useNegotiationModalController: (params: unknown) =>
    mockUseNegotiationModalController(params),
}));

jest.mock('@/stores/cart-store', () => ({
  formatPrice: (value: number) => `₦${value.toLocaleString('en-US')}`,
}));

const baseControllerState = {
  attemptCount: 0,
  backFromUpload: jest.fn(),
  counterOffer: null,
  handleAcceptCounter: jest.fn(),
  handleSubmitOffer: jest.fn(),
  handleUploadSubmit: jest.fn(),
  message: '',
  offer: '',
  openUpload: jest.fn(),
  pickImage: jest.fn(),
  resetToInput: jest.fn(),
  setOffer: jest.fn(),
  setUploadLink: jest.fn(),
  status: 'input' as const,
  uploadFile: null,
  uploadLink: '',
};

describe('Product NegotiationModal wrapper', () => {
  beforeEach(() => {
    mockRenderView.mockClear();
    mockUseNegotiationModalController.mockReset();
    mockUseNegotiationModalController.mockReturnValue(baseControllerState);
  });

  it('wires shared controller options and forwards view props', () => {
    const onClose = jest.fn();
    const onSuccess = jest.fn();

    render(
      <NegotiationModal
        visible
        onClose={onClose}
        productId="product-1"
        merchantId="merchant-1"
        productName="MacBook Pro"
        currentPrice={2500000}
        onSuccess={onSuccess}
      />
    );

    expect(mockUseNegotiationModalController).toHaveBeenCalledWith(
      expect.objectContaining({
        currentPrice: 2500000,
        merchantId: 'merchant-1',
        onAcceptedPrice: onSuccess,
        type: 'single',
        visible: true,
      })
    );

    const controllerArgs = mockUseNegotiationModalController.mock.calls[0]?.[0] as {
      successMessageFormatter: (value: number) => string;
    };
    expect(controllerArgs.successMessageFormatter(2500000)).toBe(
      'Price updated: ₦2,500,000'
    );

    expect(mockRenderView).toHaveBeenCalledWith(
      expect.objectContaining({
        onClose,
        onSuccessAction: onClose,
        successActionLabel: 'Done',
        successActionStyle: 'neutral',
      })
    );
  });
});
