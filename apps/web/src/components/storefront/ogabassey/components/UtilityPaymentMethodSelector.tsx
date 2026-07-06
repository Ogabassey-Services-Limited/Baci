'use client';

import { CreditCard, Wallet } from 'lucide-react';
import { type KeyboardEvent, useRef } from 'react';
import { cn } from '@/lib/utils';
import type { UtilityPaymentMethod } from './utility-types';
import { WALLET_FUNDING_COPY } from './wallet-funding-copy';

interface UtilityPaymentMethodSelectorProps {
  canUseWallet: boolean;
  isLoading: boolean;
  onFundWallet?: () => void;
  onSelectCard: () => void;
  onSelectWallet: () => void;
  selectedPaymentMethod: UtilityPaymentMethod;
  showWalletRow: boolean;
  walletBalance: number;
  walletLoading: boolean;
}

export function UtilityPaymentMethodSelector({
  canUseWallet,
  isLoading,
  onFundWallet,
  onSelectCard,
  onSelectWallet,
  selectedPaymentMethod,
  showWalletRow,
  walletBalance,
  walletLoading,
}: UtilityPaymentMethodSelectorProps) {
  const walletRef = useRef<HTMLButtonElement>(null);
  const cardRef = useRef<HTMLButtonElement>(null);

  const selectMethod = (method: UtilityPaymentMethod) => {
    if (isLoading || (method === 'wallet' && !canUseWallet)) {
      return;
    }
    if (method === 'wallet') {
      onSelectWallet();
      walletRef.current?.focus();
      return;
    }
    onSelectCard();
    cardRef.current?.focus();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!['ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowUp'].includes(event.key)) {
      return;
    }
    event.preventDefault();
    selectMethod(
      selectedPaymentMethod === 'wallet' || !canUseWallet ? 'card' : 'wallet'
    );
  };

  const walletSubtitle = walletLoading
    ? 'Checking wallet balance...'
    : canUseWallet
      ? `₦${walletBalance.toLocaleString()} available`
      : WALLET_FUNDING_COPY.zeroBalanceHint;

  return (
    <div className="space-y-2">
      <p className="text-sm font-semibold text-gray-900">Payment Method</p>
      <div
        aria-label="Payment method"
        className="space-y-2"
        onKeyDown={handleKeyDown}
        role="radiogroup"
        tabIndex={-1}
      >
        {(walletLoading || showWalletRow) && (
          <button
            ref={walletRef}
            type="button"
            role="radio"
            aria-checked={selectedPaymentMethod === 'wallet'}
            disabled={!canUseWallet || isLoading}
            onClick={onSelectWallet}
            tabIndex={selectedPaymentMethod === 'wallet' ? 0 : -1}
            className={cn(
              'w-full rounded-xl border-2 p-3 text-left transition-all',
              'flex items-center gap-3',
              selectedPaymentMethod === 'wallet'
                ? 'border-store-primary bg-store-primary/5'
                : 'border-gray-200 bg-white hover:border-gray-300',
              (!canUseWallet || isLoading) && 'cursor-not-allowed opacity-70'
            )}
          >
            <span className="flex size-10 items-center justify-center rounded-lg bg-store-primary/10 text-store-primary">
              <Wallet size={20} />
            </span>
            <span className="flex-1">
              <span className="flex items-center gap-2">
                <span className="block text-sm font-bold text-gray-900">
                  Pay with wallet
                </span>
                <span className="rounded-full bg-store-primary/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-store-primary">
                  {WALLET_FUNDING_COPY.walletRecommendedBadge}
                </span>
              </span>
              <span className="block text-xs text-gray-500">
                {walletSubtitle}
              </span>
            </span>
          </button>
        )}

        <button
          ref={cardRef}
          type="button"
          role="radio"
          aria-checked={selectedPaymentMethod === 'card'}
          disabled={isLoading}
          onClick={onSelectCard}
          tabIndex={selectedPaymentMethod === 'card' ? 0 : -1}
          className={cn(
            'w-full rounded-xl border-2 p-3 text-left transition-all',
            'flex items-center gap-3',
            selectedPaymentMethod === 'card'
              ? 'border-store-primary bg-store-primary/5'
              : 'border-gray-200 bg-white hover:border-gray-300',
            isLoading && 'cursor-not-allowed opacity-70'
          )}
        >
          <span className="flex size-10 items-center justify-center rounded-lg bg-gray-100 text-gray-600">
            <CreditCard size={20} />
          </span>
          <span className="flex-1">
            <span className="block text-sm font-bold text-gray-900">
              Pay with Card
            </span>
            <span className="block text-xs text-gray-500">
              Visa, Mastercard, Verve
            </span>
          </span>
        </button>
      </div>

      {showWalletRow && onFundWallet ? (
        <button
          type="button"
          onClick={onFundWallet}
          className="text-xs font-semibold text-store-primary hover:underline"
        >
          {WALLET_FUNDING_COPY.fundCta}
        </button>
      ) : null}
    </div>
  );
}
