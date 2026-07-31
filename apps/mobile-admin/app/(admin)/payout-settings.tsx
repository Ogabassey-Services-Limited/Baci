import Ionicons from '@react-native-vector-icons/ionicons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useLayoutEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PayoutBankDetailsForm } from '@/components/payouts/PayoutBankDetailsForm';
import { PayoutBankPickerModal } from '@/components/payouts/PayoutBankPickerModal';
import { isStoreReadinessSetupOrigin } from '@/constants/store-readiness-routes';
import { SPACING, TYPOGRAPHY } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { useMerchant } from '@/hooks/useMerchant';
import { usePayoutAccountVerification } from '@/hooks/usePayoutAccountVerification';
import { usePayouts } from '@/hooks/usePayouts';
import { type PaystackBank, usePaystackBanks } from '@/hooks/usePaystackBanks';
import { useTheme } from '@/hooks/useTheme';

export default function PayoutSettingsScreen() {
  const { colors, shadows } = useTheme();
  const { session } = useAuth();
  const { merchant, isLoading: isLoadingMerchant } = useMerchant();
  const { savePayoutSettings } = usePayouts();
  const router = useRouter();
  const { from } = useLocalSearchParams<{ from?: string }>();

  const [accountnumber, setAccountNumber] = useState('');
  const [selectedBank, setSelectedBank] = useState<PaystackBank | null>(null);
  const [showBankModal, setShowBankModal] = useState(false);

  // Banks from backend (canonical source, deduplicated)
  const { data: banks, isLoading: isLoadingBanks } = usePaystackBanks();

  const activeMerchantIdRef = useRef(merchant?.id);
  useLayoutEffect(() => {
    activeMerchantIdRef.current = merchant?.id;
  }, [merchant?.id]);

  // Account verification — fires once per settled (accountnumber, bank) pair
  const { accountName, isVerifying, verifyError } =
    usePayoutAccountVerification({
      accountNumber: accountnumber,
      bankCode: selectedBank?.code ?? '',
      isAuthenticated: !!session?.access_token,
    });

  // Initialize state from saved merchant settings. Adjusting state during
  // render (guarded by a prev-value compare) avoids the extra post-commit
  // re-render an effect would cause and keeps React Compiler memoization.
  const [prevSeedKey, setPrevSeedKey] = useState<string | null>(null);
  if (merchant) {
    const seedKey = [
      merchant.id,
      merchant.bank_account_number ?? '',
      merchant.bank_code ?? '',
      merchant.bank_name ?? '',
      banks ? 'banks-loaded' : 'banks-pending',
    ].join('|');
    if (seedKey !== prevSeedKey) {
      setPrevSeedKey(seedKey);
      setAccountNumber(merchant.bank_account_number || '');
      setSelectedBank(null);
      if (merchant.bank_code && banks) {
        const bank = banks.find((b) => b.code === merchant.bank_code);
        if (bank) setSelectedBank(bank);
        else if (merchant.bank_name) {
          setSelectedBank({
            id: 0,
            name: merchant.bank_name,
            slug: '',
            code: merchant.bank_code,
            active: true,
          });
        }
      }
    }
  }

  const handleSave = () => {
    if (!selectedBank) {
      Alert.alert('Error', 'Please select a bank');
      return;
    }
    if (accountnumber.length < 10) {
      Alert.alert('Error', 'Please enter a valid account number');
      return;
    }
    if (verifyError) {
      Alert.alert('Error', `Cannot save: ${verifyError}`);
      return;
    }
    // Block save when no verified name OR verification is still in progress
    if (!accountName || isVerifying) {
      Alert.alert('Error', 'Please wait for account verification');
      return;
    }
    const savedMerchantId = merchant?.id;
    savePayoutSettings.mutate(
      {
        bankCode: selectedBank.code,
        accountNumber: accountnumber,
        businessName: merchant?.business_name || 'My Store',
      },
      {
        onSuccess: () => {
          if (
            savedMerchantId &&
            activeMerchantIdRef.current !== savedMerchantId
          ) {
            return;
          }
          if (isStoreReadinessSetupOrigin(from)) {
            router.back();
            return;
          }
          Alert.alert('Success', 'Payout settings saved successfully', [
            { text: 'OK', onPress: () => router.back() },
          ]);
        },
        onError: (error) => {
          if (
            savedMerchantId &&
            activeMerchantIdRef.current !== savedMerchantId
          ) {
            return;
          }
          Alert.alert('Error', error.message || 'Failed to update details');
        },
      }
    );
  };

  if (isLoadingMerchant) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: colors.background }]}
      >
        <ActivityIndicator size="large" color={colors.primary} />
      </SafeAreaView>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Payout Settings',
          headerLeft: () => (
            <Pressable onPress={() => router.back()} style={styles.backButton}>
              <Ionicons name="arrow-back" size={24} color={colors.text} />
            </Pressable>
          ),
          headerStyle: {
            backgroundColor: colors.card,
          },
          headerTitleStyle: {
            color: colors.text,
          },
          headerRight: () => (
            <Pressable
              onPress={handleSave}
              disabled={savePayoutSettings.isPending}
              style={styles.saveButton}
            >
              {savePayoutSettings.isPending ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Text style={[styles.saveText, { color: colors.primary }]}>
                  Save
                </Text>
              )}
            </Pressable>
          ),
        }}
      />
      <SafeAreaView
        style={[styles.container, { backgroundColor: colors.background }]}
        edges={['bottom']}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
        >
          <PayoutBankDetailsForm
            accountName={accountName}
            accountNumber={accountnumber}
            colors={colors}
            isVerifying={isVerifying}
            onAccountNumberChange={setAccountNumber}
            onOpenBankPicker={() => setShowBankModal(true)}
            selectedBank={selectedBank}
            shadows={shadows.sm}
            verifyError={verifyError}
          />
        </ScrollView>

        <PayoutBankPickerModal
          banks={banks ?? []}
          colors={colors}
          isLoading={isLoadingBanks}
          onClose={() => setShowBankModal(false)}
          onSelect={setSelectedBank}
          selectedBank={selectedBank}
          visible={showBankModal}
        />
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollView: { flex: 1 },
  scrollContent: { padding: SPACING.lg },
  backButton: { padding: SPACING.sm, marginLeft: -SPACING.sm },
  saveButton: { padding: SPACING.sm, marginRight: -SPACING.sm },
  saveText: {
    fontSize: TYPOGRAPHY.size.md,
    fontFamily: TYPOGRAPHY.fontFamily.semiBold,
  },
});
