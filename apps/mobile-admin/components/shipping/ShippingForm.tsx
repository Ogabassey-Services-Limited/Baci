import Ionicons from "@react-native-vector-icons/ionicons/static";
import {
  ActivityIndicator,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { ThemeColors, ThemeShadows } from '@/constants/theme';
import { formatCurrency } from '@/lib/utils';
import { styles } from './shipping-styles';
import type { ShippingSettings } from './shipping-types';

interface ShippingFormProps {
  colors: ThemeColors;
  currency?: string | null;
  shadowStyle: ThemeShadows['sm'];
  settings?: ShippingSettings;
  isEditingThreshold: boolean;
  tempThreshold: string;
  isPending: boolean;
  onStartEditing: () => void;
  onThresholdChange: (value: string) => void;
  onSaveThreshold: () => void;
  onCancelEditing: () => void;
  onManageShipping: () => void;
}

export function ShippingForm({
  colors,
  currency,
  shadowStyle,
  settings,
  isEditingThreshold,
  tempThreshold,
  isPending,
  onStartEditing,
  onThresholdChange,
  onSaveThreshold,
  onCancelEditing,
  onManageShipping,
}: ShippingFormProps) {
  const thresholdValue = settings?.free_shipping_threshold;
  const hasFreeShippingThreshold = thresholdValue != null;

  return (
    <>
      <Pressable
        style={[styles.card, { backgroundColor: colors.card }, shadowStyle]}
        onPress={onStartEditing}
      >
        <View style={styles.featureRow}>
          <View
            style={[styles.featureIcon, { backgroundColor: colors.cardHover }]}
          >
            <Ionicons name="gift-outline" size={24} color={colors.primary} />
          </View>
          <View style={styles.featureInfo}>
            <Text style={[styles.featureTitle, { color: colors.text }]}>
              Free Shipping
            </Text>
            {isEditingThreshold ? (
              <View style={styles.editRow}>
                <TextInput
                  style={[
                    styles.thresholdInput,
                    { color: colors.text, borderColor: colors.border },
                  ]}
                  value={tempThreshold}
                  onChangeText={onThresholdChange}
                  keyboardType="numeric"
                  placeholder="Min amount"
                  accessibilityLabel="Free shipping threshold amount"
                />
                <Pressable
                  onPress={onSaveThreshold}
                  disabled={isPending}
                  style={styles.actionIcon}
                  accessibilityRole="button"
                  accessibilityLabel="Save threshold"
                >
                  {isPending ? (
                    <ActivityIndicator size="small" color={colors.primary} />
                  ) : (
                    <Ionicons
                      name="checkmark-circle"
                      size={28}
                      color={colors.success}
                    />
                  )}
                </Pressable>
                <Pressable
                  onPress={onCancelEditing}
                  style={styles.actionIcon}
                  accessibilityRole="button"
                  accessibilityLabel="Cancel editing"
                >
                  <Ionicons
                    name="close-circle"
                    size={28}
                    color={colors.error}
                  />
                </Pressable>
              </View>
            ) : (
              <Text
                style={[
                  styles.featureDescription,
                  { color: colors.textSecondary },
                ]}
              >
                {hasFreeShippingThreshold
                  ? `Orders above ${formatCurrency(
                      thresholdValue,
                      {
                        maximumFractionDigits: 0,
                        minimumFractionDigits: 0,
                      },
                      currency ?? 'NGN'
                    )}`
                  : 'Not configured'}
              </Text>
            )}
          </View>
          {!isEditingThreshold && (
            <View
              style={[
                styles.statusBadge,
                {
                  backgroundColor: hasFreeShippingThreshold
                    ? colors.successLight
                    : colors.cardHover,
                },
              ]}
            >
              <Text
                style={[
                  styles.statusText,
                  {
                    color: hasFreeShippingThreshold
                      ? colors.success
                      : colors.textMuted,
                  },
                ]}
              >
                {hasFreeShippingThreshold ? 'On' : 'Off'}
              </Text>
            </View>
          )}
        </View>
      </Pressable>

      <View
        style={[
          styles.notice,
          { backgroundColor: colors.infoLight || '#EFF6FF' },
        ]}
      >
        <Ionicons
          name="information-circle"
          size={20}
          color={colors.info || '#3B82F6'}
        />
        <Text style={[styles.noticeText, { color: colors.info || '#3B82F6' }]}>
          Configure API keys and advanced shipping rules on the web dashboard.
        </Text>
      </View>

      <Pressable
        style={[styles.manageButton, { backgroundColor: colors.primary }]}
        onPress={onManageShipping}
        accessible={true}
        accessibilityRole="button"
        accessibilityLabel="Open Advanced Settings in browser"
      >
        <Ionicons name="settings-outline" size={20} color="#FFFFFF" />
        <Text style={styles.manageButtonText}>Advanced Settings</Text>
      </Pressable>
    </>
  );
}
