import { Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { StorefrontScreenShell } from '@/components/storefront/StorefrontScreenShell';
import { useColorScheme } from '@/components/useColorScheme';
import Colors, { BRAND, withAlpha } from '@/constants/Colors';
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard';
import { createUsdtWalletFundingClient } from '@/lib/usdt-wallet-funding-client';
import { UsdtWalletFundingField as Field } from './UsdtWalletFundingField';
import { usdtFundingStyles as styles } from './usdt-wallet-funding.styles';

const CHAINS = ['TRX', 'ETH', 'MATIC', 'AVAXC'] as const;

export function UsdtWalletFundingScreen({
  accessToken,
  apiBaseUrl,
  customerName,
  customerPhone,
  initialAmount,
  merchantSlug,
}: {
  accessToken?: string;
  apiBaseUrl: string;
  customerName?: string;
  customerPhone?: string;
  initialAmount?: number;
  merchantSlug: string;
}) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const { copyToClipboard, feedback } = useCopyToClipboard({
    successMessage: 'Deposit address copied.',
  });
  const [address, setAddress] = useState<string | null>(null);
  const [amount, setAmount] = useState(
    initialAmount && initialAmount > 0 ? String(initialAmount) : ''
  );
  const [balance, setBalance] = useState(0);
  const [chain, setChain] = useState<(typeof CHAINS)[number]>('TRX');
  const [city, setCity] = useState('');
  const [country, setCountry] = useState('NG');
  const [error, setError] = useState<string | null>(null);
  const [line1, setLine1] = useState('');
  const [pending, setPending] = useState(false);
  const [reference, setReference] = useState<string | null>(null);
  const [state, setState] = useState('');
  const [status, setStatus] = useState('idle');
  const [zipCode, setZipCode] = useState('');

  useEffect(() => {
    let cancelled = false;
    const client = createUsdtWalletFundingClient({ accessToken, apiBaseUrl });
    void client.balance(merchantSlug).then((value) => {
      if (!cancelled) setBalance(value);
    });
    return () => {
      cancelled = true;
    };
  }, [accessToken, apiBaseUrl, merchantSlug]);

  useEffect(() => {
    if (!reference || status !== 'pending') return;
    let cancelled = false;
    const client = createUsdtWalletFundingClient({ accessToken, apiBaseUrl });
    const refresh = async () => {
      const result = await client.status(reference);
      if (cancelled || result.kind !== 'ready') return;
      setStatus(result.fundingStatus);
      if (result.fundingStatus === 'completed') {
        setBalance(await client.balance(merchantSlug));
      }
    };
    const interval = setInterval(refresh, 5_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [accessToken, apiBaseUrl, merchantSlug, reference, status]);

  const submit = async () => {
    const numericAmount = Number(amount);
    if (
      !Number.isFinite(numericAmount) ||
      numericAmount < 1 ||
      !line1.trim() ||
      !city.trim() ||
      !zipCode.trim() ||
      !/^[A-Za-z]{2}$/.test(country)
    ) {
      setError('Enter an amount and complete the billing address.');
      return;
    }
    setPending(true);
    setError(null);
    const result = await createUsdtWalletFundingClient({
      accessToken,
      apiBaseUrl,
    }).initialize({
      amount: numericAmount,
      billingAddress: {
        city,
        country,
        line1,
        state: state || undefined,
        zipCode,
      },
      chain,
      customerName,
      customerPhone,
      merchantSlug,
    });
    setPending(false);
    if (result.kind === 'error') {
      setError(result.error);
      return;
    }
    setAddress(result.address);
    setReference(result.reference);
    setStatus('pending');
  };

  return (
    <StorefrontScreenShell
      edges={['bottom', 'left', 'right']}
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      <Stack.Screen options={{ title: 'Fund USDT wallet' }} />
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <View>
          <Text style={[styles.title, { color: colors.text }]}>
            USDT wallet
          </Text>
          <Text style={[styles.balance, { color: colors.text }]}>
            {balance.toFixed(2)} USDT
          </Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            Use this isolated USD-stable balance for eligible carrier-unlock
            orders.
          </Text>
        </View>

        {reference ? (
          <View style={[styles.addressBox, { backgroundColor: colors.muted }]}>
            <Text style={[styles.label, { color: colors.text }]}>
              Send exactly {Number(amount).toFixed(2)} USDT on {chain}
            </Text>
            {address ? (
              <>
                <Text
                  selectable
                  style={[styles.address, { color: colors.text }]}
                >
                  {address}
                </Text>
                <Pressable
                  accessibilityLabel="Copy deposit address"
                  accessibilityRole="button"
                  onPress={() => void copyToClipboard(address)}
                  style={[styles.button, { backgroundColor: BRAND.primary }]}
                >
                  <Text style={styles.buttonText}>Copy address</Text>
                </Pressable>
              </>
            ) : (
              <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                Preparing your deposit address…
              </Text>
            )}
            <Text
              accessibilityLiveRegion="polite"
              style={[styles.subtitle, { color: colors.textSecondary }]}
            >
              Status: {status}
            </Text>
            {feedback ? (
              <Text style={[styles.subtitle, { color: colors.success }]}>
                {feedback}
              </Text>
            ) : null}
          </View>
        ) : (
          <>
            <Field
              colors={colors}
              label="Amount (USDT)"
              value={amount}
              onChange={setAmount}
            />
            <Text style={[styles.label, { color: colors.text }]}>Network</Text>
            <View accessibilityRole="radiogroup" style={styles.chainRow}>
              {CHAINS.map((item) => (
                <Pressable
                  key={item}
                  accessibilityLabel={item}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: chain === item }}
                  onPress={() => setChain(item)}
                  style={[
                    styles.chain,
                    {
                      backgroundColor:
                        chain === item
                          ? withAlpha(BRAND.primary, 0.1)
                          : colors.card,
                      borderColor:
                        chain === item ? BRAND.primary : colors.border,
                    },
                  ]}
                >
                  <Text style={[styles.chainText, { color: colors.text }]}>
                    {item}
                  </Text>
                </Pressable>
              ))}
            </View>
            <Field
              accessibilityLabel="Address line"
              colors={colors}
              label="Address line"
              value={line1}
              onChange={setLine1}
            />
            <Field
              accessibilityLabel="City"
              colors={colors}
              label="City"
              value={city}
              onChange={setCity}
            />
            <Field
              colors={colors}
              label="State"
              value={state}
              onChange={setState}
            />
            <Field
              accessibilityLabel="Postal code"
              colors={colors}
              label="Postal code"
              value={zipCode}
              onChange={setZipCode}
            />
            <Field
              colors={colors}
              label="Country code"
              maxLength={2}
              value={country}
              onChange={(value) => setCountry(value.toUpperCase())}
            />
            {error ? (
              <Text
                accessibilityRole="alert"
                style={[styles.error, { color: colors.error }]}
              >
                {error}
              </Text>
            ) : null}
            <Pressable
              accessibilityRole="button"
              disabled={pending}
              onPress={() => void submit()}
              style={[styles.button, { backgroundColor: BRAND.primary }]}
            >
              {pending ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.buttonText}>Create deposit address</Text>
              )}
            </Pressable>
          </>
        )}
      </ScrollView>
    </StorefrontScreenShell>
  );
}
