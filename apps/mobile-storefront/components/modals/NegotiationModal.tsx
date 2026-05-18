import type React from 'react';
import { useShallow } from 'zustand/react/shallow';
import { NegotiationModalView } from '@/components/negotiation/NegotiationModalView';
import { useNegotiationModalController } from '@/components/negotiation/useNegotiationModalController';
import { formatPrice, useCartStore } from '@/stores/cart-store';
import { useUIStore } from '@/stores/ui-store';
import { useAuthStore } from '@/stores/auth-store';

export const NegotiationModal: React.FC = () => {
  const { isNegotiationModalOpen, negotiationContext, closeNegotiation } =
    useUIStore(
      useShallow((state) => ({
        isNegotiationModalOpen: state.isNegotiationModalOpen,
        negotiationContext: state.negotiationContext,
        closeNegotiation: state.closeNegotiation,
      }))
    );
  const merchantId = useAuthStore((state) => state.merchantId);

  const applyNegotiatedPrice = useCartStore(
    (state) => state.applyNegotiatedPrice
  );
  const applyCartWideNegotiation = useCartStore(
    (state) => state.applyCartWideNegotiation
  );

  const type = negotiationContext?.type ?? 'single';
  const itemId = negotiationContext?.itemId ?? null;
  const productName = negotiationContext?.productName ?? '';
  const currentPrice = negotiationContext?.currentPrice ?? 0;

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
      type === 'single' && negotiationContext
        ? {
            currentPrice,
            id: itemId,
            name: productName,
          }
        : null,
    merchantId,
    successMessageFormatter: (price) => `New price: ${formatPrice(price)}`,
    type,
    visible: isNegotiationModalOpen && Boolean(negotiationContext),
  });

  if (!isNegotiationModalOpen || !negotiationContext) return null;

  const handleApplyAndClose = () => {
    const finalPrice = Number.parseFloat(offer.replace(/[^0-9.]/g, ''));
    if (type === 'single' && itemId) {
      applyNegotiatedPrice(itemId, finalPrice);
    } else {
      applyCartWideNegotiation(finalPrice);
    }
    closeNegotiation();
  };

  return (
    <NegotiationModalView
      visible={isNegotiationModalOpen}
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
      onClose={closeNegotiation}
      onSubmitOffer={handleSubmitOffer}
      onAcceptCounter={handleAcceptCounter}
      onTryAgain={resetToInput}
      onOpenUpload={openUpload}
      onPickImage={pickImage}
      onBackFromUpload={backFromUpload}
      onUploadSubmit={handleUploadSubmit}
      onSuccessAction={handleApplyAndClose}
      successActionLabel="Apply to Cart"
      successActionStyle="primary"
      onSubmittedAction={closeNegotiation}
    />
  );
};
