'use client';

import { Building2, Check, Copy, Loader2, X } from 'lucide-react';
import type { WalletOrderFundingIntent } from '@/schemas/order-wallet-funding-intent';
import type { WalletFundingAccountResponse } from '@/schemas/wallet-funding-account';
import {
  describeWalletFundedTransfer,
  formatWalletTransferDeadline,
  type WalletFundedTransferTone,
} from '../wallet-funded-transfer-copy';

const TONE_STYLES: Record<WalletFundedTransferTone, string> = {
  progress: 'bg-blue-50 border-blue-100 text-blue-900',
  review: 'bg-amber-50 border-amber-200 text-amber-900',
  stopped: 'bg-gray-50 border-gray-200 text-gray-800',
  success: 'bg-green-50 border-green-200 text-green-900',
  waiting: 'bg-blue-50 border-blue-100 text-blue-900',
};

interface WalletFundedTransferModalProps {
  account: WalletFundingAccountResponse;
  copiedText: string | null;
  formatCurrency: (amount: number) => string;
  /** Poll transport failure — never a payment failure. */
  error: string | null;
  intent: WalletOrderFundingIntent;
  isChecking: boolean;
  onCheckNow: () => void;
  onClose: () => void;
  onCopy: (value: string) => void;
}

/**
 * Wallet-funded bank transfer: ONE account number (the customer's standing
 * wallet DVA), money in → wallet → order auto-debits. Renders every intent
 * status honestly — only `completed` says the order is paid.
 */
export function WalletFundedTransferModal({
  account,
  copiedText,
  error,
  formatCurrency,
  intent,
  isChecking,
  onCheckNow,
  onClose,
  onCopy,
}: WalletFundedTransferModalProps) {
  const remainingAmount =
    intent.remainingAmount ??
    Math.max(intent.expectedAmount - intent.fundedAmount, 0);
  const presentation = describeWalletFundedTransfer({
    formatCurrency,
    fundedAmount: intent.fundedAmount,
    remainingAmount,
    status: intent.status,
  });
  const deadline = formatWalletTransferDeadline(intent.expiresAt);
  const amountToSend = remainingAmount > 0 ? remainingAmount : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
      <dialog
        aria-labelledby="wallet-funded-transfer-title"
        className="max-h-[90vh] w-full max-w-md animate-in overflow-y-auto rounded-2xl bg-white shadow-2xl duration-200 zoom-in-95"
        open
      >
        <div className="sticky top-0 flex items-center justify-between rounded-t-2xl bg-linear-to-r from-store-primary to-store-primary/80 p-6">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-white/20">
              <Building2 className="text-white" size={20} />
            </div>
            <div>
              <h2
                className="font-bold text-white leading-none"
                id="wallet-funded-transfer-title"
              >
                Bank Transfer
              </h2>
              <p className="mt-1 text-white/70 text-xs">
                Pays this order from your wallet automatically
              </p>
            </div>
          </div>
          <button
            aria-label="Close bank transfer"
            className="flex size-8 items-center justify-center rounded-lg bg-white/20 text-white transition-colors hover:bg-white/30"
            onClick={onClose}
            type="button"
          >
            <X size={16} />
          </button>
        </div>

        <div className="space-y-6 p-6">
          {presentation.showAccount && (
            <>
              <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4 text-center">
                <p className="mb-1 font-bold text-gray-500 text-xs uppercase tracking-widest">
                  Send Exactly
                </p>
                <p className="font-black text-3xl text-gray-900">
                  {formatCurrency(amountToSend)}
                </p>
              </div>

              <div className="space-y-4">
                <div className="space-y-1.5">
                  <p className="pl-1 font-bold text-[10px] text-gray-400 uppercase tracking-widest">
                    Account Number
                  </p>
                  <div className="group relative">
                    <div className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-4 font-bold font-mono text-gray-900 text-xl tracking-wider">
                      {account.accountNumber}
                    </div>
                    <button
                      aria-label="Copy account number"
                      className={`absolute top-2 right-2 bottom-2 flex items-center justify-center rounded-lg border bg-white px-4 shadow-sm transition-all ${
                        copiedText === account.accountNumber
                          ? 'border-green-300 text-green-600'
                          : 'border-gray-200 hover:border-store-primary/40 hover:text-store-primary'
                      }`}
                      onClick={() => onCopy(account.accountNumber)}
                      type="button"
                    >
                      {copiedText === account.accountNumber ? (
                        <Check size={18} />
                      ) : (
                        <Copy size={18} />
                      )}
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="rounded-xl border border-gray-100 bg-gray-50 p-3">
                    <p className="mb-1 font-bold text-[10px] text-gray-400 uppercase tracking-widest">
                      Bank Name
                    </p>
                    <p className="font-bold text-gray-900">
                      {account.bankName ?? 'Your wallet bank'}
                    </p>
                  </div>
                  <div className="rounded-xl border border-gray-100 bg-gray-50 p-3">
                    <p className="mb-1 font-bold text-[10px] text-gray-400 uppercase tracking-widest">
                      Account Name
                    </p>
                    <p className="truncate font-bold text-gray-900">
                      {account.accountName ?? 'Your wallet account'}
                    </p>
                  </div>
                </div>
              </div>
            </>
          )}

          <output
            className={`block rounded-2xl border p-4 ${TONE_STYLES[presentation.tone]}`}
          >
            <p className="font-bold text-sm">{presentation.title}</p>
            <p className="mt-1 text-xs leading-relaxed">{presentation.body}</p>
            {presentation.keepPolling && deadline && (
              <p className="mt-2 text-xs opacity-80">
                Transfer window closes at {deadline}.
              </p>
            )}
          </output>

          {presentation.keepPolling && (
            <div className="flex items-center justify-center gap-3 py-2 text-store-primary">
              <Loader2 className="animate-spin" size={16} />
              <span className="font-bold text-sm">
                Waiting for your transfer…
              </span>
            </div>
          )}

          {error && (
            <p className="text-center text-gray-500 text-xs">
              We could not reach the server to check this transfer. We will keep
              trying — your money is not affected.
            </p>
          )}

          <div className="space-y-3">
            {presentation.keepPolling && (
              <button
                className="w-full rounded-xl bg-store-primary py-4 font-bold text-white shadow-lg shadow-store-primary/20 transition-colors hover:bg-store-primary/90 disabled:opacity-60"
                disabled={isChecking}
                onClick={onCheckNow}
                type="button"
              >
                {isChecking ? 'Checking…' : "I've sent it — check now"}
              </button>
            )}
            <button
              className="w-full py-2.5 font-medium text-gray-500 text-sm transition-colors hover:text-gray-700"
              onClick={onClose}
              type="button"
            >
              {presentation.keepPolling ? 'Close and check later' : 'Close'}
            </button>
          </div>
        </div>
      </dialog>
    </div>
  );
}
