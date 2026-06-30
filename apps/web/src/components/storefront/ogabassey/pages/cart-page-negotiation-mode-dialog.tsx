import { useEffect, useId, useRef } from 'react';
import type { CartItem } from '@/hooks/cart';
import { CartPageNegotiationIcon } from './cart-page-negotiation-icon';

interface CartPageNegotiationModeDialogProps {
  hasNonNegotiableCartItem: boolean;
  isOpen: boolean;
  onCancel: () => void;
  onOpenTotalNegotiation: () => void;
  onOpenPendingItem: (item: CartItem) => void;
  pendingItem: CartItem | null;
}

export function CartPageNegotiationModeDialog({
  hasNonNegotiableCartItem,
  isOpen,
  onCancel,
  onOpenPendingItem,
  onOpenTotalNegotiation,
  pendingItem,
}: CartPageNegotiationModeDialogProps) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const previouslyFocusedElement = useRef<Element | null>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    previouslyFocusedElement.current = document.activeElement;
    dialogRef.current?.focus();

    return () => {
      if (previouslyFocusedElement.current instanceof HTMLElement) {
        previouslyFocusedElement.current.focus();
      }
    };
  }, [isOpen]);

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            onCancel();
          }
        }}
        className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl focus:outline-hidden"
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="size-12 bg-amber-100 rounded-full flex items-center justify-center">
            <CartPageNegotiationIcon className="text-amber-600" size={24} />
          </div>
          <h3 id={titleId} className="text-xl font-bold text-gray-900">
            Choose Negotiation Mode
          </h3>
        </div>
        <p className="text-gray-600 mb-6">
          Negotiating items individually will disable bulk cart negotiation.
          <span className="font-semibold"> You can only use one approach.</span>
        </p>
        <div className="flex flex-col gap-3">
          <button
            type="button"
            onClick={() => {
              if (pendingItem) {
                onOpenPendingItem(pendingItem);
              }
            }}
            className="w-full bg-store-primary text-white font-bold py-3 px-4 rounded-xl hover:opacity-90 transition-opacity"
          >
            Negotiate This Item
          </button>
          <button
            type="button"
            onClick={() => {
              if (hasNonNegotiableCartItem) {
                return;
              }
              onCancel();
              onOpenTotalNegotiation();
            }}
            disabled={hasNonNegotiableCartItem}
            className="w-full bg-gray-100 text-gray-800 font-bold py-3 px-4 rounded-xl hover:bg-gray-200 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <CartPageNegotiationIcon size={18} />
            Bulk Negotiate Entire Cart
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="w-full text-gray-500 font-medium py-2"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
