import { render } from '@testing-library/react-native';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { NegotiationModal } from './NegotiationModal';

const mockRenderView = jest.fn();
const mockUseNegotiationModalController = jest.fn();
const mockApplyNegotiatedPrice = jest.fn();
const mockApplyCartWideNegotiation = jest.fn();
const mockCloseNegotiation = jest.fn();

const uiState = {
  closeNegotiation: mockCloseNegotiation,
  isNegotiationModalOpen: true,
  negotiationContext: {
    currentPrice: 500000,
    itemId: 'line-item-1',
    productName: 'iPhone 13',
    type: 'single' as const,
  },
};

jest.mock('zustand/react/shallow', () => ({
  useShallow: <T,>(selector: T) => selector,
}));

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

jest.mock('@/stores/ui-store', () => ({
  useUIStore: () => ({
    closeNegotiation: uiState.closeNegotiation,
    isNegotiationModalOpen: uiState.isNegotiationModalOpen,
    negotiationContext: uiState.negotiationContext,
  }),
}));

jest.mock('@/stores/auth-store', () => ({
  useAuthStore: (selector: (state: { merchantId: string }) => unknown) =>
    selector({ merchantId: 'merchant-1' }),
}));

jest.mock('@/stores/cart-store', () => ({
  formatPrice: (value: number) => `₦${value.toLocaleString('en-US')}`,
  useCartStore: (
    selector: (state: {
      applyCartWideNegotiation: typeof mockApplyCartWideNegotiation;
      applyNegotiatedPrice: typeof mockApplyNegotiatedPrice;
    }) => unknown
  ) =>
    selector({
      applyCartWideNegotiation: mockApplyCartWideNegotiation,
      applyNegotiatedPrice: mockApplyNegotiatedPrice,
    }),
}));

const baseControllerState = {
  attemptCount: 0,
  backFromUpload: jest.fn(),
  counterOffer: null,
  handleAcceptCounter: jest.fn(),
  handleSubmitOffer: jest.fn(),
  handleUploadSubmit: jest.fn(),
  message: '',
  offer: '450000',
  openUpload: jest.fn(),
  pickImage: jest.fn(),
  resetToInput: jest.fn(),
  setOffer: jest.fn(),
  setUploadLink: jest.fn(),
  status: 'success' as const,
  uploadFile: null,
  uploadLink: '',
};

describe('Cart NegotiationModal wrapper', () => {
  beforeEach(() => {
    mockRenderView.mockClear();
    mockUseNegotiationModalController.mockReset();
    mockUseNegotiationModalController.mockReturnValue(baseControllerState);
    mockApplyNegotiatedPrice.mockReset();
    mockApplyCartWideNegotiation.mockReset();
    mockCloseNegotiation.mockReset();
    uiState.isNegotiationModalOpen = true;
    uiState.negotiationContext = {
      currentPrice: 500000,
      itemId: 'line-item-1',
      productName: 'iPhone 13',
      type: 'single',
    };
  });

  it('returns null when modal is closed', () => {
    uiState.isNegotiationModalOpen = false;
    const tree = render(<NegotiationModal />);

    expect(tree.toJSON()).toBeNull();
    expect(mockUseNegotiationModalController).toHaveBeenCalledWith(
      expect.objectContaining({
        visible: false,
      })
    );
    expect(mockRenderView).not.toHaveBeenCalled();
  });

  it('wires controller options and forwards success CTA props', () => {
    render(<NegotiationModal />);

    expect(mockUseNegotiationModalController).toHaveBeenCalledWith(
      expect.objectContaining({
        currentPrice: 500000,
        merchantId: 'merchant-1',
        type: 'single',
        visible: true,
      })
    );

    const controllerArgs = mockUseNegotiationModalController.mock.calls[0]?.[0] as {
      successMessageFormatter: (value: number) => string;
    };
    expect(controllerArgs.successMessageFormatter(450000)).toBe('New price: ₦450,000');

    const renderedProps = mockRenderView.mock.calls[0]?.[0] as {
      onSuccessAction: unknown;
      successActionLabel: string;
      successActionStyle: string;
    };

    expect(typeof renderedProps.onSuccessAction).toBe('function');
    expect(mockApplyNegotiatedPrice).not.toHaveBeenCalled();
    expect(mockApplyCartWideNegotiation).not.toHaveBeenCalled();
    expect(mockCloseNegotiation).not.toHaveBeenCalled();
    expect(renderedProps.successActionLabel).toBe('Apply to Cart');
    expect(renderedProps.successActionStyle).toBe('primary');
  });
});
