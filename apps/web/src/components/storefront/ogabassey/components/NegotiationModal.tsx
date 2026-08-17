'use client';

// Migrated from temp-source/components/NegotiationModal.tsx
import {
  COUNTER_NEGOTIATION_DISCOUNT_STEPS,
  isProductNegotiable,
  MAX_AUTO_NEGOTIATION_DISCOUNT_RATE,
} from '@baci/shared/lib';
import { isAuthSessionMissingError } from '@supabase/supabase-js';
import { CheckCircle2, HandCoins, Loader2, Upload, X } from 'lucide-react';
import type React from 'react';
import { useEffect, useId, useRef, useState } from 'react';
import type { CartItem } from '@/hooks/cart';
import { createClient } from '@/lib/supabase/client';
import { uploadNegotiationEvidenceFile } from './negotiation-evidence';
import { computeCounterOffer } from './negotiation-modal-pricing';
import { insertNegotiationRequest } from './negotiation-modal-request';
import { NegotiationUploadForm } from './NegotiationUploadForm';
import {
  NegotiationValidationError,
  getContactValidationError,
} from './negotiation-modal-validation';

export { deriveCartLineNegotiationProps } from './negotiation-modal-cart';

interface NegotiationModalProps {
  isOpen: boolean;
  onClose: () => void;
  productName: string;
  productBrand?: string;
  currentPrice: number;
  vatRate?: number;
  onSuccess: (finalPrice: number) => void;
  type: 'single' | 'total';
  itemId?: string;
  merchantId: string;
  productSlug?: string;
  variantId?: string;
  variantName?: string;
  variantAttributes?: Record<string, string>;
  condition?: string;
  /** Cart lines to snapshot for whole-cart ("total") offers. */
  cart?: CartItem[];
}

type NegotiationStatus =
  | 'input'
  | 'processing'
  | 'success'
  | 'failed'
  | 'final'
  | 'upload'
  | 'submitted';

const AI_REVIEW_MESSAGE =
  'Your offer was accepted by our AI and is subject to human review.';
const FINAL_PRICE_MESSAGE =
  "That's the final price for this product. We can't discount it further.";

type NegotiationSupabaseClient = ReturnType<typeof createClient>;

async function resolveNegotiationCustomerId(
  supabase: NegotiationSupabaseClient
): Promise<string | null> {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error && (!isAuthSessionMissingError(error) || user)) {
    throw error;
  }

  return user?.id ?? null;
}

