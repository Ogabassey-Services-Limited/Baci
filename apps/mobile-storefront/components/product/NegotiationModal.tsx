import { NegotiationModalView } from '@/components/negotiation/NegotiationModalView';
import { useNegotiationModalController } from '@/components/negotiation/useNegotiationModalController';
import { formatPrice } from '@/stores/cart-store';

interface NegotiationModalProps {
  visible: boolean;
  onClose: () => void;
  productId: string;
  merchantId: string;
  productName: string;
  currentPrice: number;
  onSuccess: (negotiatedPrice: number) => void;
  type?: 'single' | 'total';
  itemId?: string;
}

export function NegotiationModal({
  visible,
  onClose,
  productId,
  merchantId,
  productName,
  currentPrice,
  onSuccess,
  type = 'single',
  itemId,
}: NegotiationModalProps) {
  const {
    attemptCount,
    backFromUpload,
    counterOffer,
    handleAcceptCounter,
    handleSubmitOffer,
    handleUploadSubmit,
    message,
    offer,
    openUpload,
    pickImage,
    resetToInput,
    setOffer,
    setUploadLink,
    status,
    uploadFile,
    uploadLink,
  } = useNegotiationModalController({
    currentPrice,
    itemInfo:
      type === 'single'
        ? {
            currentPrice,
            id: itemId || productId,
            name: productName,
          }
        : null,
    merchantId,
    onAcceptedPrice: onSuccess,
    successMessageFormatter: (price) => `Price updated: ${formatPrice(price)}`,
    type,
    visible,
  });

  return (
    <NegotiationModalView
      visible={visible}
      status={status}
      productName={productName}
      currentPrice={currentPrice}
      offer={offer}
      onOfferChange={setOffer}
      message={message}
      counterOffer={counterOffer}
      attemptCount={attemptCount}
      uploadFile={uploadFile}
      uploadLink={uploadLink}
      onUploadLinkChange={setUploadLink}
      onClose={onClose}
      onSubmitOffer={handleSubmitOffer}
      onAcceptCounter={handleAcceptCounter}
      onTryAgain={resetToInput}
      onOpenUpload={openUpload}
      onPickImage={pickImage}
      onBackFromUpload={backFromUpload}
      onUploadSubmit={handleUploadSubmit}
      onSuccessAction={onClose}
      successActionLabel="Done"
      successActionStyle="neutral"
      onSubmittedAction={onClose}
    />
  );
}
