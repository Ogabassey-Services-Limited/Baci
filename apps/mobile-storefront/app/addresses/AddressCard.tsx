import { Ionicons } from '@expo/vector-icons';
import {
  Alert,
  type AlertButton,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { BRAND } from '@/constants/Colors';
import type { ThemeColors } from '@/types/theme';
import {
  ADDRESS_DEFAULT_BADGE_LABEL,
  ADDRESS_DELETE_ACTION_LABEL,
  ADDRESS_EDIT_ACTION_LABEL,
  ADDRESS_FALLBACK_LABEL,
  ADDRESS_MENU_CANCEL_ACTION_LABEL,
  ADDRESS_MENU_TITLE,
  ADDRESS_SET_DEFAULT_ACTION_LABEL,
} from './constants';
import { getAddressLabelIcon } from './get-address-label-icon';
import { styles } from './styles';
import type { Address } from './types';

type AddressCardProps = {
  address: Address;
  colors: ThemeColors;
  onDelete: (address: Address) => void;
  onEdit: (address: Address) => void;
  onSetDefault: (addressId: string) => void;
};

export function AddressCard({
  address,
  colors,
  onDelete,
  onEdit,
  onSetDefault,
}: AddressCardProps) {
  return (
    <View style={[styles.addressCard, { backgroundColor: colors.card }]}>
      <View style={styles.addressHeader}>
        <View style={styles.labelContainer}>
          <Ionicons
            name={getAddressLabelIcon(address.label)}
            size={18}
            color={BRAND.primary}
            accessible={false}
            importantForAccessibility="no"
          />
          <Text style={[styles.addressLabel, { color: colors.text }]}>
            {address.label || ADDRESS_FALLBACK_LABEL}
          </Text>
          {address.is_default && (
            <View
              style={[
                styles.defaultBadge,
                { backgroundColor: `${BRAND.primary}20` },
              ]}
            >
              <Text style={[styles.defaultText, { color: BRAND.primary }]}>
                {ADDRESS_DEFAULT_BADGE_LABEL}
              </Text>
            </View>
          )}
        </View>
        <TouchableOpacity
          style={styles.menuButton}
          accessibilityRole="button"
          accessibilityLabel={`Address options for ${address.label || ADDRESS_FALLBACK_LABEL}`}
          onPress={() => {
            const buttons: AlertButton[] = [
              {
                text: ADDRESS_EDIT_ACTION_LABEL,
                onPress: () => onEdit(address),
              },
              ...(!address.is_default
                ? ([
                    {
                      text: ADDRESS_SET_DEFAULT_ACTION_LABEL,
                      onPress: () => onSetDefault(address.id),
                    },
                  ] satisfies AlertButton[])
                : []),
              {
                text: ADDRESS_DELETE_ACTION_LABEL,
                style: 'destructive',
                onPress: () => onDelete(address),
              },
              {
                text: ADDRESS_MENU_CANCEL_ACTION_LABEL,
                style: 'cancel',
              },
            ];

            Alert.alert(ADDRESS_MENU_TITLE, '', buttons);
          }}
        >
          <Ionicons
            name="ellipsis-vertical"
            size={20}
            color={colors.textSecondary}
            accessible={false}
            importantForAccessibility="no"
          />
        </TouchableOpacity>
      </View>

      <View style={styles.addressContent}>
        <Text style={[styles.addressName, { color: colors.text }]}>
          {address.full_name}
        </Text>
        <Text style={[styles.addressPhone, { color: colors.textSecondary }]}>
          {address.phone}
        </Text>
        <Text style={[styles.addressLine, { color: colors.textSecondary }]}>
          {address.address}
        </Text>
        <Text style={[styles.addressLine, { color: colors.textSecondary }]}>
          {address.city}, {address.state}
          {address.postal_code ? ` ${address.postal_code}` : ''}
        </Text>
      </View>

      <View style={[styles.addressActions, { borderTopColor: colors.border }]}>
        <TouchableOpacity
          style={[styles.actionButton, { borderColor: colors.border }]}
          accessibilityRole="button"
          accessibilityLabel={`Edit ${address.label || ADDRESS_FALLBACK_LABEL}`}
          onPress={() => onEdit(address)}
        >
          <Ionicons
            name="create-outline"
            size={16}
            color={colors.text}
            accessible={false}
            importantForAccessibility="no"
          />
          <Text style={[styles.actionText, { color: colors.text }]}>
            {ADDRESS_EDIT_ACTION_LABEL}
          </Text>
        </TouchableOpacity>
        {!address.is_default && (
          <TouchableOpacity
            style={[styles.actionButton, { borderColor: BRAND.primary }]}
            accessibilityRole="button"
            accessibilityLabel={`Set ${address.label || ADDRESS_FALLBACK_LABEL} as default`}
            onPress={() => onSetDefault(address.id)}
          >
            <Ionicons
              name="checkmark-circle-outline"
              size={16}
              color={BRAND.primary}
              accessible={false}
              importantForAccessibility="no"
            />
            <Text style={[styles.actionText, { color: BRAND.primary }]}>
              {ADDRESS_SET_DEFAULT_ACTION_LABEL}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}
