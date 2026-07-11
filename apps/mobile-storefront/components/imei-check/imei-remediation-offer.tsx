import Ionicons from '@react-native-vector-icons/ionicons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { BRAND, withAlpha } from '@/constants/Colors';
import {
  createImeiRemediationClient,
  type MobileImeiRemediationOffer,
} from '@/lib/imei-remediation-client';
import type { ImeiCheckerColors } from './imei-check.types';
import { ImeiRemediationCurrencyOption } from './imei-remediation-currency-option';
import { remediationStyles as styles } from './imei-remediation-offer.styles';

type Availability = Awaited<
  ReturnType<ReturnType<typeof createImeiRemediationClient>['eligibility']>
>;

export function ImeiRemediationOffer({
  accessToken,
  apiBaseUrl,
  colors,
  identifier,
  lookupId,
}: {
  accessToken?: string;
  apiBaseUrl: string;
  colors: ImeiCheckerColors;
  identifier: string;
  lookupId: string;
}) {
  const [availability, setAvailability] = useState<Availability>({
    kind: 'hidden',
  });
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [orderStatus, setOrderStatus] = useState<string | null>(null);
  const [paymentCurrency, setPaymentCurrency] = useState<'NGN' | 'USDT'>('NGN');
  const [selectedOfferId, setSelectedOfferId] = useState<string | null>(null);
  const [showOptions, setShowOptions] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [walletNeeded, setWalletNeeded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const startedAt = Date.now();
    const client = createImeiRemediationClient({ accessToken, apiBaseUrl });
    const check = async () => {
      const result = await client.eligibility({ identifier, lookupId });
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
  }, [accessToken, apiBaseUrl, identifier, lookupId]);

  if (availability.kind !== 'eligible') return null;
  const selectedOffer =
    availability.offers.find((candidate) => candidate.id === selectedOfferId) ??
    availability.offers[0];
  if (!selectedOffer) return null;

  const submit = async () => {
    setSubmitting(true);
    setError(null);
    setWalletNeeded(false);
    const result = await createImeiRemediationClient({
      accessToken,
      apiBaseUrl,
    }).place({
      identifier,
      orderId: availability.assessmentId,
      paymentCurrency,
      productId: selectedOffer.id,
    });
    setSubmitting(false);
    if (result.kind === 'error') {
      setError('Unable to place this unlock order.');
      setWalletNeeded(
        result.status === 402 && result.code === 'WALLET_INSUFFICIENT'
      );
      return;
    }
    setOrderStatus(result.status);
  };

  if (orderStatus) {
    return (
      <View
        accessibilityLiveRegion="polite"
        style={[
          styles.card,
          { backgroundColor: colors.card, borderColor: colors.border },
        ]}
      >
        <Text style={[styles.title, { color: colors.text }]}>
          Unlock order received
        </Text>
        <Text style={[styles.status, { color: colors.textSecondary }]}>
          Status: {orderStatus.replaceAll('_', ' ')}. We will notify you when
          the carrier responds.
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/unlock-orders')}
          style={styles.fundingButton}
        >
          <Text style={[styles.fundingText, { color: BRAND.primary }]}>
            View Unlock orders
          </Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.card, borderColor: colors.border },
      ]}
    >
      <View style={styles.header}>
        <View
          style={[
            styles.icon,
            { backgroundColor: withAlpha(BRAND.primary, 0.1) },
          ]}
        >
          <Ionicons
            name="lock-closed-outline"
            color={BRAND.primary}
            size={21}
          />
        </View>
        <View style={styles.headerContent}>
          <Text style={[styles.eyebrow, { color: BRAND.primary }]}>
            Verified clean-unlock option
          </Text>
          <Text style={[styles.title, { color: colors.text }]}>
            SIM-locked to {selectedOffer.carrier}
          </Text>
        </View>
      </View>
      <Text style={[styles.message, { color: colors.textSecondary }]}>
        {selectedOffer.name} · Usually{' '}
        {selectedOffer.turnaround || 'carrier timing varies'}
      </Text>
      <Text style={[styles.terms, { color: colors.textSecondary }]}>
        {selectedOffer.successRate === null
          ? 'Carrier-reviewed service.'
          : `${selectedOffer.successRate}% reported success. `}
        {selectedOffer.refundPolicy === 'refundable'
          ? 'Refundable if this service is rejected.'
          : 'No refund if the carrier denies it after accepting the request.'}
      </Text>

      {availability.offers.length > 1 ? (
        <View>
          <Pressable
            accessibilityRole="button"
            onPress={() => setShowOptions((visible) => !visible)}
          >
            <Text style={[styles.fundingText, { color: BRAND.primary }]}>
              See other options
            </Text>
          </Pressable>
          {showOptions
            ? availability.offers.map((candidate) => (
                <OfferOption
                  key={candidate.id}
                  colors={colors}
                  offer={candidate}
                  onSelect={() => setSelectedOfferId(candidate.id)}
                  selected={candidate.id === selectedOffer.id}
                />
              ))
            : null}
        </View>
      ) : null}

      {confirming ? (
        <View style={styles.actions}>
          <View
            accessibilityLabel="Payment currency"
            accessibilityRole="radiogroup"
            style={styles.amountOptions}
          >
            <ImeiRemediationCurrencyOption
              checked={paymentCurrency === 'NGN'}
              colors={colors}
              label={`₦${selectedOffer.priceNgn.toLocaleString('en-NG')}`}
              onSelect={() => setPaymentCurrency('NGN')}
            />
            {availability.usdtEnabled ? (
              <ImeiRemediationCurrencyOption
                checked={paymentCurrency === 'USDT'}
                colors={colors}
                label={`${selectedOffer.priceUsdt.toFixed(2)} USDT`}
                onSelect={() => setPaymentCurrency('USDT')}
              />
            ) : null}
          </View>
          {error ? (
            <Text
              accessibilityRole="alert"
              style={[styles.terms, { color: colors.error }]}
            >
              {error}
            </Text>
          ) : null}
          {walletNeeded ? (
            <Pressable
              accessibilityRole="button"
              onPress={() =>
                router.push(
                  paymentCurrency === 'USDT'
                    ? `/wallet/usdt?amount=${selectedOffer.priceUsdt}&returnTo=/imei-check`
                    : `/wallet?action=fund&requiredAmount=${selectedOffer.priceNgn}&returnTo=/imei-check`
                )
              }
            >
              <Text style={[styles.fundingText, { color: BRAND.primary }]}>
                Fund {paymentCurrency} wallet
              </Text>
            </Pressable>
          ) : null}
          <Pressable
            accessibilityRole="button"
            disabled={submitting}
            onPress={() => void submit()}
            style={[styles.button, { backgroundColor: BRAND.primary }]}
          >
            {submitting ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.buttonText}>Confirm and pay</Text>
            )}
          </Pressable>
        </View>
      ) : (
        <Pressable
          accessibilityRole="button"
          onPress={() => setConfirming(true)}
          style={[styles.button, { backgroundColor: BRAND.primary }]}
        >
          <Text style={styles.buttonText}>Unlock this device</Text>
        </Pressable>
      )}
    </View>
  );
}

function OfferOption({
  colors,
  offer,
  onSelect,
  selected,
}: {
  colors: ImeiCheckerColors;
  offer: MobileImeiRemediationOffer;
  onSelect: () => void;
  selected: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onSelect}
      style={[
        styles.amountOption,
        { borderColor: selected ? BRAND.primary : colors.border },
      ]}
    >
      <Text style={[styles.optionText, { color: colors.text }]}>
        {offer.name}
      </Text>
    </Pressable>
  );
}
