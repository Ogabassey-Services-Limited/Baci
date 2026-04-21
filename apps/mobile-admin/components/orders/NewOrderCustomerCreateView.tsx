import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { GooglePlacesAutocomplete } from 'react-native-google-places-autocomplete';
import PhoneInput from 'react-native-phone-number-input';
import type { useNewOrderController } from '@/hooks/useNewOrderController';
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
  const hasGoogleMapsApiKey = Boolean(googleMapsApiKey);

  return (
    <ScrollView
      contentContainerStyle={{ gap: 16, padding: 16 }}
      keyboardShouldPersistTaps="handled"
    >
      {duplicateCustomer ? (
        <View
          style={{
            backgroundColor: colors.warningLight,
            borderColor: colors.warning,
            borderRadius: 12,
            borderWidth: 1,
            gap: 8,
            padding: 12,
          }}
        >
          <Text style={{ color: colors.warning, fontWeight: '600' }}>
            ⚠️ Customer Already Exists
          </Text>
          <Pressable
            onPress={() => {
              handleSelectCustomer(duplicateCustomer);
              setDuplicateCustomer(null);
              setIsCreatingCustomer(false);
              resetNewCustomerForm();
            }}
            style={{
              alignItems: 'center',
              backgroundColor: colors.card,
              borderRadius: 8,
              flexDirection: 'row',
              gap: 12,
              padding: 12,
            }}
          >
            <View
              style={{
                alignItems: 'center',
                backgroundColor: colors.primary,
                borderRadius: 20,
                height: 40,
                justifyContent: 'center',
                width: 40,
              }}
            >
              <Text
                style={{
                  color: colors.textOnPrimary,
                  fontSize: 16,
                  fontWeight: 'bold',
                }}
              >
                {duplicateCustomer.first_name?.[0]?.toUpperCase() || '?'}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.text, fontWeight: '600' }}>
                {duplicateCustomer.first_name} {duplicateCustomer.last_name}
              </Text>
              <Text style={{ color: colors.textMuted, fontSize: 13 }}>
                {duplicateCustomer.phone}
              </Text>
            </View>
            <View
              style={{
                backgroundColor: colors.primary,
                borderRadius: 6,
                paddingHorizontal: 12,
                paddingVertical: 6,
              }}
            >
              <Text
                style={{
                  color: colors.textOnPrimary,
                  fontSize: 13,
                  fontWeight: '600',
                }}
              >
                Use This
              </Text>
            </View>
          </Pressable>
        </View>
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

      <View style={{ gap: 8, zIndex: 10 }}>
        <Text style={{ color: colors.textSecondary }}>Address</Text>
        {hasGoogleMapsApiKey ? (
          <GooglePlacesAutocomplete
            debounce={300}
            enablePoweredByContainer
            fetchDetails={false}
            keepResultsAfterBlur
            keyboardShouldPersistTaps="handled"
            listViewDisplayed="auto"
            minLength={2}
            onFail={(error) => {
              if (__DEV__) {
                console.log('Google Places Error:', error);
              }
              Alert.alert(
                'Address search failed',
                'Try entering the address manually.'
              );
            }}
            onNotFound={() => {
              if (__DEV__) {
                console.log('Google Places: No results');
              }
              Alert.alert(
                'Address not found',
                'Try refining the address or enter it manually.'
              );
            }}
            onPress={(data) => {
              setNewCustomer((previous) => ({
                ...previous,
                address: data.description,
              }));
            }}
            placeholder="Search Address"
            query={{
              components: selectedCountryCode
                ? `country:${selectedCountryCode.toLowerCase()}`
                : undefined,
              key: googleMapsApiKey,
              language: 'en',
            }}
            styles={{
              container: { flex: 0, zIndex: 999 },
              description: { color: colors.text },
              listView: {
                backgroundColor: colors.card,
                borderRadius: 12,
                elevation: 5,
                left: 0,
                marginTop: 4,
                position: 'absolute',
                right: 0,
                top: 54,
                zIndex: 1000,
              },
              poweredContainer: {
                backgroundColor: colors.card,
                borderBottomLeftRadius: 12,
                borderBottomRightRadius: 12,
              },
              row: {
                backgroundColor: colors.card,
                padding: 13,
              },
              textInput: {
                backgroundColor: colors.inputBg,
                borderRadius: 12,
                color: colors.text,
                fontSize: 16,
                height: 50,
                paddingHorizontal: 16,
              },
            }}
            textInputProps={{ placeholderTextColor: colors.textMuted }}
          />
        ) : (
          <TextInput
            onChangeText={(text) =>
              setNewCustomer((previous) => ({ ...previous, address: text }))
            }
            placeholder="Enter address"
            placeholderTextColor={colors.textMuted}
            style={[
              styles.sheetInput,
              { backgroundColor: colors.inputBg, color: colors.text },
            ]}
            value={newCustomer.address}
          />
        )}
      </View>

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
