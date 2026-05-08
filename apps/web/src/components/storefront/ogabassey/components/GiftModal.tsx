'use client';

import { Check, Gift, Info, MapPin, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import type React from 'react';
import { useEffect, useState } from 'react';
import { useCart } from '@/hooks/cart';
import { useMerchantSafe } from '@/hooks/use-merchant';
import { asRoute } from '@/lib/routes';

export interface GiftData {
  selectedItemIds: string[];
  address: string;
  senderType: 'anonymous' | 'named';
  senderName?: string;
  recipientName: string;
  recipientEmail: string;
  recipientPhone: string;
  message: string;
  wrapping: 'standard' | 'custom';
}

interface GiftModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const GiftModal: React.FC<GiftModalProps> = ({ isOpen, onClose }) => {
  const { cart } = useCart();
  const router = useRouter();
  const merchantContext = useMerchantSafe();
  const basePath = merchantContext?.basePath || '';
  const getHref = (path: string) => path.startsWith('http') ? path : `${basePath}${path}`;

  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
  const [address, setAddress] = useState('');
  const [senderType, setSenderType] = useState<'anonymous' | 'named' | null>(
    null
  );
  const [senderName, setSenderName] = useState('');
  const [recipientName, setRecipientName] = useState('');
  const [recipientEmail, setRecipientEmail] = useState('');
  const [recipientPhone, setRecipientPhone] = useState('');
  const [message, setMessage] = useState('');
  const [wrapping, setWrapping] = useState<'standard' | 'custom' | null>(null);

  // Initialize/Sync selected items when modal opens or cart changes
  useEffect(() => {
    if (isOpen) {
      setSelectedItemIds((prev) => {
        const currentCartIds = cart.map((i) => i.cartItemId);

        // Filter out any IDs that are no longer in the cart
        const validPrev = prev.filter((id) => currentCartIds.includes(id));

        // If selection is empty (first load or all previous selected items removed), select all
        // This provides a good default "Gift Order" experience
        if (validPrev.length === 0) {
          return currentCartIds;
        }
        return validPrev;
      });
    }
  }, [isOpen, cart]);

  if (!isOpen) return null;

  const toggleItemSelection = (id: string) => {
    setSelectedItemIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  // Validation Logic
  const isValid =
    selectedItemIds.length > 0 &&
    address.trim().length > 0 &&
    senderType !== null &&
    (senderType === 'anonymous' ||
      (senderType === 'named' && senderName.trim().length > 0)) &&
    recipientName.trim().length > 0 &&
    recipientEmail.trim().length > 0 &&
    recipientPhone.trim().length > 0 &&
    wrapping !== null;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) return;

    // TODO: Implement gift options saving
    // Gift data: {
    //   selectedItemIds,
    //   address,
    //   senderType,
    //   senderName (if named),
    //   recipientName,
    //   recipientEmail,
    //   recipientPhone,
    //   message,
    //   wrapping,
    //   wrappingCost: wrapping === 'standard' ? 10000 : 0,
    // }

    // Navigate to checkout with flag
    router.push(asRoute(getHref('/checkout?giftWrappingCost=10000')));
    onClose();
  };

  return (
    <div className="fixed inset-0 z-100 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-xs"
        onClick={onClose}
      />
      <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl relative z-10 flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50 rounded-t-2xl shrink-0">
          <h3 className="font-bold text-gray-900 flex items-center gap-2">
            <Gift className="text-red-600" size={20} /> Gift Personalization
          </h3>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded-full text-gray-500"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto">
          <form onSubmit={handleSave} className="space-y-6">
            {/* Product Selection (Only if > 1 item) */}
            {cart.length > 1 && (
              <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide mb-3 flex justify-between">
                  Select items to gift{' '}
                  <span className="text-red-600 text-lg leading-none">*</span>
                  <span className="text-[10px] text-gray-500 normal-case font-normal bg-white px-2 py-0.5 rounded border">
                    {selectedItemIds.length} selected
                  </span>
                </label>
                <div className="space-y-2 max-h-40 overflow-y-auto pr-1 thin-scrollbar">
                  {cart.map((item) => (
                    <label
                      key={item.cartItemId}
                      className="flex items-center gap-3 p-2 bg-white rounded-lg border border-gray-100 cursor-pointer hover:border-red-200 transition-colors"
                    >
                      <div
                        className={`relative w-5 h-5 rounded border flex items-center justify-center shrink-0 transition-colors ${selectedItemIds.includes(item.cartItemId) ? 'bg-red-600 border-red-600' : 'bg-gray-100 border-gray-300'}`}
                      >
                        <input
                          type="checkbox"
                          checked={selectedItemIds.includes(item.cartItemId)}
                          onChange={() => toggleItemSelection(item.cartItemId)}
                          className="sr-only"
                        />
                        {selectedItemIds.includes(item.cartItemId) && (
                          <Check
                            size={12}
                            className="text-white"
                            strokeWidth={3}
                          />
                        )}
                      </div>
                      <img
                        src={item.image}
                        alt={item.name}
                        className="w-8 h-8 object-contain rounded bg-gray-50 p-0.5"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-gray-900 truncate">
                          {item.name}
                        </p>
                        <p className="text-[10px] text-gray-500 truncate">
                          {item.selectedColor}{' '}
                          {item.selectedStorage && `• ${item.selectedStorage}`}
                        </p>
                      </div>
                    </label>
                  ))}
                </div>
                {selectedItemIds.length === 0 && (
                  <p className="text-[10px] text-red-500 font-bold mt-2 flex items-center gap-1 animate-pulse">
                    <Info size={10} /> Please select at least one item
                  </p>
                )}
              </div>
            )}

            {/* Address */}
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide mb-2 flex items-center gap-1">
                <MapPin size={14} /> Enter Beneficiary's Address{' '}
                <span className="text-red-600 text-lg leading-none">*</span>
              </label>
              <textarea
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-hidden focus:border-red-500 focus:ring-1 focus:ring-red-500 text-sm resize-none h-20"
                placeholder="Full delivery address..."
              />
            </div>

            {/* Sender Option */}
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide mb-2">
                Sender Preference{' '}
                <span className="text-red-600 text-lg leading-none">*</span>
              </label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer border p-3 rounded-xl flex-1 hover:border-red-200 hover:bg-red-50 transition-colors has-checked:border-red-600 has-checked:bg-red-50">
                  <input
                    type="radio"
                    name="senderType"
                    value="anonymous"
                    checked={senderType === 'anonymous'}
                    onChange={() => setSenderType('anonymous')}
                    className="w-4 h-4 text-red-600 accent-red-600"
                  />
                  <span className="text-sm font-medium">Send Anonymously</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer border p-3 rounded-xl flex-1 hover:border-red-200 hover:bg-red-50 transition-colors has-checked:border-red-600 has-checked:bg-red-50">
                  <input
                    type="radio"
                    name="senderType"
                    value="named"
                    checked={senderType === 'named'}
                    onChange={() => setSenderType('named')}
                    className="w-4 h-4 text-red-600 accent-red-600"
                  />
                  <span className="text-sm font-medium">Include My Name</span>
                </label>
              </div>
              {senderType === 'named' && (
                <div className="mt-3 animate-in fade-in slide-in-from-top-1">
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    From{' '}
                    <span className="text-red-600 text-lg leading-none">*</span>
                  </label>
                  <input
                    type="text"
                    value={senderName}
                    onChange={(e) => setSenderName(e.target.value)}
                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-hidden focus:border-red-500 text-sm"
                    placeholder="Your Name"
                  />
                </div>
              )}
            </div>

            {/* Recipient Details - Show when sender type is selected */}
            {senderType && (
              <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    Recipient's Name{' '}
                    <span className="text-red-600 text-lg leading-none">*</span>
                  </label>
                  <input
                    type="text"
                    value={recipientName}
                    onChange={(e) => setRecipientName(e.target.value)}
                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-hidden focus:border-red-500 text-sm"
                    placeholder="Name"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">
                      Recipient's Email{' '}
                      <span className="text-red-600 text-lg leading-none">
                        *
                      </span>
                    </label>
                    <input
                      type="email"
                      value={recipientEmail}
                      onChange={(e) => setRecipientEmail(e.target.value)}
                      className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-hidden focus:border-red-500 text-sm"
                      placeholder="Email"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">
                      Recipient's Number{' '}
                      <span className="text-red-600 text-lg leading-none">
                        *
                      </span>
                    </label>
                    <input
                      type="tel"
                      value={recipientPhone}
                      onChange={(e) => setRecipientPhone(e.target.value)}
                      className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-hidden focus:border-red-500 text-sm"
                      placeholder="Phone"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    Special Message{' '}
                    <span className="text-gray-400 font-normal">
                      (Optional)
                    </span>
                  </label>
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-hidden focus:border-red-500 text-sm resize-none h-24"
                    placeholder="Add a personal note..."
                  />
                </div>

                {/* Wrapping Options */}
                <div className="pt-2">
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide mb-2">
                    Wrapping Options{' '}
                    <span className="text-red-600 text-lg leading-none">*</span>
                  </label>
                  <div className="space-y-3">
                    <div>
                      <label className="flex items-center justify-between cursor-pointer border p-3 rounded-xl hover:border-red-200 hover:bg-red-50 transition-colors has-checked:border-red-600 has-checked:bg-red-50">
                        <div className="flex items-center gap-2">
                          <input
                            type="radio"
                            name="wrapping"
                            value="standard"
                            checked={wrapping === 'standard'}
                            onChange={() => setWrapping('standard')}
                            className="w-4 h-4 text-red-600 accent-red-600"
                          />
                          <span className="text-sm font-medium">
                            Wrap it for me
                          </span>
                        </div>
                        <span className="text-sm font-bold text-gray-900">
                          ₦10,000
                        </span>
                      </label>
                      {wrapping === 'standard' && (
                        <div className="flex items-start gap-2 mt-2 text-xs text-gray-500 bg-gray-50 p-2 rounded-lg animate-in fade-in slide-in-from-top-1">
                          <Info
                            size={14}
                            className="shrink-0 mt-0.5 text-blue-500"
                          />
                          <p>
                            Transform your gift with our elegant wrapping for a
                            nominal feel.
                          </p>
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="flex items-center justify-between cursor-pointer border p-3 rounded-xl hover:border-red-200 hover:bg-red-50 transition-colors has-checked:border-red-600 has-checked:bg-red-50">
                        <div className="flex items-center gap-2">
                          <input
                            type="radio"
                            name="wrapping"
                            value="custom"
                            checked={wrapping === 'custom'}
                            onChange={() => setWrapping('custom')}
                            className="w-4 h-4 text-red-600 accent-red-600"
                          />
                          <span className="text-sm font-medium">
                            Custom Wrap
                          </span>
                        </div>
                      </label>
                      {wrapping === 'custom' && (
                        <div className="flex items-start gap-2 mt-2 text-xs text-gray-500 bg-gray-50 p-2 rounded-lg animate-in fade-in slide-in-from-top-1">
                          <Info
                            size={14}
                            className="shrink-0 mt-0.5 text-blue-500"
                          />
                          <p>
                            We will contact you to discuss personalization. We
                            will NOT contact the recipient.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="pt-4">
              <button
                type="submit"
                disabled={!isValid}
                className="w-full bg-red-600 hover:bg-red-700 disabled:bg-gray-300 disabled:text-gray-500 disabled:cursor-not-allowed text-white font-bold py-3.5 rounded-xl transition-all shadow-lg active:scale-95"
              >
                Save Gift Options
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
