import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { NegotiationStatusContent } from './NegotiationStatusContent';

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
  };
});

function createBaseProps() {
  return {
    attemptCount: 0,
    counterOffer: null,
    message: 'Request sent to merchant',
    onAcceptCounter: jest.fn(),
    onBackFromUpload: jest.fn(),
    onClose: jest.fn(),
    onOpenUpload: jest.fn(),
    onPickImage: jest.fn(),
    onSubmittedAction: jest.fn(),
    onSuccessAction: jest.fn(),
    onTryAgain: jest.fn(),
    onUploadLinkChange: jest.fn(),
    onPhoneChange: jest.fn(),
    onUploadSubmit: jest.fn(),
    phone: '',
    status: 'submitted' as const,
    successActionLabel: 'Done',
    uploadFile: null,
    uploadLink: '',
  };
}

describe('NegotiationStatusContent', () => {
  it('renders submitted confirmation and invokes the submitted action', () => {
    const onSubmittedAction = jest.fn();

    render(
      <NegotiationStatusContent
        {...createBaseProps()}
        onSubmittedAction={onSubmittedAction}
        submittedActionLabel="Close"
      />
    );

    fireEvent.press(screen.getByText('Close'));

    expect(screen.getByText('Request Sent')).toBeTruthy();
    expect(screen.getByText('Request sent to merchant')).toBeTruthy();
    expect(onSubmittedAction).toHaveBeenCalledTimes(1);
  });

  it('renders counter-offer actions when the cheaper proof threshold is reached', () => {
    const onAcceptCounter = jest.fn();
    const onOpenUpload = jest.fn();
    const onTryAgain = jest.fn();

    render(
      <NegotiationStatusContent
        {...createBaseProps()}
        attemptCount={2}
        counterOffer={470000}
        message="Counter available"
        onAcceptCounter={onAcceptCounter}
        onOpenUpload={onOpenUpload}
        onTryAgain={onTryAgain}
        status="failed"
      />
    );

    fireEvent.press(screen.getByText('Accept Offer'));
    fireEvent.press(screen.getByText('Negotiate Again'));
    fireEvent.press(screen.getByText('I saw it cheaper'));

    expect(screen.getByText('₦470,000')).toBeTruthy();
    expect(onAcceptCounter).toHaveBeenCalledTimes(1);
    expect(onTryAgain).toHaveBeenCalledTimes(1);
    expect(onOpenUpload).toHaveBeenCalledTimes(1);
  });

  it('renders the success state and invokes the success action', () => {
    const onSuccessAction = jest.fn();

    render(
      <NegotiationStatusContent
        {...createBaseProps()}
        status="success"
        message="New price: ₦450,000"
        successActionLabel="Apply to Cart"
        onSuccessAction={onSuccessAction}
      />
    );

    expect(screen.getByText('Offer Accepted!')).toBeTruthy();
    expect(screen.getByText('New price: ₦450,000')).toBeTruthy();
    fireEvent.press(screen.getByText('Apply to Cart'));
    expect(onSuccessAction).toHaveBeenCalledTimes(1);
  });

  it('renders a processing indicator while the offer is in flight', () => {
    render(
      <NegotiationStatusContent {...createBaseProps()} status="processing" />
    );

    expect(screen.getByText('Checking best deal…')).toBeTruthy();
  });
});
