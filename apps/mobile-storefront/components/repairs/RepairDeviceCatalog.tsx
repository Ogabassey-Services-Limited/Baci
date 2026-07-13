import type {
  RepairDeviceBrandGroup,
  RepairDeviceSummary,
} from '@baci/shared/repairs';
import Ionicons from '@react-native-vector-icons/ionicons';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { repairsCatalogStyles as styles } from '@/components/repairs/repairs-catalog.styles';
import { useColorScheme } from '@/components/useColorScheme';
import Colors, { BRAND } from '@/constants/Colors';

interface RepairDeviceCatalogProps {
  groups: RepairDeviceBrandGroup[];
  query: string;
  onQueryChange: (query: string) => void;
  onSelectDevice: (device: RepairDeviceSummary) => void;
  onDescribeInstead: () => void;
  onChatWhatsapp: () => void;
}

/**
 * Device-first catalogue picker: a search bar + brand-grouped device cards
 * fed by `GET /api/storefront/[slug]/repairs/devices`. Selecting a device
 * drills into its quotes. The "Device not listed?" block keeps the free-text
 * booking path and the WhatsApp technician chat as secondary CTAs (WhatsApp
 * is a fallback, not the primary path anymore).
 */
export function RepairDeviceCatalog({
  groups,
  query,
  onQueryChange,
  onSelectDevice,
  onDescribeInstead,
  onChatWhatsapp,
}: RepairDeviceCatalogProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const hasResults = groups.some((group) => group.devices.length > 0);

  return (
    <ScrollView
      style={styles.scrollView}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={[styles.introTitle, { color: colors.text }]}>
        What needs fixing?
      </Text>
      <Text style={[styles.introSubtitle, { color: colors.textSecondary }]}>
        Find your device to see repair options and prices.
      </Text>

      <View style={[styles.searchBar, { borderColor: colors.border }]}>
        <Ionicons name="search" size={18} color={colors.textSecondary} />
        <TextInput
          style={[styles.searchInput, { color: colors.text }]}
          placeholder="Search your device (e.g. iPhone 13)"
          placeholderTextColor={colors.placeholder}
          value={query}
          onChangeText={onQueryChange}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
          accessibilityLabel="Search for your device"
        />
      </View>

      {hasResults ? (
        groups.map((group) => (
          <View key={group.brand} style={styles.brandGroup}>
            <Text style={[styles.brandTitle, { color: colors.textSecondary }]}>
              {group.brand}
            </Text>
            {group.devices.map((device) => (
              <Pressable
                key={device.id}
                style={[styles.deviceCard, { backgroundColor: colors.card }]}
                onPress={() => onSelectDevice(device)}
                accessibilityRole="button"
                accessibilityLabel={`${device.brand} ${device.model}`}
                accessibilityHint="View repair options for this device"
              >
                <View style={styles.deviceThumb}>
                  <Ionicons
                    name="phone-portrait-outline"
                    size={22}
                    color={BRAND.primary}
                  />
                </View>
                <View style={styles.deviceInfo}>
                  <Text
                    style={[styles.deviceModel, { color: colors.text }]}
                    numberOfLines={1}
                  >
                    {device.model}
                  </Text>
                  {device.deviceType ? (
                    <Text
                      style={[
                        styles.deviceMeta,
                        { color: colors.textSecondary },
                      ]}
                    >
                      {device.deviceType}
                    </Text>
                  ) : null}
                </View>
                <Ionicons
                  name="chevron-forward"
                  size={18}
                  color={colors.textSecondary}
                />
              </Pressable>
            ))}
          </View>
        ))
      ) : (
        <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
          {query.trim()
            ? `No devices found for "${query.trim()}".`
            : 'No devices are listed yet.'}
        </Text>
      )}

      <View style={[styles.notListedCard, { borderColor: colors.border }]}>
        <Text style={[styles.notListedTitle, { color: colors.text }]}>
          Device not listed?
        </Text>
        <Text style={[styles.notListedDesc, { color: colors.textSecondary }]}>
          Tell us about your device and the issue — we'll get back with a quote.
        </Text>
        <Pressable
          style={styles.secondaryButton}
          onPress={onDescribeInstead}
          accessibilityRole="button"
          accessibilityLabel="Describe your device instead"
        >
          <Ionicons name="create-outline" size={16} color={BRAND.primary} />
          <Text style={styles.secondaryButtonText}>Describe it instead</Text>
        </Pressable>
        <Pressable
          style={styles.secondaryButton}
          onPress={onChatWhatsapp}
          accessibilityRole="button"
          accessibilityLabel="Chat on WhatsApp"
        >
          <Ionicons name="logo-whatsapp" size={16} color={BRAND.primary} />
          <Text style={styles.secondaryButtonText}>Chat on WhatsApp</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}
