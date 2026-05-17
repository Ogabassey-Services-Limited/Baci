'use client';

// Migrated from temp-source/components/NegotiationModal.tsx
import { CheckCircle2, HandCoins, Loader2, Upload, X } from 'lucide-react';
import type React from 'react';
import { useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

interface NegotiationModalProps {
  isOpen: boolean;
  onClose: () => void;
  productName: string;
  currentPrice: number;
  onSuccess: (finalPrice: number) => void;
  type: 'single' | 'total';
  itemId?: string;
  merchantId: string;
}

type NegotiationStatus = 'input' | 'processing' | 'success' | 'failed' | 'upload' | 'submitted';

const SESSION_KEY = 'ogabassey_guest_session';
const AUTO_ACCEPT_DISCOUNT_THRESHOLD = 0.03;
const COUNTER_DISCOUNT_STEPS = [0.01, 0.02, 0.03] as const;
const AI_REVIEW_MESSAGE =
  'Your offer was accepted by our AI and is subject to human review.';

function getOrCreateSessionId(): string {
  if (typeof window === 'undefined') return `web-${Date.now()}`;
  const existing = window.sessionStorage.getItem(SESSION_KEY);
  if (existing) return existing;
  const id = `web-${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`}`;
  window.sessionStorage.setItem(SESSION_KEY, id);
  return id;
}

export const NegotiationModal: React.FC<NegotiationModalProps> = ({
  isOpen,
  onClose,
  productName,
  currentPrice,
  onSuccess,
  type,
  itemId,
  merchantId,
}) => {
  const [offer, setOffer] = useState('');
  const [status, setStatus] = useState<NegotiationStatus>('input');
  const [message, setMessage] = useState('');

  // Progressive Negotiation State
  const [attemptCount, setAttemptCount] = useState(0);
  const [counterOffer, setCounterOffer] = useState<number | null>(null);

  // Upload Evidence State
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadLink, setUploadLink] = useState('');
  const submitTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMountedRef = useRef(false);
  const isOpenRef = useRef(isOpen);

  const [supabase] = useState(() => createClient());

  const clearSubmitTimeout = () => {
    if (submitTimeoutRef.current) {
      clearTimeout(submitTimeoutRef.current);
      submitTimeoutRef.current = null;
    }
  };

  const canApplyAsyncResult = () => isMountedRef.current && isOpenRef.current;

  // Reset state when opened
  useEffect(() => {
    isOpenRef.current = isOpen;

    if (isOpen) {
      clearSubmitTimeout();
      setOffer('');
      setStatus('input');
      setMessage('');
      setAttemptCount(0);
      setCounterOffer(null);
      setUploadFile(null);
      setUploadLink('');
      return;
    }

    clearSubmitTimeout();
  }, [isOpen]);

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
      clearSubmitTimeout();
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
      const discountAmount = currentPrice - offerAmount;
      const maxAutoAcceptedDiscountAmount =
        currentPrice * AUTO_ACCEPT_DISCOUNT_THRESHOLD;

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
        COUNTER_DISCOUNT_STEPS.length - 1
      );
      const counterDiscount = COUNTER_DISCOUNT_STEPS[counterStepIndex];

      let replyMessage = "That's a bit low. But I can do:";
      if (counterStepIndex === 1) {
        replyMessage = "We're getting closer. The best I can do is:";
      }
      if (counterStepIndex === 2) {
        replyMessage = 'This is my absolute final offer:';
      }

      const proposedCounter = Math.floor(currentPrice * (1 - counterDiscount));

      // Update State
      setStatus('failed'); // 'failed' triggers the rejection UI, which we repurpose for counter-offer
      setCounterOffer(proposedCounter);
      setMessage(replyMessage);
      setAttemptCount((prev) => prev + 1);
    }, 1500);
  };

  const submitMerchantRequest = async (evidenceUrl?: string) => {
    if (!merchantId) {
      alert('Unable to submit request — merchant context unavailable.');
      return;
    }

    setStatus('processing');
    const offerAmount = Number.parseFloat(offer);

    try {
      // Get authenticated user if available (null for guests)
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError) {
        console.warn('Auth check failed, continuing as guest:', authError.message);
      }

      const { error } = await supabase
        .from('negotiation_requests')
        .insert({
          merchant_id: merchantId,
          session_id: getOrCreateSessionId(),
          customer_id: user?.id ?? null,
          type,
          item_info: type === 'single' ? {
            id: itemId,
            name: productName,
            current_price: currentPrice,
          } : null,
          offered_price: offerAmount,
          evidence_url: evidenceUrl || null,
          status: 'pending'
        });

      if (error) throw error;

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

      alert('Failed to submit request. Please try again.');
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
    submitMerchantRequest(uploadLink || 'uploaded_evidence_placeholder');
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center px-4">
      <div
        data-testid="modal-backdrop"
        className="absolute inset-0 bg-[hsl(var(--foreground))]/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        aria-labelledby="negotiation-modal-title"
        aria-modal="true"
        className="bg-[hsl(var(--card))] rounded-2xl shadow-2xl w-full max-w-sm relative overflow-hidden z-10 animate-in zoom-in-95 duration-200"
        role="dialog"
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
          <button
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
            <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">
              Current Price:{' '}
              <span className="text-[hsl(var(--card-foreground))] font-semibold">
                ₦{currentPrice.toLocaleString()}
              </span>
            </p>
          </div>

          {status === 'input' && (
            <form onSubmit={handleSubmit}>
              <label className="block text-sm font-medium text-[hsl(var(--card-foreground))] mb-2">
                Your Offer (₦)
              </label>
              <div className="relative mb-6">
                <input
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
                  autoFocus
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
                Reviewing your offer...
              </p>
              <p className="text-xs text-[hsl(var(--muted-foreground))]/80 mt-2">
                Checking with sales manager
              </p>
            </div>
          )}

          {status === 'success' && (
            <div className="flex flex-col items-center justify-center py-2 text-center animate-in fade-in slide-in-from-bottom-2">
              <div className="w-12 h-12 bg-[var(--store-primary)]/10 rounded-full flex items-center justify-center mb-3">
                <CheckCircle2 size={28} className="text-[var(--store-primary)]" />
              </div>
              <h4 className="text-xl font-bold text-[hsl(var(--card-foreground))] mb-1">Offer Accepted!</h4>
              <p className="text-sm text-[hsl(var(--muted-foreground))] mb-4">
                {message || 'Price has been updated in your cart.'}
              </p>
              <button
                onClick={onClose}
                className="bg-[hsl(var(--foreground))] text-[hsl(var(--background))] px-6 py-2 rounded-lg font-bold text-sm hover:opacity-90 transition-opacity"
              >
                Done
              </button>
            </div>
          )}

          {status === 'failed' && (
            <div className="flex flex-col items-center justify-center py-2 text-center animate-in shake duration-300">
              <div className="w-12 h-12 bg-[var(--store-primary)]/10 rounded-full flex items-center justify-center mb-3">
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
                  <button
                    onClick={handleAcceptCounter}
                    className="w-full bg-[var(--store-primary)] hover:bg-[var(--store-primary)]/90 text-[var(--store-primary-text)] font-bold py-3 rounded-xl transition-colors shadow-md flex items-center justify-center gap-2"
                  >
                    <CheckCircle2 size={18} />
                    Accept ₦{counterOffer.toLocaleString()}
                  </button>
                )}
                <button
                  onClick={() => setStatus('input')}
                  className="w-full bg-[hsl(var(--muted))] text-[hsl(var(--card-foreground))] font-bold py-3 rounded-xl hover:bg-[var(--store-primary)]/10 transition-colors"
                >
                  Negotiate Again
                </button>

                {/* I Saw It Cheaper - only after the final (3%) counter offer. */}
                {attemptCount >= COUNTER_DISCOUNT_STEPS.length && (
                  <button
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

          {/* Upload Evidence Form */}
          {status === 'upload' && (
            <form onSubmit={handleUploadSubmit} className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
              <div className="bg-[var(--store-primary)]/5 border border-[var(--store-primary)]/20 rounded-xl p-4">
                <p className="text-sm text-[hsl(var(--card-foreground))] font-medium mb-2">
                  📸 Saw it cheaper elsewhere?
                </p>
                <p className="text-xs text-[var(--store-primary)]">
                  Upload proof (screenshot, photo) and we'll try to match or beat that price!
                </p>
              </div>

              {/* File Upload */}
              <div>
                <label className="block text-sm font-medium text-[hsl(var(--card-foreground))] mb-2">
                  Upload Proof (Required)
                </label>
                <div className="relative">
                  <input
                    type="file"
                    accept="image/*"
                    aria-label="Upload proof"
                    onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                    className="w-full px-4 py-3 border border-[hsl(var(--border))] rounded-xl focus:ring-2 focus:ring-[var(--store-primary)] focus:border-[var(--store-primary)] outline-none transition-all text-sm text-[hsl(var(--card-foreground))] file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-[hsl(var(--muted))] file:text-[hsl(var(--card-foreground))] hover:file:bg-[var(--store-primary)]/10"
                    required
                  />
                </div>
                {uploadFile && (
                  <p className="text-xs text-[var(--store-primary)] mt-2 flex items-center gap-1">
                    <CheckCircle2 size={12} />
                    {uploadFile.name}
                  </p>
                )}
              </div>

              {/* Link (Optional) */}
              <div>
                <label className="block text-sm font-medium text-[hsl(var(--card-foreground))] mb-2">
                  Link (Optional)
                </label>
                <input
                  type="url"
                  value={uploadLink}
                  onChange={(e) => setUploadLink(e.target.value)}
                  placeholder="https://example.com/product"
                  className="w-full bg-[hsl(var(--card))] px-4 py-3 border border-[hsl(var(--border))] rounded-xl focus:ring-2 focus:ring-[var(--store-primary)] focus:border-[var(--store-primary)] outline-none transition-all text-sm text-[hsl(var(--card-foreground))]"
                />
              </div>

              {/* Buttons */}
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setStatus('failed')}
                  className="flex-1 bg-[hsl(var(--muted))] text-[hsl(var(--card-foreground))] font-bold py-3 rounded-xl hover:bg-[var(--store-primary)]/10 transition-colors"
                >
                  Back
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-[var(--store-primary)] hover:bg-[var(--store-primary)]/90 text-[var(--store-primary-text)] font-bold py-3 rounded-xl transition-colors shadow-md flex items-center justify-center gap-2"
                >
                  <Upload size={18} />
                  Send for Review
                </button>
              </div>
            </form>
          )}

          {status === 'submitted' && (
            <div className="flex flex-col items-center justify-center py-4 text-center">
              <div className="w-12 h-12 bg-[var(--store-primary)]/10 rounded-full flex items-center justify-center mb-3">
                <CheckCircle2 size={28} className="text-[var(--store-primary)]" />
              </div>
              <h4 className="text-lg font-bold text-[hsl(var(--card-foreground))] mb-1">Request Sent</h4>
              <p className="text-sm text-[hsl(var(--muted-foreground))] mb-6">{message}</p>
              <button
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
