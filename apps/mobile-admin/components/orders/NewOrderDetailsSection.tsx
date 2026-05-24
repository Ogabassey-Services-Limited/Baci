import Ionicons from "@react-native-vector-icons/ionicons/static";
import { format } from 'date-fns';
import { useEffect } from 'react';
import { Pressable, Switch, Text, TextInput, View } from 'react-native';
import type { useNewOrderController } from '@/hooks/useNewOrderController';
import { AppDatePickerField } from '@/components/ui/AppDatePickerField';
import { NewOrderAddressInput } from './NewOrderAddressInput';
import { NewOrderBranchSelector } from './NewOrderBranchSelector';
import { styles } from './new-order.styles';

interface NewOrderDetailsSectionProps {
  controller: ReturnType<typeof useNewOrderController>;
}

export function NewOrderDetailsSection({
  controller,
}: NewOrderDetailsSectionProps) {
  const {
    colors,
    branches,
    customer,
    date,
    deliveryInfo,
    sameAsCustomer,
    selectedBranchId,
    setDate,
    setDeliveryInfo,
    setSelectedBranchId,
    setSameAsCustomer,
    setShowCustomerModal,
    setShowDatePicker,
    showDatePicker,
  } = controller;

  const googleMapsApiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;

  useEffect(() => {
    if (!googleMapsApiKey && __DEV__) {
      console.warn(
        '[NewOrderDetailsSection] Missing EXPO_PUBLIC_GOOGLE_MAPS_API_KEY'
      );
    }
  }, [googleMapsApiKey]);

  const deliveryLabelStyle = [
    styles.label,
    { color: colors.textSecondary, marginBottom: 4 },
  ];
  const deliveryInputStyle = [
    styles.input,
    {
      backgroundColor: colors.background,
      borderColor: colors.border,
      borderWidth: 1,
      color: colors.text,
    },
  ];

  return (
    <>
      <View style={[styles.card, { backgroundColor: colors.card }]}>
        <Pressable
          accessibilityHint={
            showDatePicker
              ? 'Closes the calendar'
              : 'Opens a calendar to change the order date'
          }
          accessibilityLabel="Select order date"
          accessibilityRole="button"
          accessibilityState={{ expanded: showDatePicker }}
          onPress={() => setShowDatePicker((previous) => !previous)}
          style={({ pressed }) => [
            styles.listRow,
            { borderBottomColor: colors.border, borderBottomWidth: 1 },
            pressed && { opacity: 0.7 },
          ]}
        >
          <View
            style={[
              styles.iconBox,
              { backgroundColor: colors.backgroundLight },
            ]}
          >
            <Ionicons
              color={colors.primary}
              name="calendar-outline"
              size={20}
            />
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

        {showDatePicker ? (
          <AppDatePickerField
            cancelTextColor={colors.textMuted}
            confirmTextColor={colors.primary}
            maximumDate={new Date()}
            onClose={() => setShowDatePicker(false)}
            onConfirm={setDate}
            value={date}
          />
        ) : null}

        <Pressable
          accessibilityHint="Opens a modal to select or create a customer"
          accessibilityLabel="Select customer"
          accessibilityRole="button"
          onPress={() => setShowCustomerModal(true)}
          style={({ pressed }) => [styles.listRow, pressed && { opacity: 0.7 }]}
        >
          <View
            style={[
              styles.iconBox,
              { backgroundColor: colors.backgroundLight },
            ]}
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

        <NewOrderBranchSelector
          branches={branches}
          selectedBranchId={selectedBranchId}
          setSelectedBranchId={setSelectedBranchId}
          colors={colors}
          styles={styles}
        />
      </View>

      <View
        style={[styles.card, { backgroundColor: colors.card, marginTop: 16 }]}
      >
        <View
          style={[
            styles.listRow,
            {
              borderBottomColor: !sameAsCustomer
                ? colors.border
                : 'transparent',
              borderBottomWidth: !sameAsCustomer ? 1 : 0,
            },
          ]}
        >
          <View
            style={[
              styles.iconBox,
              { backgroundColor: colors.backgroundLight },
            ]}
          >
            <Ionicons
              color={colors.primary}
              name="location-outline"
              size={20}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.listLabel, { color: colors.text }]}>
              Delivery Details
            </Text>
            <Text
              style={[styles.listSubValue, { color: colors.textSecondary }]}
            >
              {sameAsCustomer
                ? 'Deliver to same person'
                : 'Deliver to different person'}
            </Text>
          </View>
          <Switch
            accessibilityHint="Toggles whether the delivery address is the same as the customer's address"
            accessibilityLabel="Deliver to same person"
            accessibilityRole="switch"
            accessibilityState={{ checked: sameAsCustomer }}
            onValueChange={setSameAsCustomer}
            thumbColor={
              sameAsCustomer ? '#fff' : '#f4f3f4'
            }
            trackColor={{ false: colors.border, true: colors.primary }}
            value={sameAsCustomer}
          />
        </View>

        {!sameAsCustomer ? (
          <View style={{ gap: 12, padding: 16 }}>
            <View>
              <Text style={deliveryLabelStyle}>Recipient Name</Text>
              <TextInput
                onChangeText={(value) =>
                  setDeliveryInfo((previous) => ({ ...previous, name: value }))
                }
                placeholder="e.g. Jane Doe"
                placeholderTextColor={colors.textMuted}
                style={deliveryInputStyle}
                value={deliveryInfo.name}
              />
            </View>

            <View>
              <Text style={deliveryLabelStyle}>Recipient Phone</Text>
              <TextInput
                keyboardType="phone-pad"
                onChangeText={(value) =>
                  setDeliveryInfo((previous) => ({ ...previous, phone: value }))
                }
                placeholder="e.g. 080..."
                placeholderTextColor={colors.textMuted}
                style={deliveryInputStyle}
                value={deliveryInfo.phone}
              />
            </View>

            <NewOrderAddressInput
              controller={controller}
              googleMapsApiKey={googleMapsApiKey}
            />
          </View>
        ) : null}
      </View>
    </>
  );
}
