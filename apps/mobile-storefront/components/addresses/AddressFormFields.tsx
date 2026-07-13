import Ionicons from '@react-native-vector-icons/ionicons';
import {
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import type Colors from '@/constants/Colors';
import { TextContentTypes } from '@/hooks/use-keyboard';
import { addressFormStyles as styles } from './address-form.styles';
import { ADDRESS_FORM_LABELS, NIGERIA_STATES } from './constants';
import { getAddressLabelIcon } from './get-address-label-icon';
import type { AddressFormData } from './types';

type AddressFormFieldsProps = {
  colors: typeof Colors.light;
  errors: Partial<AddressFormData>;
  form: AddressFormData;
  onUpdateField: (
    field: keyof AddressFormData,
    value: string | boolean
  ) => void;
};

export function AddressFormFields({
  colors,
  errors,
  form,
  onUpdateField,
}: AddressFormFieldsProps) {
  return (
    <ScrollView
      contentContainerStyle={styles.content}
      contentInsetAdjustmentBehavior="automatic"
      showsVerticalScrollIndicator={false}
      keyboardDismissMode="on-drag"
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.section}>
        <Text style={[styles.label, { color: colors.text }]}>
          Address Label
        </Text>
        <View style={styles.labelOptions}>
          {ADDRESS_FORM_LABELS.map((label) => {
            const selected = form.label === label;

            return (
              <TouchableOpacity
                accessibilityLabel={`Use ${label} address label`}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                key={label}
                style={[
                  styles.labelOption,
                  { borderColor: colors.border },
                  selected && {
                    borderColor: colors.primary,
                    backgroundColor: colors.primaryLowOpacity,
                  },
                ]}
                onPress={() => onUpdateField('label', label)}
              >
                <Ionicons
                  name={getAddressLabelIcon(label)}
                  size={18}
                  color={selected ? colors.primary : colors.textSecondary}
                />
                <Text
                  style={[
                    styles.labelOptionText,
                    { color: selected ? colors.primary : colors.text },
                  ]}
                >
                  {label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={[styles.label, { color: colors.text }]}>Full Name *</Text>
        <TextInput
          style={[
            styles.input,
            {
              backgroundColor: colors.muted,
              color: colors.text,
              borderColor: errors.full_name ? colors.error : colors.border,
            },
          ]}
          accessibilityLabel="Full Name"
          value={form.full_name}
          onChangeText={(value) => onUpdateField('full_name', value)}
          placeholder="Enter full name"
          placeholderTextColor={colors.placeholder}
          textContentType={TextContentTypes.name}
          autoComplete="name"
          returnKeyType="next"
        />
        {errors.full_name ? (
          <Text style={[styles.errorText, { color: colors.error }]}>
            {errors.full_name}
          </Text>
        ) : null}
      </View>

      <View style={styles.section}>
        <Text style={[styles.label, { color: colors.text }]}>
          Phone Number *
        </Text>
        <TextInput
          style={[
            styles.input,
            {
              backgroundColor: colors.muted,
              color: colors.text,
              borderColor: errors.phone ? colors.error : colors.border,
            },
          ]}
          accessibilityLabel="Phone Number"
          value={form.phone}
          onChangeText={(value) => onUpdateField('phone', value)}
          placeholder="e.g. 08012345678"
          placeholderTextColor={colors.placeholder}
          keyboardType="phone-pad"
          textContentType={TextContentTypes.telephoneNumber}
          autoComplete="tel"
          returnKeyType="next"
        />
        {errors.phone ? (
          <Text style={[styles.errorText, { color: colors.error }]}>
            {errors.phone}
          </Text>
        ) : null}
      </View>

      <View style={styles.section}>
        <Text style={[styles.label, { color: colors.text }]}>
          Street Address *
        </Text>
        <TextInput
          style={[
            styles.input,
            styles.textArea,
            {
              backgroundColor: colors.muted,
              color: colors.text,
              borderColor: errors.address ? colors.error : colors.border,
            },
          ]}
          accessibilityLabel="Street Address"
          value={form.address}
          onChangeText={(value) => onUpdateField('address', value)}
          placeholder="Enter street address"
          placeholderTextColor={colors.placeholder}
          multiline
          numberOfLines={3}
          textContentType={TextContentTypes.fullStreetAddress}
          autoComplete="street-address"
        />
        {errors.address ? (
          <Text style={[styles.errorText, { color: colors.error }]}>
            {errors.address}
          </Text>
        ) : null}
      </View>

      <View style={styles.section}>
        <Text style={[styles.label, { color: colors.text }]}>City *</Text>
        <TextInput
          style={[
            styles.input,
            {
              backgroundColor: colors.muted,
              color: colors.text,
              borderColor: errors.city ? colors.error : colors.border,
            },
          ]}
          accessibilityLabel="City"
          value={form.city}
          onChangeText={(value) => onUpdateField('city', value)}
          placeholder="Enter city"
          placeholderTextColor={colors.placeholder}
          textContentType={TextContentTypes.addressCity}
          autoComplete="postal-address-locality"
          returnKeyType="next"
        />
        {errors.city ? (
          <Text style={[styles.errorText, { color: colors.error }]}>
            {errors.city}
          </Text>
        ) : null}
      </View>

      <View style={styles.section}>
        <Text style={[styles.label, { color: colors.text }]}>State *</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.statesContainer}
        >
          {NIGERIA_STATES.map((state) => {
            const selected = form.state === state;

            return (
              <TouchableOpacity
                accessibilityLabel={`Select ${state} state`}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                key={state}
                style={[
                  styles.stateChip,
                  { borderColor: colors.border },
                  selected && {
                    borderColor: colors.primary,
                    backgroundColor: colors.primaryLowOpacity,
                  },
                ]}
                onPress={() => onUpdateField('state', state)}
              >
                <Text
                  style={[
                    styles.stateChipText,
                    { color: selected ? colors.primary : colors.text },
                  ]}
                >
                  {state}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      <View style={styles.section}>
        <Text style={[styles.label, { color: colors.text }]}>
          Postal Code (Optional)
        </Text>
        <TextInput
          style={[
            styles.input,
            {
              backgroundColor: colors.muted,
              color: colors.text,
              borderColor: colors.border,
            },
          ]}
          accessibilityLabel="Postal Code"
          value={form.postal_code}
          onChangeText={(value) => onUpdateField('postal_code', value)}
          placeholder="Enter postal code"
          placeholderTextColor={colors.placeholder}
          keyboardType="number-pad"
        />
      </View>

      <TouchableOpacity
        style={[styles.defaultToggle, { backgroundColor: colors.muted }]}
        onPress={() => onUpdateField('is_default', !form.is_default)}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: form.is_default }}
        accessibilityLabel="Set as default address"
        accessibilityHint="Use this address for all orders"
      >
        <View style={styles.defaultToggleContent}>
          <Ionicons
            name={form.is_default ? 'checkbox' : 'square-outline'}
            size={24}
            color={form.is_default ? colors.primary : colors.textSecondary}
          />
          <View>
            <Text style={[styles.defaultToggleText, { color: colors.text }]}>
              Set as default address
            </Text>
            <Text
              style={[
                styles.defaultToggleHint,
                { color: colors.textSecondary },
              ]}
            >
              Use this address for all orders
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    </ScrollView>
  );
}
