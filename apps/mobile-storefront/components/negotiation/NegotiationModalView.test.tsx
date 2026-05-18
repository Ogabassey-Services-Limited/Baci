import { Alert } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import type React from 'react';
import {
  NegotiationModalView,
  type NegotiationModalViewProps,
} from './NegotiationModalView';

const mockKeyboardAwareScrollViewSpy = jest.fn();

jest.mock('react-native-reanimated', () => {
  const { View } =
    jest.requireActual<typeof import('react-native')>('react-native');

  return {
    __esModule: true,
    default: { View },
    View,
    FadeIn: {
      duration: () => ({}),
    },
    FadeInDown: {
      duration: () => ({
        springify: () => ({}),
      }),
    },
    FadeOut: {
      duration: () => ({}),
    },
  };
});

jest.mock('@/components/ui/AppKeyboardAwareScrollView', () => {
  const { View } =
    jest.requireActual<typeof import('react-native')>('react-native');

  return function MockAppKeyboardAwareScrollView(props: {
    children?: React.ReactNode;
  }) {
    mockKeyboardAwareScrollViewSpy(props);
    return <View>{props.children}</View>;
  };
});

function createBaseProps(
  overrides?: Partial<NegotiationModalViewProps>
): NegotiationModalViewProps {
  return {
    attemptCount: 0,
    counterOffer: null,
    currentPrice: 500000,
    message: '',
    offer: '',
    onAcceptCounter: jest.fn(),
    onBackFromUpload: jest.fn(),
    onClose: jest.fn(),
    onOfferChange: jest.fn(),
    onOpenUpload: jest.fn(),
    onPickImage: jest.fn(),
    onSubmitOffer: jest.fn(),
    onSubmittedAction: jest.fn(),
    onSuccessAction: jest.fn(),
    onTryAgain: jest.fn(),
    onUploadLinkChange: jest.fn(),
    onUploadSubmit: jest.fn(),
    productName: 'iPhone 11 Pro Max',
    status: 'input',
    successActionLabel: 'Done',
    uploadFile: null,
    uploadLink: '',
    visible: true,
    ...overrides,
  };
}

