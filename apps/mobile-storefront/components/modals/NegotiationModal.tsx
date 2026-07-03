import { isProductNegotiable } from '@baci/shared/lib';
import type React from 'react';
import { useShallow } from 'zustand/react/shallow';
import { NegotiationModalView } from '@/components/negotiation/NegotiationModalView';
import { useNegotiationModalController } from '@/components/negotiation/useNegotiationModalController';
import { useAuthStore } from '@/stores/auth-store';
import { formatPrice, useCartStore } from '@/stores/cart-store';
import { useUIStore } from '@/stores/ui-store';

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
  const customerPhone = useAuthStore((state) => state.customer?.phone);

  const applyNegotiatedPrice = useCartStore(
    (state) => state.applyNegotiatedPrice
  );
  const applyCartWideNegotiation = useCartStore(
    (state) => state.applyCartWideNegotiation
  );
  // Live cart lines, snapshotted into the request for whole-cart ("total")
  // offers so the merchant can see which items the offer covers.
  const cartItems = useCartStore((state) => state.items);

  const type = negotiationContext?.type ?? 'single';
  const itemId = negotiationContext?.itemId ?? null;
  const productName = negotiationContext?.productName ?? '';
  const currentPrice = negotiationContext?.currentPrice ?? 0;
  const productBrand = negotiationContext?.brand;
  const isNegotiable =
    negotiationContext?.isNegotiable ??
    isProductNegotiable({ brand: productBrand, name: productName });

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
    phone,
    pickImage,
    resetToInput,
    setOffer,
    setPhone,
    setUploadLink,
    status,
    uploadFile,
    uploadLink,
  } = useNegotiationModalController({
    currentPrice,
    isNegotiable,
    itemInfo:
      type === 'single' && negotiationContext
        ? {
            currentPrice,
            id: itemId ?? undefined,
            name: productName,
            productSlug: negotiationContext.productSlug,
            brand: productBrand,
            variantId: negotiationContext.variantId,
            variantName: negotiationContext.variantName,
            variantAttributes: negotiationContext.variantAttributes,
            condition: negotiationContext.condition,
          }
        : null,
    merchantId,
    successMessageFormatter: (price) => `New price: ${formatPrice(price)}`,
    type,
    visible: isNegotiationModalOpen && Boolean(negotiationContext),
    cartItems,
    prefillPhone: customerPhone,
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
      phone={phone}
      onUploadLinkChange={setUploadLink}
      onPhoneChange={setPhone}
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
