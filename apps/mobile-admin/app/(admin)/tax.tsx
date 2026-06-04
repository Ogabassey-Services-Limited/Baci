import { NIGERIAN_STATES } from '@baci/shared';
import { Stack } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Alert, ScrollView, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AddressCard } from '@/components/tax/AddressCard';
import {
  buildAddressSyncSignature,
  buildMerchantAddressSyncState,
  buildTaxSyncSignature,
} from '@/components/tax/form-sync';
import { LegalEntityCard } from '@/components/tax/LegalEntityCard';
import { StatePickerModal } from '@/components/tax/StatePickerModal';
import { styles } from '@/components/tax/styles';
import { TaxNoticeCard } from '@/components/tax/TaxNoticeCard';
import { TinCard } from '@/components/tax/TinCard';
import { VatCard } from '@/components/tax/VatCard';
import { VatInfoCard } from '@/components/tax/VatInfoCard';
import { ScreenSkeleton } from '@/components/ui/ScreenSkeleton';
import { useMerchant } from '@/hooks/useMerchant';
import { useTaxMutations } from '@/hooks/useTaxMutations';
import { useTheme } from '@/hooks/useTheme';
export default function TaxScreen() {
  const { colors, shadows, isDark } = useTheme();
  const { merchant, isLoading } = useMerchant();
  const screenOptions = {
    title: 'Tax Settings',
    headerTintColor: colors.text,
    headerStyle: { backgroundColor: colors.background },
    headerShadowVisible: false,
  };
  const [vatEnabled, setVatEnabled] = useState(
    merchant?.vat_registration_status === 'registered'
  );
  const [taxId, setTaxId] = useState(merchant?.tax_identification_number ?? '');
  const [legalEntityName, setLegalEntityName] = useState(
    merchant?.legal_entity_name ?? ''
  );
  const [street, setStreet] = useState('');
  const [city, setCity] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [stateCode, setStateCode] = useState('');
  const [showStateModal, setShowStateModal] = useState(false);

  const lastSyncedAddressSignature = useRef('');
  const lastSyncedTaxSignature = useRef('');
  const merchantId = merchant?.id ?? null;
  const merchantAddress = merchant?.registered_address ?? null;
  const merchantStateCode = merchant?.state_code ?? '';
  const merchantVatRegistrationStatus =
    merchant?.vat_registration_status ?? 'not_registered';
  const merchantTaxIdentificationNumber =
    merchant?.tax_identification_number ?? '';
  const merchantLegalEntityName = merchant?.legal_entity_name ?? '';
  useEffect(() => {
    const { mappedStateCode, signature: nextAddressSignature } =
      buildMerchantAddressSyncState({
        merchantId,
        merchantAddress,
        merchantStateCode,
      });
    const currentAddressSignature = buildAddressSyncSignature({
      merchantId,
      street,
      city,
      postalCode,
      stateCode,
    });

    if (!merchantId) {
      lastSyncedAddressSignature.current = '';
      setStreet('');
      setCity('');
      setPostalCode('');
      setStateCode('');
      return;
    }

    if (currentAddressSignature === nextAddressSignature) {
      lastSyncedAddressSignature.current = nextAddressSignature;
      return;
    }
    if (
      lastSyncedAddressSignature.current &&
      currentAddressSignature !== lastSyncedAddressSignature.current
    ) {
      return;
    }

    lastSyncedAddressSignature.current = nextAddressSignature;
    setStreet(merchantAddress?.street ?? '');
    setCity(merchantAddress?.city ?? '');
    setPostalCode(merchantAddress?.postal_code ?? '');
    setStateCode(mappedStateCode);
  }, [
    city,
    merchantAddress,
    merchantId,
    merchantStateCode,
    postalCode,
    stateCode,
    street,
  ]);
  const {
    saveAddressMutation,
    saveLegalEntityMutation,
    saveTinMutation,
    updateVatMutation,
  } = useTaxMutations({
    city,
    postalCode,
    setVatEnabled,
    stateCode,
    street,
  });
  const handleToggleVat = () => {
    const newValue = !vatEnabled;
    Alert.alert(
      newValue ? 'Enable VAT?' : 'Disable VAT?',
      newValue
        ? '7.5% VAT will be added to all orders. Make sure you are registered with FIRS before enabling.'
        : 'VAT will no longer be applied to orders.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: newValue ? 'Enable' : 'Disable',
          style: newValue ? 'default' : 'destructive',
          onPress: () => updateVatMutation.mutate(newValue),
        },
      ]
    );
  };
  const handleTaxIdChange = (text: string) =>
    setTaxId(text.replace(/\D/g, '').slice(0, 10));
  const selectedStateName =
    NIGERIAN_STATES.find((state) => state.code === stateCode)?.name ?? '';
  useEffect(() => {
    const nextTaxSignature = buildTaxSyncSignature({
      merchantId,
      vatRegistrationStatus: merchantVatRegistrationStatus,
      taxIdentificationNumber: merchantTaxIdentificationNumber,
      legalEntityName: merchantLegalEntityName,
    });
    const currentTaxSignature = buildTaxSyncSignature({
      merchantId,
      vatRegistrationStatus: vatEnabled ? 'registered' : 'not_registered',
      taxIdentificationNumber: taxId,
      legalEntityName,
    });

    if (!merchantId) {
      lastSyncedTaxSignature.current = '';
      setVatEnabled(false);
      setTaxId('');
      setLegalEntityName('');
      return;
    }

    if (currentTaxSignature === nextTaxSignature) {
      lastSyncedTaxSignature.current = nextTaxSignature;
      return;
    }
    if (
      lastSyncedTaxSignature.current &&
      currentTaxSignature !== lastSyncedTaxSignature.current
    ) {
      return;
    }
    if (lastSyncedTaxSignature.current === nextTaxSignature) return;

    lastSyncedTaxSignature.current = nextTaxSignature;
    setVatEnabled(merchantVatRegistrationStatus === 'registered');
    setTaxId(merchantTaxIdentificationNumber);
    setLegalEntityName(merchantLegalEntityName);
  }, [
    legalEntityName,
    merchantId,
    merchantLegalEntityName,
    merchantTaxIdentificationNumber,
    merchantVatRegistrationStatus,
    taxId,
    vatEnabled,
  ]);
  if (isLoading) {
    return (
      <>
        <Stack.Screen options={screenOptions} />
        <SafeAreaView
          style={[styles.container, { backgroundColor: colors.background }]}
          edges={['bottom']}
        >
          <ScreenSkeleton variant="settings" cards={6} />
        </SafeAreaView>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={screenOptions} />
      <SafeAreaView
        style={[styles.container, { backgroundColor: colors.background }]}
        edges={['bottom']}
      >
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <VatCard
            colors={colors}
            shadowStyle={shadows.sm}
            vatEnabled={vatEnabled}
            isPending={updateVatMutation.isPending}
            onToggle={handleToggleVat}
          />
          <VatInfoCard
            colors={colors}
            shadowStyle={shadows.sm}
            vatRate={merchant?.vat_rate}
            country={merchant?.country}
          />
          <TinCard
            colors={colors}
            shadowStyle={shadows.sm}
            taxId={taxId}
            isPending={saveTinMutation.isPending}
            onChangeText={handleTaxIdChange}
            onSave={() => saveTinMutation.mutate(taxId)}
          />
          <LegalEntityCard
            colors={colors}
            shadowStyle={shadows.sm}
            legalEntityName={legalEntityName}
            isPending={saveLegalEntityMutation.isPending}
            onChangeText={setLegalEntityName}
            onSave={() => saveLegalEntityMutation.mutate(legalEntityName)}
          />
          <AddressCard
            colors={colors}
            shadowStyle={shadows.sm}
            street={street}
            city={city}
            postalCode={postalCode}
            selectedStateName={selectedStateName}
            isPending={saveAddressMutation.isPending}
            onStreetChange={setStreet}
            onCityChange={setCity}
            onPostalCodeChange={setPostalCode}
            onOpenStatePicker={() => setShowStateModal(true)}
            onSave={() => saveAddressMutation.mutate()}
          />
          <TaxNoticeCard colors={colors} />
        </ScrollView>
      </SafeAreaView>
      <StatePickerModal
        visible={showStateModal}
        colors={colors}
        selectedStateCode={stateCode}
        onClose={() => setShowStateModal(false)}
        onSelect={(nextStateCode) => {
          setStateCode(nextStateCode);
          setShowStateModal(false);
        }}
      />
    </>
  );
}
