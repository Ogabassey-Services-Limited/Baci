import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import PhoneInput from 'react-native-phone-number-input';
import type { useNewOrderController } from '@/hooks/useNewOrderController';
import { DuplicateCustomerBanner } from './DuplicateCustomerBanner';
import { NewCustomerAddressInput } from './NewCustomerAddressInput';
import { DEFAULT_COUNTRY_CODE } from './new-order.shared';
import { styles } from './new-order.styles';

interface NewOrderCustomerCreateViewProps {
  controller: ReturnType<typeof useNewOrderController>;
}

export function NewOrderCustomerCreateView({
  controller,
}: NewOrderCustomerCreateViewProps) {
  const {
    colors,
    createCustomerMutation,
    duplicateCustomer,
    handleCreateCustomer,
    handleSelectCustomer,
    newCustomer,
    resetNewCustomerForm,
    selectedCountryCode,
    setDuplicateCustomer,
    setIsCreatingCustomer,
    setNewCustomer,
    setSelectedCountryCode,
  } = controller;

  const googleMapsApiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;

  return (
    <ScrollView
      contentContainerStyle={{ gap: 16, padding: 16 }}
      keyboardShouldPersistTaps="handled"
    >
      {duplicateCustomer ? (
        <DuplicateCustomerBanner
          colors={colors}
          duplicateCustomer={duplicateCustomer}
          handleSelectCustomer={handleSelectCustomer}
          resetNewCustomerForm={resetNewCustomerForm}
          setDuplicateCustomer={setDuplicateCustomer}
          setIsCreatingCustomer={setIsCreatingCustomer}
        />
      ) : null}

      <View style={{ gap: 8 }}>
        <Text style={{ color: colors.textSecondary }}>Personal Info</Text>
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <TextInput
            onChangeText={(text) =>
              setNewCustomer((previous) => ({ ...previous, firstName: text }))
            }
            placeholder="First Name"
            placeholderTextColor={colors.textMuted}
            style={[
              styles.sheetInput,
              { backgroundColor: colors.inputBg, color: colors.text, flex: 1 },
            ]}
            value={newCustomer.firstName}
          />
          <TextInput
            onChangeText={(text) =>
              setNewCustomer((previous) => ({ ...previous, lastName: text }))
            }
            placeholder="Last Name"
            placeholderTextColor={colors.textMuted}
            style={[
              styles.sheetInput,
              { backgroundColor: colors.inputBg, color: colors.text, flex: 1 },
            ]}
            value={newCustomer.lastName}
          />
        </View>
      </View>

      <View style={{ gap: 8, zIndex: 5 }}>
        <Text style={{ color: colors.textSecondary }}>Contact Info</Text>
        <PhoneInput
          containerStyle={{
            backgroundColor: colors.inputBg,
            borderRadius: 12,
            height: 54,
            width: '100%',
          }}
          defaultCode={selectedCountryCode || DEFAULT_COUNTRY_CODE}
          defaultValue={newCustomer.phone}
          layout="first"
          onChangeCountry={(country) => {
            setSelectedCountryCode(country.cca2);
          }}
          onChangeFormattedText={(text) => {
            setNewCustomer((previous) => ({ ...previous, phone: text }));
          }}
          placeholder="Mobile Phone"
          textContainerStyle={{
            backgroundColor: 'transparent',
            borderRadius: 12,
          }}
          textInputStyle={{
            color: colors.text,
            height: 50,
          }}
          withDarkTheme
          withShadow={false}
        />
        <TextInput
          autoCapitalize="none"
          keyboardType="email-address"
          onChangeText={(text) =>
            setNewCustomer((previous) => ({ ...previous, email: text }))
          }
          placeholder="Email Address (Optional)"
          placeholderTextColor={colors.textMuted}
          style={[
            styles.sheetInput,
            { backgroundColor: colors.inputBg, color: colors.text },
          ]}
          value={newCustomer.email}
        />
      </View>

      <NewCustomerAddressInput
        address={newCustomer.address}
        colors={colors}
        googleMapsApiKey={googleMapsApiKey}
        selectedCountryCode={selectedCountryCode}
        setNewCustomer={setNewCustomer}
      />

      <Pressable
        disabled={createCustomerMutation.isPending}
        onPress={handleCreateCustomer}
        style={[
          styles.payBtn,
          {
            backgroundColor: colors.primary,
            justifyContent: 'center',
            marginTop: 16,
          },
        ]}
      >
        {createCustomerMutation.isPending ? (
          <ActivityIndicator color={colors.textOnPrimary} />
        ) : (
          <Text style={[styles.payBtnText, { color: colors.textOnPrimary }]}>
            Save Customer
          </Text>
        )}
      </Pressable>
    </ScrollView>
  );
}
