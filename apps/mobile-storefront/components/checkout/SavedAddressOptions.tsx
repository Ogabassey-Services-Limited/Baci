import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { getAddressLabelIcon } from '@/components/addresses/get-address-label-icon';
import { BRAND, palette, RADIUS, SPACING } from '@/constants/Colors';
import type { SavedAddress } from '@/lib/checkout-saved-address';

type CheckoutColors = Record<
  'background' | 'border' | 'text' | 'textSecondary',
  string
>;

interface SavedAddressOptionsProps {
  colors: CheckoutColors;
  defaultSavedAddress: SavedAddress | null;
  isAddingNewAddress: boolean;
  isDark: boolean;
  isLoadingSavedAddresses: boolean;
  onOpenNewAddressEditor: () => void;
  onUseSavedAddress: (
    savedAddress: SavedAddress,
    options?: { collapse?: boolean }
  ) => void;
  savedAddresses: SavedAddress[];
  selectedSavedAddress: SavedAddress | null;
  selectedSavedAddressId: string | null;
}

export function SavedAddressOptions({
  colors,
  defaultSavedAddress,
  isAddingNewAddress,
  isDark,
  isLoadingSavedAddresses,
  onOpenNewAddressEditor,
  onUseSavedAddress,
  savedAddresses,
  selectedSavedAddress,
  selectedSavedAddressId,
}: SavedAddressOptionsProps) {
  if (savedAddresses.length === 0) return null;

  return (
    <View style={styles.savedAddressSection}>
      <View style={styles.savedAddressHeader}>
        <Text style={[styles.savedAddressSectionTitle, { color: colors.text }]}>
          Delivery options
        </Text>
        {isLoadingSavedAddresses && (
          <ActivityIndicator
            accessibilityLabel="Loading saved addresses"
            size="small"
            color={BRAND.primary}
          />
        )}
      </View>
      <View
        style={[
          styles.addressModeSwitch,
          {
            backgroundColor: isDark
              ? 'rgba(255, 255, 255, 0.05)'
              : palette.gray[100],
            borderColor: colors.border,
          },
        ]}
      >
        <Pressable
          style={[
            styles.addressModeChip,
            {
              backgroundColor: !isAddingNewAddress
                ? BRAND.primary
                : 'transparent',
            },
          ]}
          onPress={() => {
            const fallbackSavedAddress =
              selectedSavedAddress ?? defaultSavedAddress ?? savedAddresses[0];
            if (fallbackSavedAddress) {
              onUseSavedAddress(fallbackSavedAddress, { collapse: false });
            }
          }}
          accessibilityRole="button"
          accessibilityLabel="Use a saved address"
        >
          <Ionicons
            name="bookmark-outline"
            size={15}
            color={!isAddingNewAddress ? '#FFFFFF' : BRAND.primary}
          />
          <Text
            style={[
              styles.addressModeChipText,
              { color: !isAddingNewAddress ? '#FFFFFF' : colors.text },
            ]}
          >
            Saved
          </Text>
        </Pressable>
        <Pressable
          style={[
            styles.addressModeChip,
            {
              backgroundColor: isAddingNewAddress
                ? BRAND.primary
                : 'transparent',
            },
          ]}
          onPress={onOpenNewAddressEditor}
          accessibilityRole="button"
          accessibilityLabel="Add a new delivery address"
        >
          <Ionicons
            name="add-outline"
            size={16}
            color={isAddingNewAddress ? '#FFFFFF' : BRAND.primary}
          />
          <Text
            style={[
              styles.addressModeChipText,
              { color: isAddingNewAddress ? '#FFFFFF' : colors.text },
            ]}
          >
            New address
          </Text>
        </Pressable>
      </View>
      {!isAddingNewAddress &&
        savedAddresses.map((savedAddress) => {
          const isSelected = savedAddress.id === selectedSavedAddressId;

          return (
            <Pressable
              key={savedAddress.id}
              onPress={() =>
                onUseSavedAddress(savedAddress, { collapse: false })
              }
              style={[
                styles.savedAddressOption,
                {
                  backgroundColor: isSelected
                    ? isDark
                      ? 'rgba(217, 59, 48, 0.12)'
                      : palette.red[50]
                    : colors.background,
                  borderColor: isSelected ? BRAND.primary : colors.border,
                },
              ]}
              accessibilityRole="button"
              accessibilityLabel={`Use ${savedAddress.label || 'saved'} address`}
            >
              <View
                style={[
                  styles.savedAddressIconWrap,
                  {
                    backgroundColor: isSelected
                      ? `${BRAND.primary}18`
                      : isDark
                        ? 'rgba(255,255,255,0.07)'
                        : palette.gray[100],
                  },
                ]}
              >
                <Ionicons
                  name={getAddressLabelIcon(savedAddress.label)}
                  size={18}
                  color={isSelected ? BRAND.primary : colors.textSecondary}
                />
              </View>
              <View style={styles.savedAddressOptionBody}>
                <View style={styles.savedAddressOptionTitleRow}>
                  <Text
                    style={[
                      styles.savedAddressOptionTitle,
                      { color: colors.text },
                    ]}
                  >
                    {savedAddress.full_name}
                  </Text>
                  {savedAddress.is_default && (
                    <View
                      style={[
                        styles.savedAddressDefaultBadge,
                        { backgroundColor: `${BRAND.primary}14` },
                      ]}
                    >
                      <Text
                        style={[
                          styles.savedAddressDefaultBadgeText,
                          { color: BRAND.primary },
                        ]}
                      >
                        Default
                      </Text>
                    </View>
                  )}
                </View>
                <Text
                  style={[
                    styles.savedAddressMeta,
                    { color: colors.textSecondary },
                  ]}
                >
                  {savedAddress.address}
                </Text>
              </View>
              <Ionicons
                name={isSelected ? 'checkmark-circle' : 'ellipse-outline'}
                size={20}
                color={isSelected ? BRAND.primary : colors.textSecondary}
              />
            </Pressable>
          );
        })}
    </View>
  );
}

const styles = StyleSheet.create({
  savedAddressSection: {
    marginBottom: SPACING.sm,
    gap: 10,
  },
  savedAddressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  savedAddressSectionTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  addressModeSwitch: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 4,
    flexDirection: 'row',
    alignItems: 'center',
  },
  addressModeChip: {
    flex: 1,
    minHeight: 38,
    borderRadius: 14,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  addressModeChipText: {
    fontSize: 13,
    fontWeight: '700',
  },
  savedAddressOption: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  savedAddressIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  savedAddressOptionBody: {
    flex: 1,
    gap: 4,
  },
  savedAddressOptionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  savedAddressOptionTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  savedAddressMeta: {
    fontSize: 13,
    lineHeight: 18,
  },
  savedAddressDefaultBadge: {
    borderRadius: RADIUS.full,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  savedAddressDefaultBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
});
