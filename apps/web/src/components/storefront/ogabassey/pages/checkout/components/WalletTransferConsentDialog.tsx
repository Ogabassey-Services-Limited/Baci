'use client';

import { useNativeModalDialog } from '../hooks/use-native-modal-dialog';

interface WalletTransferConsentDialogProps {
  merchantName: string;
  onAccept: () => void;
  onDecline: () => void;
}

/**
 * Explicit consent before provisioning the customer's standing wallet account
 * (Paystack DVA). Declining is safe: the checkout falls straight back to the
 * legacy order-scoped bank transfer, so the customer can still pay.
 */
export function WalletTransferConsentDialog({
  merchantName,
  onAccept,
  onDecline,
}: WalletTransferConsentDialogProps) {
  // Escape (native cancel) declines — the safe fallback to a one-off account.
  const dialogRef = useNativeModalDialog(onDecline);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
      <dialog
        aria-labelledby="wallet-consent-title"
        className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl"
        ref={dialogRef}
      >
        <h2
          className="font-bold text-gray-900 text-lg"
          id="wallet-consent-title"
        >
          Create your transfer account
        </h2>
        <p className="mt-2 text-gray-600 text-sm leading-relaxed">
          {merchantName} will create a permanent bank account number in your
          name. Money you send to it lands in your wallet and pays this order
          automatically — and you can reuse the same number next time.
        </p>
        <div className="mt-6 space-y-3">
          <button
            className="w-full rounded-xl bg-store-primary py-3 font-bold text-white transition-colors hover:bg-store-primary/90"
            onClick={onAccept}
            type="button"
          >
            Create my account
          </button>
          <button
            className="w-full py-2 font-medium text-gray-500 text-sm transition-colors hover:text-gray-700"
            onClick={onDecline}
            type="button"
          >
            Not now — use a one-off account
          </button>
        </div>
      </dialog>
    </div>
  );
}