describe('NegotiationModalView', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the negotiation input form', () => {
    render(<NegotiationModalView {...createBaseProps()} />);

    expect(screen.getByText('NEGOTIATE PRICE')).toBeTruthy();
    expect(screen.getByText('Your Offer (₦)')).toBeTruthy();
    expect(screen.getByText('Submit Offer')).toBeTruthy();
  });

  it('blocks invalid numeric offers and shows validation alert', () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(jest.fn());
    const onSubmitOffer = jest.fn();

    render(
      <NegotiationModalView
        {...createBaseProps({ offer: 'abc', onSubmitOffer })}
      />
    );

    fireEvent.press(screen.getByText('Submit Offer'));

    expect(alertSpy).toHaveBeenCalledWith(
      'Invalid Offer',
      'Please enter a valid price.'
    );
    expect(onSubmitOffer).not.toHaveBeenCalled();
  });

  it('blocks offers that are not lower than current price', () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(jest.fn());
    const onSubmitOffer = jest.fn();

    render(
      <NegotiationModalView
        {...createBaseProps({ offer: '500000', onSubmitOffer })}
      />
    );

    fireEvent.press(screen.getByText('Submit Offer'));

    expect(alertSpy).toHaveBeenCalledWith(
      'Invalid Offer',
      'Negotiated price must be lower than the current price.'
    );
    expect(onSubmitOffer).not.toHaveBeenCalled();
  });

  it('submits valid offers with parsed numeric payload', () => {
    const onSubmitOffer = jest.fn();

    render(
      <NegotiationModalView
        {...createBaseProps({ offer: '₦470,000', onSubmitOffer })}
      />
    );

    fireEvent.press(screen.getByText('Submit Offer'));

    expect(onSubmitOffer).toHaveBeenCalledWith(470000);
  });

  it('rejects offers with multiple decimal points', () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(jest.fn());
    const onSubmitOffer = jest.fn();

    render(
      <NegotiationModalView
        {...createBaseProps({ offer: '12.34.56', onSubmitOffer })}
      />
    );

    fireEvent.press(screen.getByText('Submit Offer'));

    expect(alertSpy).toHaveBeenCalledWith(
      'Invalid Offer',
      'Please enter a valid price.'
    );
    expect(onSubmitOffer).not.toHaveBeenCalled();
  });

  it('forwards keyboard-aware scroll props', () => {
    render(
      <NegotiationModalView
        {...createBaseProps({
          keyboardAwareProps: {
            keyboardShouldPersistTaps: 'always',
            testID: 'negotiation-scroll',
          },
        })}
      />
    );

    expect(mockKeyboardAwareScrollViewSpy).toHaveBeenCalled();
    const latestCall =
      mockKeyboardAwareScrollViewSpy.mock.calls[
        mockKeyboardAwareScrollViewSpy.mock.calls.length - 1
      ]?.[0];
    expect(latestCall).toEqual(
      expect.objectContaining({
        keyboardShouldPersistTaps: 'always',
        testID: 'negotiation-scroll',
      })
    );
  });

  it('renders processing state', () => {
    render(
      <NegotiationModalView
        {...createBaseProps({
          status: 'processing',
        })}
      />
    );

    expect(screen.getByText('Checking best deal...')).toBeTruthy();
  });

  it('renders success state and triggers success callback', () => {
    const onSuccessAction = jest.fn();

    render(
      <NegotiationModalView
        {...createBaseProps({
          status: 'success',
          message: 'Accepted',
          onSuccessAction,
          successActionLabel: 'Apply to Cart',
        })}
      />
    );

    fireEvent.press(screen.getByText('Apply to Cart'));

    expect(screen.getByText('Offer Accepted!')).toBeTruthy();
    expect(screen.getByText('Accepted')).toBeTruthy();
    expect(onSuccessAction).toHaveBeenCalledTimes(1);
  });

  it('renders failed state and triggers callbacks', () => {
    const onAcceptCounter = jest.fn();
    const onTryAgain = jest.fn();
    const onOpenUpload = jest.fn();

    render(
      <NegotiationModalView
        {...createBaseProps({
          attemptCount: 2,
          counterOffer: 470000,
          message: 'Counter available',
          onAcceptCounter,
          onOpenUpload,
          onTryAgain,
          status: 'failed',
        })}
      />
    );

    fireEvent.press(screen.getByText('Accept Offer'));
    fireEvent.press(screen.getByText('Negotiate Again'));
    fireEvent.press(screen.getByText('I saw it cheaper'));

    expect(screen.getByText('Counter Offer')).toBeTruthy();
    expect(screen.getByText('Counter available')).toBeTruthy();
    expect(onAcceptCounter).toHaveBeenCalledTimes(1);
    expect(onTryAgain).toHaveBeenCalledTimes(1);
    expect(onOpenUpload).toHaveBeenCalledTimes(1);
  });

  it('renders upload state and triggers upload callbacks', () => {
    const onPickImage = jest.fn();
    const onBackFromUpload = jest.fn();
    const onUploadSubmit = jest.fn();
    const onUploadLinkChange = jest.fn();

    render(
      <NegotiationModalView
        {...createBaseProps({
          message: 'Upload evidence',
          onBackFromUpload,
          onPickImage,
          onUploadLinkChange,
          onUploadSubmit,
          status: 'upload',
        })}
      />
    );

    fireEvent.press(screen.getByText('Upload Photo'));
    fireEvent.changeText(
      screen.getByPlaceholderText('Paste competitor product URL'),
      'https://example.com/offer'
    );
    fireEvent.press(screen.getByText('Back'));
    fireEvent.press(screen.getByText('Send for Review'));

    expect(screen.getByText('Share proof of a lower price')).toBeTruthy();
    expect(onPickImage).toHaveBeenCalledTimes(1);
    expect(onUploadLinkChange).toHaveBeenCalledWith('https://example.com/offer');
    expect(onBackFromUpload).toHaveBeenCalledTimes(1);
    expect(onUploadSubmit).toHaveBeenCalledTimes(1);
  });

  it('renders submitted state and triggers final action callback', () => {
    const onSubmittedAction = jest.fn();

    render(
      <NegotiationModalView
        {...createBaseProps({
          message: 'Request queued',
          onSubmittedAction,
          status: 'submitted',
          submittedActionLabel: 'Got it',
        })}
      />
    );

    fireEvent.press(screen.getByText('Got it'));

    expect(screen.getByText('Request Sent')).toBeTruthy();
    expect(screen.getByText('Request queued')).toBeTruthy();
    expect(onSubmittedAction).toHaveBeenCalledTimes(1);
  });
});
