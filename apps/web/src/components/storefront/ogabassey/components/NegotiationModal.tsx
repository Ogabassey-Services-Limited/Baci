'use client';

// Migrated from temp-source/components/NegotiationModal.tsx
import { CheckCircle2, HandCoins, Loader2, Upload, X } from 'lucide-react';
import type React from 'react';
import { useEffect, useState } from 'react';
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

  const supabase = createClient();

  // Reset state when opened
  useEffect(() => {
    if (isOpen) {
      setOffer('');
      setStatus('input');
      setMessage('');
      setAttemptCount(0);
      setCounterOffer(null);
      setUploadFile(null);
      setUploadLink('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!offer) return;

    setStatus('processing');
    const offerAmount = Number.parseFloat(offer);

    // Simulate AI thinking delay
    setTimeout(() => {
      const discountPercentage = 1 - offerAmount / currentPrice;

      // 5% Hard Floor
      if (discountPercentage <= 0.05) {
        setStatus('success');
        onSuccess(offerAmount);
        return;
      }

      // Rejection Logic - Determine Counter Offer
      let counterDiscount = 0;
      let replyMessage = "";

      if (attemptCount === 0) {
        // First Try: Counter with 2% off
        counterDiscount = 0.02;
        replyMessage = "That's a bit low. But I can do:";
      } else if (attemptCount === 1) {
        // Second Try: Counter with 4% off
        counterDiscount = 0.04;
        replyMessage = "We're getting closer. The best I can do is:";
      } else {
        // Third+ Try: Counter with Floor (5% off)
        counterDiscount = 0.05;
        replyMessage = "This is my absolute final offer:";
      }

      const proposedCounter = Math.floor(currentPrice * (1 - counterDiscount));

      if (attemptCount >= 2) {
        setStatus('upload');
        setMessage("You're looking for a serious discount! Upload evidence of a lower price elsewhere and a merchant will review your request.");
      } else {
        // Update State
        setStatus('failed'); // 'failed' triggers the rejection UI, which we repurpose for counter-offer
        setCounterOffer(proposedCounter);
        setMessage(replyMessage);
        setAttemptCount(prev => prev + 1);
      }
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

      setStatus('submitted');
      setMessage("Request submitted! We'll notify you as soon as the merchant reviews your offer.");
    } catch (error) {
      console.error('Failed to submit request:', error);
      alert('Failed to submit request. Please try again.');
      setStatus('upload');
    }
  };

  const handleAcceptCounter = () => {
    if (counterOffer) {
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
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm relative overflow-hidden z-10 animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="bg-[#1a1a1a] p-4 flex justify-between items-center">
          <div className="flex items-center gap-2 text-white">
            <HandCoins size={20} className="text-red-600" />
            <h3 className="font-bold text-sm uppercase tracking-wider">
              Negotiate Price
            </h3>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white" aria-label="Close">
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          <div className="mb-6">
            <span className="text-xs text-gray-500 uppercase tracking-wide">
              Product
            </span>
            <p className="font-bold text-gray-900 line-clamp-1">
              {productName}
            </p>
            <p className="text-sm text-gray-500 mt-1">
              Current Price:{' '}
              <span className="text-gray-900 font-semibold">
                ₦{currentPrice.toLocaleString()}
              </span>
            </p>
          </div>

          {status === 'input' && (
            <form onSubmit={handleSubmit}>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Your Offer (₦)
              </label>
              <div className="relative mb-6">
                <input
                  type="number"
                  value={offer}
                  onChange={(e) => setOffer(e.target.value)}
                  className="w-full bg-white pl-4 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-600 focus:border-red-600 outline-none transition-all text-lg font-bold text-gray-900 placeholder:font-normal"
                  placeholder="Enter amount..."
                  autoFocus
                />
              </div>
              <button
                type="submit"
                className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3 rounded-xl transition-all shadow-md"
              >
                Submit Offer
              </button>
            </form>
          )}

          {status === 'processing' && (
            <div className="flex flex-col items-center justify-center py-4">
              <Loader2 size={40} className="text-red-600 animate-spin mb-4" />
              <p className="font-medium text-gray-600">
                Reviewing your offer...
              </p>
              <p className="text-xs text-gray-400 mt-2">
                Checking with sales manager
              </p>
            </div>
          )}

          {status === 'success' && (
            <div className="flex flex-col items-center justify-center py-2 text-center animate-in fade-in slide-in-from-bottom-2">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mb-3">
                <CheckCircle2 size={28} className="text-green-600" />
              </div>
              <h4 className="text-xl font-bold text-gray-900 mb-1">
                {message || 'Offer Accepted!'}
              </h4>
              <p className="text-sm text-gray-500 mb-4">
                {message ? '' : 'Price has been updated in your cart.'}
              </p>
              {!message && (
                <button
                  onClick={onClose}
                  className="bg-gray-900 text-white px-6 py-2 rounded-lg font-bold text-sm hover:bg-black transition-colors"
                >
                  Done
                </button>
              )}
            </div>
          )}

          {status === 'failed' && (
            <div className="flex flex-col items-center justify-center py-2 text-center animate-in shake duration-300">
              <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center mb-3">
                <HandCoins size={28} className="text-amber-600" />
              </div>
              <h4 className="text-lg font-bold text-gray-900 mb-1">
                Counter Offer
              </h4>
              <p className="text-sm text-gray-500 mb-2">{message}</p>

              {counterOffer && (
                <div className="text-2xl font-bold text-gray-900 mb-6 bg-gray-50 px-4 py-2 rounded-lg border border-gray-100">
                  ₦{counterOffer.toLocaleString()}
                </div>
              )}

              <div className="flex flex-col w-full gap-2">
                {counterOffer && (
                  <button
                    onClick={handleAcceptCounter}
                    className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded-xl transition-colors shadow-md flex items-center justify-center gap-2"
                  >
                    <CheckCircle2 size={18} />
                    Accept ₦{counterOffer.toLocaleString()}
                  </button>
                )}
                <button
                  onClick={() => setStatus('input')}
                  className="w-full bg-gray-100 text-gray-900 font-bold py-3 rounded-xl hover:bg-gray-200 transition-colors"
                >
                  Negotiate Again
                </button>

                {/* I Saw It Cheaper - Only show on final counter offer (attempt >= 2) */}
                {attemptCount >= 2 && (
                  <button
                    onClick={() => setStatus('upload')}
                    className="w-full bg-blue-50 text-blue-700 font-bold py-3 rounded-xl hover:bg-blue-100 transition-colors border border-blue-200 flex items-center justify-center gap-2"
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
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                <p className="text-sm text-blue-900 font-medium mb-2">
                  📸 Saw it cheaper elsewhere?
                </p>
                <p className="text-xs text-blue-700">
                  Upload proof (screenshot, photo) and we'll try to match or beat that price!
                </p>
              </div>

              {/* File Upload */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Upload Proof (Required)
                </label>
                <div className="relative">
                  <input
                    type="file"
                    accept="image/*"
                    aria-label="Upload proof"
                    onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-600 focus:border-blue-600 outline-none transition-all text-sm file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                    required
                  />
                </div>
                {uploadFile && (
                  <p className="text-xs text-green-600 mt-2 flex items-center gap-1">
                    <CheckCircle2 size={12} />
                    {uploadFile.name}
                  </p>
                )}
              </div>

              {/* Link (Optional) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Link (Optional)
                </label>
                <input
                  type="url"
                  value={uploadLink}
                  onChange={(e) => setUploadLink(e.target.value)}
                  placeholder="https://example.com/product"
                  className="w-full bg-white px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-600 focus:border-blue-600 outline-none transition-all text-sm"
                />
              </div>

              {/* Buttons */}
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setStatus('failed')}
                  className="flex-1 bg-gray-100 text-gray-700 font-bold py-3 rounded-xl hover:bg-gray-200 transition-colors"
                >
                  Back
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl transition-colors shadow-md flex items-center justify-center gap-2"
                >
                  <Upload size={18} />
                  Send for Review
                </button>
              </div>
            </form>
          )}

          {status === 'submitted' && (
            <div className="flex flex-col items-center justify-center py-4 text-center">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mb-3">
                <CheckCircle2 size={28} className="text-green-600" />
              </div>
              <h4 className="text-lg font-bold text-gray-900 mb-1">Request Sent</h4>
              <p className="text-sm text-gray-500 mb-6">{message}</p>
              <button
                onClick={onClose}
                className="bg-gray-900 text-white px-8 py-2 rounded-xl font-bold text-sm hover:bg-black transition-colors"
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
