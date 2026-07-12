'use client';

import { CheckCircle2, Clock3, LockKeyhole, WalletCards } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useMerchantSafe } from '@/hooks/use-merchant-client';
import { ImeiRemediationCurrencyOption as CurrencyOption } from './imei-remediation-currency-option';
import {
  imeiRemediationApi,
  type ImeiRemediationOffer as Offer,
} from './imei-remediation-api';

const NGN_FORMATTER = new Intl.NumberFormat('en-NG', {
  currency: 'NGN',
  maximumFractionDigits: 0,
  style: 'currency',
});

type Availability = Awaited<ReturnType<typeof imeiRemediationApi.eligibility>>;

export function ImeiRemediationOffer({
  identifier,
  lookupId,
}: {
  identifier: string;
  lookupId: string;
}) {
  const merchantSlug = useMerchantSafe()?.merchant?.slug;
  const [availability, setAvailability] = useState<Availability>({
    kind: 'hidden',
  });
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [orderStatus, setOrderStatus] = useState<string | null>(null);
  const [paymentCurrency, setPaymentCurrency] = useState<'NGN' | 'USDT'>('NGN');
  const [selectedOfferId, setSelectedOfferId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [walletNeeded, setWalletNeeded] = useState(false);

  useEffect(() => {
    if (!merchantSlug) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const startedAt = Date.now();
    const check = async () => {
      const result = await imeiRemediationApi.eligibility({
        identifier,
        lookupId,
        merchantSlug,
      });
      if (cancelled) return;
      if (result.kind === 'pending' && Date.now() - startedAt < 5 * 60_000) {
        timer = setTimeout(check, result.pollAfterMs);
        return;
      }
      setAvailability(result);
    };
    void check();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [identifier, lookupId, merchantSlug]);

  if (!merchantSlug || availability.kind !== 'eligible') return null;
  const selectedOffer =
    availability.offers.find((candidate) => candidate.id === selectedOfferId) ??
    availability.offers[0];
  if (!selectedOffer) return null;

  const submit = async () => {
    setSubmitting(true);
    setError(null);
    setWalletNeeded(false);
    const result = await imeiRemediationApi.place({
      identifier,
      merchantSlug,
      orderId: availability.assessmentId,
      paymentCurrency,
      productId: selectedOffer.id,
    });
    setSubmitting(false);
    if (result.kind === 'error') {
      setError(result.error);
      setWalletNeeded(
        result.status === 402 && result.code === 'WALLET_INSUFFICIENT'
      );
      return;
    }
    setOrderStatus(result.status);
  };

  if (orderStatus) {
    return (
      <section
        aria-live="polite"
        className="mt-6 rounded-2xl border border-[var(--store-border,#e5e7eb)] bg-[var(--store-surface,#fff)] p-5"
      >
        <div className="flex items-start gap-3">
          <CheckCircle2
            aria-hidden="true"
            className="mt-0.5 text-[var(--store-success-text,#166534)]"
            size={22}
          />
          <div>
            <h3 className="font-bold text-[var(--store-text,#111827)]">
              Unlock order received
            </h3>
            <p className="mt-1 text-sm text-[var(--store-muted-text,#6b7280)]">
              Status: {orderStatus.replaceAll('_', ' ')}. We will notify you
              when the carrier responds.
            </p>
            <a
              className="mt-3 inline-flex text-sm font-bold text-[var(--store-primary,#dc2626)] underline-offset-4 hover:underline"
              href="/unlock-orders"
            >
              View Unlock orders
            </a>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="mt-6 rounded-2xl border border-[var(--store-border,#e5e7eb)] bg-[var(--store-surface,#fff)] p-5 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="rounded-xl bg-[var(--store-primary,#dc2626)]/10 p-2 text-[var(--store-primary,#dc2626)]">
          <LockKeyhole aria-hidden="true" size={22} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold uppercase tracking-wider text-[var(--store-primary,#dc2626)]">
            Verified clean-unlock option
          </p>
          <h3 className="mt-1 text-lg font-bold text-[var(--store-text,#111827)]">
            SIM-locked to {selectedOffer.carrier}
          </h3>
          <p className="mt-1 text-sm text-[var(--store-muted-text,#6b7280)]">
            {selectedOffer.name}
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
        <Info icon={<Clock3 size={17} />} label="Turnaround">
          Usually {selectedOffer.turnaround || 'varies by carrier'}
        </Info>
        <Info icon={<CheckCircle2 size={17} />} label="Service terms">
          {selectedOffer.successRate === null
            ? 'Carrier-reviewed service'
            : `${selectedOffer.successRate}% reported success`}
        </Info>
      </div>
      <p className="mt-3 text-xs leading-5 text-[var(--store-muted-text,#6b7280)]">
        {selectedOffer.refundPolicy === 'refundable'
          ? 'Refund policy: your wallet is refunded if this refundable service is rejected.'
          : 'Refund policy: no refund if the carrier denies this service after accepting it.'}
      </p>

      {availability.offers.length > 1 ? (
        <details className="mt-3 text-sm">
          <summary className="cursor-pointer font-semibold text-[var(--store-text,#111827)]">
            See other options
          </summary>
          <div className="mt-2 grid gap-2">
            {availability.offers.map((candidate) => (
              <OfferButton
                key={candidate.id}
                offer={candidate}
                selected={candidate.id === selectedOffer.id}
                onSelect={() => setSelectedOfferId(candidate.id)}
              />
            ))}
          </div>
        </details>
      ) : null}

      {confirming ? (
        <div className="mt-5 border-t border-[var(--store-border,#e5e7eb)] pt-4">
          <div
            aria-label="Payment currency"
            className="grid gap-2 sm:grid-cols-2"
            role="radiogroup"
          >
            <CurrencyOption
              checked={paymentCurrency === 'NGN'}
              label={NGN_FORMATTER.format(selectedOffer.priceNgn)}
              onSelect={() => setPaymentCurrency('NGN')}
              value="NGN"
            />
            {availability.usdtEnabled ? (
              <CurrencyOption
                checked={paymentCurrency === 'USDT'}
                label={`${selectedOffer.priceUsdt.toFixed(2)} USDT`}
                onSelect={() => setPaymentCurrency('USDT')}
                value="USDT"
              />
            ) : null}
          </div>
          {error ? (
            <p
              className="mt-3 text-sm font-medium text-[var(--store-danger-text,#b91c1c)]"
              role="alert"
            >
              {error}
            </p>
          ) : null}
          {walletNeeded ? (
            <div className="mt-3 flex flex-wrap gap-3 text-sm font-bold">
              <a
                className="text-[var(--store-primary,#dc2626)] underline"
                href="/wallet?fund=1"
              >
                Fund NGN wallet
              </a>
              {availability.usdtEnabled ? (
                <a
                  className="text-[var(--store-primary,#dc2626)] underline"
                  href={`/wallet?fund-usdt=1&amount=${selectedOffer.priceUsdt}`}
                >
                  Fund USDT wallet
                </a>
              ) : null}
            </div>
          ) : null}
          <button
            className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--store-primary,#dc2626)] px-4 py-3 font-bold text-white disabled:opacity-60"
            disabled={submitting}
            onClick={() => void submit()}
            type="button"
          >
            <WalletCards aria-hidden="true" size={18} />
            {submitting ? 'Submitting securely…' : 'Confirm and pay'}
          </button>
        </div>
      ) : (
        <button
          className="mt-5 inline-flex w-full items-center justify-center rounded-xl bg-[var(--store-primary,#dc2626)] px-4 py-3 font-bold text-white"
          onClick={() => setConfirming(true)}
          type="button"
        >
          Unlock this device
        </button>
      )}
    </section>
  );
}

function Info({
  children,
  icon,
  label,
}: {
  children: React.ReactNode;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <div className="flex gap-2 rounded-xl bg-[var(--store-muted,#f9fafb)] p-3 text-[var(--store-text,#111827)]">
      <span aria-hidden="true">{icon}</span>
      <span>
        <strong className="block text-xs uppercase text-[var(--store-muted-text,#6b7280)]">
          {label}
        </strong>
        {children}
      </span>
    </div>
  );
}

function OfferButton({
  offer,
  onSelect,
  selected,
}: {
  offer: Offer;
  onSelect: () => void;
  selected: boolean;
}) {
  return (
    <button
      aria-pressed={selected}
      className="rounded-lg border border-[var(--store-border,#e5e7eb)] p-3 text-left"
      onClick={onSelect}
      type="button"
    >
      {offer.name}
    </button>
  );
}
