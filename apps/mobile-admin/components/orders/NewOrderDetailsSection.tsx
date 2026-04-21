import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { useEffect } from 'react';
import { Platform, Pressable, Switch, Text, TextInput, View } from 'react-native';
import { GooglePlacesAutocomplete } from 'react-native-google-places-autocomplete';
import type { useNewOrderController } from '@/hooks/useNewOrderController';
import { styles } from './new-order.styles';

interface NewOrderDetailsSectionProps {
  controller: ReturnType<typeof useNewOrderController>;
}

export function NewOrderDetailsSection({
  controller,
}: NewOrderDetailsSectionProps) {
  const {
    colors,
    customer,
    date,
    deliveryInfo,
    sameAsCustomer,
    setDate,
    setDeliveryInfo,
    setSameAsCustomer,
    setShowCustomerModal,
    setShowDatePicker,
    showDatePicker,
  } = controller;
  const googleMapsApiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;
  const hasGoogleMapsApiKey = Boolean(googleMapsApiKey);

  useEffect(() => {
    if (!hasGoogleMapsApiKey && __DEV__) {
      console.warn(
        '[NewOrderDetailsSection] Missing EXPO_PUBLIC_GOOGLE_MAPS_API_KEY'
      );
    }
  }, [hasGoogleMapsApiKey]);

  return (
    <>
      <View style={[styles.card, { backgroundColor: colors.card }]}>
        <Pressable
          onPress={() => setShowDatePicker((previous) => !previous)}
          style={[
            styles.listRow,
            { borderBottomColor: colors.border, borderBottomWidth: 1 },
          ]}
        >
          <View
            style={[styles.iconBox, { backgroundColor: colors.backgroundLight }]}
          >
            <Ionicons color={colors.primary} name="calendar-outline" size={20} />
          </View>
          <Text style={[styles.listLabel, { color: colors.text }]}>Date</Text>
          <View style={{ alignItems: 'center', flexDirection: 'row', gap: 6 }}>
            <Text style={[styles.listValue, { color: colors.textSecondary }]}>
              {format(date, 'MMM dd, yyyy')}
            </Text>
            <Ionicons
              color={colors.textMuted}
              name={showDatePicker ? 'chevron-up' : 'chevron-down'}
              size={14}
            />
          </View>
        </Pressable>

        {showDatePicker && (
          <DateTimePicker
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            maximumDate={new Date()}
            mode="date"
            onChange={(_event, selectedDate) => {
              if (Platform.OS === 'android') {
                setShowDatePicker(false);
              }
              if (selectedDate) {
                setDate(selectedDate);
              }
            }}
            value={date}
          />
        )}

        <Pressable
          onPress={() => setShowCustomerModal(true)}
          style={styles.listRow}
        >
          <View
            style={[styles.iconBox, { backgroundColor: colors.backgroundLight }]}
          >
            <Ionicons color={colors.primary} name="person-outline" size={20} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.listLabel, { color: colors.text }]}>
              Customer
            </Text>
            {customer.name ? (
              <Text style={[styles.listSubValue, { color: colors.success }]}>
                {customer.name}
                {customer.phone ? ` • ${customer.phone}` : ''}
              </Text>
            ) : null}
          </View>
          <View style={{ alignItems: 'center', flexDirection: 'row', gap: 8 }}>
            {!customer.name ? (
              <Text
                style={{
                  color: colors.primary,
                  fontSize: 14,
                  fontWeight: '500',
                }}
              >
                Select
              </Text>
            ) : null}
            <Ionicons
              color={colors.textMuted}
              name="chevron-forward"
              size={18}
            />
          </View>
        </Pressable>
      </View>

      <View style={[styles.card, { backgroundColor: colors.card, marginTop: 16 }]}>
        <View
          style={[
            styles.listRow,
            {
              borderBottomColor: !sameAsCustomer ? colors.border : 'transparent',
              borderBottomWidth: !sameAsCustomer ? 1 : 0,
            },
          ]}
        >
          <View
            style={[styles.iconBox, { backgroundColor: colors.backgroundLight }]}
          >
            <Ionicons color={colors.primary} name="location-outline" size={20} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.listLabel, { color: colors.text }]}>
              Delivery Details
            </Text>
            <Text style={[styles.listSubValue, { color: colors.textSecondary }]}>
              {sameAsCustomer
                ? 'Deliver to same person'
                : 'Deliver to different person'}
            </Text>
          </View>
          <Switch
            onValueChange={setSameAsCustomer}
            thumbColor={
              Platform.OS === 'ios'
                ? '#fff'
                : sameAsCustomer
                  ? '#fff'
                  : '#f4f3f4'
            }
            trackColor={{ false: colors.border, true: colors.primary }}
            value={sameAsCustomer}
          />
        </View>

        {!sameAsCustomer ? (
          <View style={{ gap: 12, padding: 16 }}>
            <View>
              <Text
                style={[styles.label, { color: colors.textSecondary, marginBottom: 4 }]}
              >
                Recipient Name
              </Text>
              <TextInput
                onChangeText={(text) =>
                  setDeliveryInfo((previous) => ({ ...previous, name: text }))
                }
                placeholder="e.g. Jane Doe"
                placeholderTextColor={colors.textMuted}
                style={[
                  styles.input,
                  {
                    backgroundColor: colors.background,
                    borderColor: colors.border,
                    borderWidth: 1,
                    color: colors.text,
                  },
                ]}
                value={deliveryInfo.name}
              />
            </View>

            <View>
              <Text
                style={[styles.label, { color: colors.textSecondary, marginBottom: 4 }]}
              >
                Recipient Phone
              </Text>
              <TextInput
                keyboardType="phone-pad"
                onChangeText={(text) =>
                  setDeliveryInfo((previous) => ({ ...previous, phone: text }))
                }
                placeholder="e.g. 080..."
                placeholderTextColor={colors.textMuted}
                style={[
                  styles.input,
                  {
                    backgroundColor: colors.background,
                    borderColor: colors.border,
                    borderWidth: 1,
                    color: colors.text,
                  },
                ]}
                value={deliveryInfo.phone}
              />
            </View>

            <View style={{ zIndex: 5 }}>
              <Text
                style={[styles.label, { color: colors.textSecondary, marginBottom: 4 }]}
              >
                Delivery Address
              </Text>
              {hasGoogleMapsApiKey ? (
                <GooglePlacesAutocomplete
                  debounce={300}
                  enablePoweredByContainer={false}
                  fetchDetails
                  keyboardShouldPersistTaps="handled"
                  listViewDisplayed="auto"
                  nearbyPlacesAPI="GooglePlacesSearch"
                  onPress={(data, details = null) => {
                    if (!details) {
                      return;
                    }

                    let city = '';
                    let state = '';
                    details.address_components.forEach((component) => {
                      if (component.types.includes('locality')) {
                        city = component.long_name;
                      }
                      if (component.types.includes('administrative_area_level_1')) {
                        state = component.long_name;
                      }
                    });

                    setDeliveryInfo((previous) => ({
                      ...previous,
                      address: data.description,
                      city,
                      state,
                    }));
                  }}
                  placeholder="Enter delivery address"
                  query={{
                    key: googleMapsApiKey,
                    language: 'en',
                  }}
                  styles={{
                    container: { flex: 0 },
                    description: { color: colors.text },
                    listView: {
                      backgroundColor: colors.textOnPrimary,
                      borderColor: colors.border,
                      borderRadius: 8,
                      borderWidth: 1,
                      left: 0,
                      marginTop: 4,
                      position: 'absolute',
                      right: 0,
                      top: 50,
                      zIndex: 1000,
                    },
                    row: { backgroundColor: 'transparent', padding: 12 },
                    separator: { backgroundColor: colors.border },
                  }}
                  textInputProps={{
                    onChangeText: (text) =>
                      setDeliveryInfo((previous) => ({ ...previous, address: text })),
                    placeholderTextColor: colors.textMuted,
                    style: {
                      backgroundColor: colors.background,
                      borderColor: colors.border,
                      borderRadius: 8,
                      borderWidth: 1,
                      color: colors.text,
                      fontSize: 16,
                      paddingHorizontal: 12,
                      paddingVertical: 12,
                    },
                    value: deliveryInfo.address,
                  }}
                />
              ) : (
                <>
                  <TextInput
                    onChangeText={(text) =>
                      setDeliveryInfo((previous) => ({ ...previous, address: text }))
                    }
                    placeholder="Enter delivery address"
                    placeholderTextColor={colors.textMuted}
                    style={[
                      styles.input,
                      {
                        backgroundColor: colors.background,
                        borderColor: colors.border,
                        borderWidth: 1,
                        color: colors.text,
                      },
                    ]}
                    value={deliveryInfo.address}
                  />
                  <Text style={[styles.listSubValue, { color: colors.warning }]}>
                    Address suggestions are unavailable because Google Maps is not configured.
                  </Text>
                </>
              )}
            </View>
          </View>
        ) : null}
      </View>
    </>
  );
}
