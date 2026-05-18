import type { ComponentProps } from 'react';
import AppKeyboardAwareScrollView from '@/components/ui/AppKeyboardAwareScrollView';

export type NegotiationStatus =
  | 'input'
  | 'processing'
  | 'success'
  | 'failed'
  | 'upload'
  | 'submitted';

type KeyboardAwareProps = Omit<
  ComponentProps<typeof AppKeyboardAwareScrollView>,
  'children'
>;

export interface NegotiationModalViewProps {
  attemptCount: number;
  counterOffer: number | null;
  currentPrice: number;
  keyboardAwareProps?: KeyboardAwareProps;
  message: string;
  onAcceptCounter: () => void;
  onBackFromUpload: () => void;
  onClose: () => void;
  onOpenUpload: () => void;
  onOfferChange: (value: string) => void;
  onPickImage: () => void;
  onSubmitOffer: (amount: number) => void;
  onSubmittedAction: () => void;
  onSuccessAction: () => void;
  onTryAgain: () => void;
  onUploadLinkChange: (value: string) => void;
  onUploadSubmit: () => void;
  offer: string;
  productName: string;
  status: NegotiationStatus;
  submittedActionLabel?: string;
  successActionLabel: string;
  successActionStyle?: 'primary' | 'neutral';
  uploadFile: string | null;
  uploadLink: string;
  visible: boolean;
}