export const NegotiationModal: React.FC<NegotiationModalProps> = ({
  isOpen,
  onClose,
  productName,
  productBrand,
  currentPrice,
  vatRate = 0,
  onSuccess,
  type,
  itemId,
  merchantId,
  productSlug,
  variantId,
  variantName,
  variantAttributes,
  condition,
  cart,
}) => {
  const offerInputId = useId();
  const uploadFileInputId = useId();
  const uploadLinkInputId = useId();
  const emailInputId = useId();
  const phoneInputId = useId();
  const isNegotiableProduct = isProductNegotiable({
    brand: productBrand,
    name: productName,
  });
  const [offer, setOffer] = useState('');
  const [status, setStatus] = useState<NegotiationStatus>('input');
  const [message, setMessage] = useState('');

  // Progressive Negotiation State
  const [attemptCount, setAttemptCount] = useState(0);
  const [counterOffer, setCounterOffer] = useState<number | null>(null);

  // Upload Evidence State
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadLink, setUploadLink] = useState('');
  const [email, setEmail] = useState('');
  // Optional follow-up contact captured alongside the merchant-approval evidence.
  const [phone, setPhone] = useState('');
  const submitTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMountedRef = useRef(false);
  const isOpenRef = useRef(isOpen);
  const selectedVariantDetails = [
    variantName?.trim(),
    condition?.trim()
      ? `Condition: ${condition.trim().replace(/_/g, ' ')}`
      : null,
  ].filter(Boolean);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const offerInputRef = useRef<HTMLInputElement | null>(null);
  const previouslyFocusedElementRef = useRef<HTMLElement | null>(null);

  const [supabase] = useState(() => createClient());

  const clearSubmitTimeout = () => {
    if (submitTimeoutRef.current) {
      clearTimeout(submitTimeoutRef.current);
      submitTimeoutRef.current = null;
    }
  };

  const canApplyAsyncResult = () => isMountedRef.current && isOpenRef.current;

  const getFocusableElements = () => {
    if (!dialogRef.current) {
      return [] as HTMLElement[];
    }

    return Array.from(
      dialogRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      )
    );
  };

  // Reset state when opened — adjusted during render so users never see a
  // stale frame (https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes)
  const [prevIsOpen, setPrevIsOpen] = useState(isOpen);
  if (isOpen !== prevIsOpen) {
    setPrevIsOpen(isOpen);
    if (isOpen) {
      setOffer('');
      setStatus('input');
      setMessage('');
      setAttemptCount(0);
      setCounterOffer(null);
      setUploadFile(null);
      setUploadLink('');
      setEmail('');
      setPhone('');
    }
  }

  // Keep the open-state ref in sync and clear pending work on open/close.
  useEffect(() => {
    isOpenRef.current = isOpen;
    clearSubmitTimeout();
  }, [isOpen]);

  useEffect(() => {
    if (typeof document === 'undefined') {
      return;
    }

    if (!isOpen) {
      if (previouslyFocusedElementRef.current) {
        previouslyFocusedElementRef.current.focus();
        previouslyFocusedElementRef.current = null;
      }
      return;
    }

    previouslyFocusedElementRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || status !== 'input' || typeof window === 'undefined') {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      if (offerInputRef.current) {
        offerInputRef.current.focus();
        return;
      }

      const focusableElements = getFocusableElements();
      if (focusableElements.length > 0) {
        focusableElements[0].focus();
        return;
      }
      dialogRef.current?.focus();
    });

    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [isOpen, status]);

  useEffect(() => {
    if (!isOpen || typeof document === 'undefined') {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key !== 'Tab') {
        return;
      }

      const focusableElements = getFocusableElements();
      if (focusableElements.length === 0) {
        event.preventDefault();
        dialogRef.current?.focus();
        return;
      }

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];
      const activeElement =
        document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null;

      if (
        event.shiftKey &&
        (!activeElement ||
          !dialogRef.current?.contains(activeElement) ||
          activeElement === firstElement)
      ) {
        event.preventDefault();
        lastElement.focus();
        return;
      }

      if (
        !event.shiftKey &&
        (!activeElement ||
          !dialogRef.current?.contains(activeElement) ||
          activeElement === lastElement)
      ) {
        event.preventDefault();
        firstElement.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
      clearSubmitTimeout();
      if (previouslyFocusedElementRef.current) {
        previouslyFocusedElementRef.current.focus();
        previouslyFocusedElementRef.current = null;
      }
    };
  }, []);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!offer) return;

    const offerAmount = Number.parseFloat(offer);
    if (
      !Number.isFinite(offerAmount) ||
      offerAmount <= 0 ||
      offerAmount > currentPrice
    ) {
      setMessage(
        `Enter an offer between ₦1 and ₦${currentPrice.toLocaleString()}.`
      );
      return;
    }

    setMessage('');
    setStatus('processing');

    // Simulate AI thinking delay
    clearSubmitTimeout();
    submitTimeoutRef.current = setTimeout(() => {
      submitTimeoutRef.current = null;
      if (!canApplyAsyncResult()) {
        return;
      }

      const discountAmount = currentPrice - offerAmount;
      const maxAutoAcceptedDiscountAmount =
        currentPrice * MAX_AUTO_NEGOTIATION_DISCOUNT_RATE;

      if (discountAmount > Number.EPSILON && !isNegotiableProduct) {
        setCounterOffer(null);
        setMessage(FINAL_PRICE_MESSAGE);
        setStatus('final');
        return;
      }

      // Auto-accept offers within the current threshold.
      if (discountAmount <= maxAutoAcceptedDiscountAmount + Number.EPSILON) {
        setMessage(AI_REVIEW_MESSAGE);
        setStatus('success');
        onSuccess(offerAmount);
        return;
      }

      // Rejection Logic - Determine Counter Offer
      const counterStepIndex = Math.min(
        attemptCount,
        COUNTER_NEGOTIATION_DISCOUNT_STEPS.length - 1
      );
      const counterDiscount = COUNTER_NEGOTIATION_DISCOUNT_STEPS[counterStepIndex];

      let replyMessage = "That's a bit low. But I can do:";
      if (counterStepIndex === 1) {
        replyMessage = "We're getting closer. The best I can do is:";
      }
      if (counterStepIndex === 2) {
        replyMessage = 'This is my absolute final offer:';
      }

      const proposedCounter = computeCounterOffer(
        currentPrice,
        counterDiscount,
        vatRate
      );

      // Update State
      setStatus('failed'); // 'failed' triggers the rejection UI, which we repurpose for counter-offer
      setCounterOffer(proposedCounter);
      setMessage(replyMessage);
      setAttemptCount((prev) => prev + 1);
    }, 1500);
  };

  const submitMerchantRequest = async (
    evidenceUrl: string | undefined,
    customerId: string | null
  ) => {
    if (!merchantId) {
      alert('Unable to submit request — merchant context unavailable.');
      return;
    }

    setStatus('processing');
    const offerAmount = Number.parseFloat(offer);

    try {
      await insertNegotiationRequest(supabase, {
        merchantId,
        type,
        itemId,
        productSlug,
        productName,
        productBrand,
        currentPrice,
        offeredPrice: offerAmount,
        evidenceUrl,
        customerId,
        customerEmail: email,
        customerPhone: phone,
        variantId,
        variantName,
        variantAttributes,
        condition,
        cart,
      });

      if (!canApplyAsyncResult()) {
        return;
      }

      setStatus('submitted');
      setMessage("Request submitted! We'll notify you as soon as the merchant reviews your offer.");
    } catch (error) {
      console.error('Failed to submit request:', error);
      if (!canApplyAsyncResult()) {
        return;
      }

      alert(
        error instanceof NegotiationValidationError
          ? error.message
          : 'Failed to submit request. Please try again.'
      );
      setStatus('upload');
    }
  };

  const handleAcceptCounter = () => {
    if (counterOffer) {
      setMessage(AI_REVIEW_MESSAGE);
      setStatus('success');
      onSuccess(counterOffer);
    }
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedLink = uploadLink.trim();
    if (trimmedLink && uploadFile) {
      alert('Use either a proof upload or a link, not both.');
      return;
    }

    if (!trimmedLink && !uploadFile) {
      alert('Upload proof or paste a link before sending your request.');
      return;
    }

    let customerId: string | null;
    try {
      customerId = await resolveNegotiationCustomerId(supabase);
    } catch (error) {
      console.error('Failed to verify negotiation customer:', error);
      alert('Unable to verify your account. Please try again.');
      return;
    }

    const contactValidationError = getContactValidationError({
      email,
      isAuthenticated: Boolean(customerId),
      phone,
    });
    if (contactValidationError) {
      alert(contactValidationError);
      return;
    }

    if (trimmedLink) {
      await submitMerchantRequest(trimmedLink, customerId);
      return;
    }

    const file = uploadFile;
    if (!file) {
      alert('Upload proof or paste a link before sending your request.');
      return;
    }

    if (!merchantId) {
      alert('Unable to submit request — merchant context unavailable.');
      return;
    }

    setStatus('processing');
    try {
      const evidencePath = await uploadNegotiationEvidenceFile({
        file,
        merchantId,
      });
      await submitMerchantRequest(evidencePath, customerId);
    } catch (error) {
      console.error('Failed to upload evidence:', error);
      if (!canApplyAsyncResult()) {
        return;
      }

      alert(
        error instanceof Error
          ? error.message
          : 'Unable to upload evidence image. Please try again.'
      );
      setStatus('upload');
    }
  };

  return (
    <div className="fixed inset-0 z-70 flex items-center justify-center px-4">
      <button
        type="button"
        aria-label="Dismiss negotiation modal backdrop"
        tabIndex={-1}
        data-testid="modal-backdrop"
        className="absolute inset-0 border-0 bg-[hsl(var(--foreground))]/60 p-0 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        aria-labelledby="negotiation-modal-title"
        aria-modal="true"
        className="bg-[hsl(var(--card))] rounded-2xl shadow-2xl w-full max-w-sm relative overflow-hidden z-10 animate-in zoom-in-95 duration-200"
        role="dialog"
        ref={dialogRef}
        tabIndex={-1}
      >
        {/* Header */}
        <div className="bg-[hsl(var(--foreground))] p-4 flex justify-between items-center">
          <div className="flex items-center gap-2 text-[hsl(var(--background))]">
            <HandCoins size={20} className="text-[var(--store-primary)]" />
            <h3
              id="negotiation-modal-title"
              className="font-bold text-sm uppercase tracking-wider"
            >
              Negotiate Price
            </h3>
          </div>
          <button type="button"
            onClick={onClose}
            className="text-[hsl(var(--background))]/70 hover:text-[hsl(var(--background))]"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          <div className="mb-6">
            <span className="text-xs text-[hsl(var(--muted-foreground))] uppercase tracking-wide">
              Product
            </span>
            <p className="font-bold text-[hsl(var(--card-foreground))] line-clamp-1">
              {productName}
            </p>
            {selectedVariantDetails.length > 0 ? (
              <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1">
                {selectedVariantDetails.join(' · ')}
              </p>
            ) : null}
            <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">
              Current Price:{' '}
              <span className="text-[hsl(var(--card-foreground))] font-semibold">
                ₦{currentPrice.toLocaleString()}
              </span>
            </p>
          </div>

          {status === 'input' && (
            <form onSubmit={handleSubmit}>
              <label
                htmlFor={offerInputId}
                className="block text-sm font-medium text-[hsl(var(--card-foreground))] mb-2"
              >
                Your Offer (₦)
              </label>
              <div className="relative mb-6">
                <input
                  id={offerInputId}
                  ref={offerInputRef}
                  type="number"
                  value={offer}
                  onChange={(e) => {
                    setOffer(e.target.value);
                    if (message) {
                      setMessage('');
                    }
                  }}
                  className="w-full bg-[hsl(var(--card))] pl-4 pr-4 py-3 border border-[hsl(var(--border))] rounded-xl focus:ring-2 focus:ring-[var(--store-primary)] focus:border-[var(--store-primary)] outline-none transition-all text-lg font-bold text-[hsl(var(--card-foreground))] placeholder:font-normal"
                  placeholder="Enter amount..."
                />
              </div>
              {message ? (
                <p role="alert" className="mb-4 text-sm text-[hsl(var(--destructive))]">
                  {message}
                </p>
              ) : null}
              <button
                type="submit"
                className="w-full bg-[var(--store-primary)] hover:bg-[var(--store-primary)]/90 text-[var(--store-primary-text)] font-bold py-3 rounded-xl transition-all shadow-md"
              >
                Submit Offer
              </button>
            </form>
          )}

          {status === 'processing' && (
            <div className="flex flex-col items-center justify-center py-4">
              <Loader2 size={40} className="text-[var(--store-primary)] animate-spin mb-4" />
              <p className="font-medium text-[hsl(var(--muted-foreground))]">
                Reviewing your offer…
              </p>
              <p className="text-xs text-[hsl(var(--muted-foreground))]/80 mt-2">
                Checking with sales manager
              </p>
            </div>
          )}

          {status === 'success' && (
            <div className="flex flex-col items-center justify-center py-2 text-center animate-in fade-in slide-in-from-bottom-2">
              <div className="size-12 bg-[var(--store-primary)]/10 rounded-full flex items-center justify-center mb-3">
                <CheckCircle2 size={28} className="text-[var(--store-primary)]" />
              </div>
              <h4 className="text-xl font-bold text-[hsl(var(--card-foreground))] mb-1">Offer Accepted!</h4>
              <p className="text-sm text-[hsl(var(--muted-foreground))] mb-4">
                {message || 'Price has been updated in your cart.'}
              </p>
              <button type="button"
                onClick={onClose}
                className="bg-[hsl(var(--foreground))] text-[hsl(var(--background))] px-6 py-2 rounded-lg font-bold text-sm hover:opacity-90 transition-opacity"
              >
                Done
              </button>
            </div>
          )}

          {status === 'failed' && (
            <div className="flex flex-col items-center justify-center py-2 text-center animate-in shake duration-300">
              <div className="size-12 bg-[var(--store-primary)]/10 rounded-full flex items-center justify-center mb-3">
                <HandCoins size={28} className="text-[var(--store-primary)]" />
              </div>
              <h4 className="text-lg font-bold text-[hsl(var(--card-foreground))] mb-1">
                Counter Offer
              </h4>
              <p className="text-sm text-[hsl(var(--muted-foreground))] mb-2">{message}</p>

              {counterOffer && (
                <div className="text-2xl font-bold text-[hsl(var(--card-foreground))] mb-6 bg-[hsl(var(--muted))] px-4 py-2 rounded-lg border border-[hsl(var(--border))]">
                  ₦{counterOffer.toLocaleString()}
                </div>
              )}

              <div className="flex flex-col w-full gap-2">
                {counterOffer && (
                  <button type="button"
                    onClick={handleAcceptCounter}
                    className="w-full bg-[var(--store-primary)] hover:bg-[var(--store-primary)]/90 text-[var(--store-primary-text)] font-bold py-3 rounded-xl transition-colors shadow-md flex items-center justify-center gap-2"
                  >
                    <CheckCircle2 size={18} />
                    Accept ₦{counterOffer.toLocaleString()}
                  </button>
                )}
                <button type="button"
                  onClick={() => {
                    setMessage('');
                    setStatus('input');
                  }}
                  className="w-full bg-[hsl(var(--muted))] text-[hsl(var(--card-foreground))] font-bold py-3 rounded-xl hover:bg-[var(--store-primary)]/10 transition-colors"
                >
                  Negotiate Again
                </button>

                {/* I Saw It Cheaper - only after the final counter offer. */}
                {attemptCount >= COUNTER_NEGOTIATION_DISCOUNT_STEPS.length && (
                  <button type="button"
                    onClick={() => setStatus('upload')}
                    className="w-full bg-[var(--store-primary)]/5 text-[var(--store-primary)] font-bold py-3 rounded-xl hover:bg-[var(--store-primary)]/10 transition-colors border border-[var(--store-primary)]/20 flex items-center justify-center gap-2"
                  >
                    <Upload size={18} />
                    I Saw It Cheaper
                  </button>
                )}
              </div>
            </div>
          )}

          {status === 'final' && (
            <div className="flex flex-col items-center justify-center py-2 text-center animate-in fade-in slide-in-from-bottom-2">
              <div className="size-12 bg-[var(--store-primary)]/10 rounded-full flex items-center justify-center mb-3">
                <HandCoins size={28} className="text-[var(--store-primary)]" />
              </div>
              <h4 className="text-lg font-bold text-[hsl(var(--card-foreground))] mb-1">
                Final Price
              </h4>
              <p className="text-sm text-[hsl(var(--muted-foreground))] mb-6">{message}</p>
              <button type="button"
                onClick={onClose}
                className="bg-[hsl(var(--foreground))] text-[hsl(var(--background))] px-8 py-2 rounded-xl font-bold text-sm hover:opacity-90 transition-opacity"
              >
                Got it
              </button>
            </div>
          )}

          {status === 'upload' && (
            <NegotiationUploadForm
              email={email}
              emailInputId={emailInputId}
              onBack={() => setStatus('failed')}
              onEmailChange={setEmail}
              onFileChange={setUploadFile}
              onLinkChange={setUploadLink}
              onPhoneChange={setPhone}
              onSubmit={handleUploadSubmit}
              phone={phone}
              phoneInputId={phoneInputId}
              uploadFile={uploadFile}
              uploadFileInputId={uploadFileInputId}
              uploadLink={uploadLink}
              uploadLinkInputId={uploadLinkInputId}
            />
          )}

          {status === 'submitted' && (
            <div className="flex flex-col items-center justify-center py-4 text-center">
              <div className="size-12 bg-[var(--store-primary)]/10 rounded-full flex items-center justify-center mb-3">
                <CheckCircle2 size={28} className="text-[var(--store-primary)]" />
              </div>
              <h4 className="text-lg font-bold text-[hsl(var(--card-foreground))] mb-1">Request Sent</h4>
              <p className="text-sm text-[hsl(var(--muted-foreground))] mb-6">{message}</p>
              <button type="button"
                onClick={onClose}
                className="bg-[hsl(var(--foreground))] text-[hsl(var(--background))] px-8 py-2 rounded-xl font-bold text-sm hover:opacity-90 transition-opacity"
              >
                Got it
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
