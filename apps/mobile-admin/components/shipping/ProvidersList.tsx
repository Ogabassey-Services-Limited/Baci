import { Ionicons } from '@expo/vector-icons';
import { Switch, Text, View } from 'react-native';
import type { ThemeColors, ThemeShadows } from '@/constants/theme';
import { styles } from './shipping-styles';
import type { ShippingProvider } from './shipping-types';

const AVAILABLE_PROVIDERS: ShippingProvider[] = [
  {
    id: 'gigl',
    name: 'GIG Logistics',
    description: 'Nationwide delivery with tracking',
    icon: 'cube-outline',
  },
  {
    id: 'topship',
    name: 'Topship',
    description: 'Fast local and international shipping',
    icon: 'airplane-outline',
  },
  {
    id: 'shiip',
    name: 'Shiip',
    description: 'Same-day and next-day delivery',
    icon: 'flash-outline',
  },
];

interface ProvidersListProps {
  colors: ThemeColors;
  shadowStyle: ThemeShadows['sm'];
  enabledCount: number;
  isPending: boolean;
  isProviderEnabled: (providerId: string) => boolean;
  onToggleProvider: (providerId: string, enabled: boolean) => void;
}

export function ProvidersList({
  colors,
  shadowStyle,
  enabledCount,
  isPending,
  isProviderEnabled,
  onToggleProvider,
}: ProvidersListProps) {
  return (
    <View style={[styles.card, { backgroundColor: colors.card }, shadowStyle]}>
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          Shipping Providers
        </Text>
        <View
          style={[
            styles.countBadge,
            { backgroundColor: colors.primaryLight || colors.cardHover },
          ]}
        >
          <Text style={[styles.countText, { color: colors.primary }]}>
            {enabledCount} active
          </Text>
        </View>
      </View>
      <Text
        style={[styles.sectionDescription, { color: colors.textSecondary }]}
      >
        Enable providers to offer customers real-time shipping rates at
        checkout.
      </Text>

      <View style={[styles.divider, { backgroundColor: colors.border }]} />

      {AVAILABLE_PROVIDERS.map((provider, index) => {
        const enabled = isProviderEnabled(provider.id);

        return (
          <View key={provider.id}>
            {index > 0 && (
              <View
                style={[styles.divider, { backgroundColor: colors.border }]}
              />
            )}
            <View style={styles.providerRow}>
              <View
                style={[
                  styles.providerIcon,
                  {
                    backgroundColor: enabled
                      ? colors.successLight || '#E8F5E9'
                      : colors.cardHover,
                  },
                ]}
              >
                <Ionicons
                  name={provider.icon}
                  size={24}
                  color={enabled ? colors.success : colors.textMuted}
                />
              </View>
              <View style={styles.providerInfo}>
                <Text style={[styles.providerName, { color: colors.text }]}>
                  {provider.name}
                </Text>
                <Text
                  style={[
                    styles.providerDescription,
                    { color: colors.textSecondary },
                  ]}
                >
                  {provider.description}
                </Text>
              </View>
              <Switch
                value={enabled}
                onValueChange={(value) => onToggleProvider(provider.id, value)}
                trackColor={{
                  false: colors.border,
                  true: colors.primary,
                }}
                thumbColor="#FFFFFF"
                disabled={isPending}
                accessibilityRole="switch"
                accessibilityLabel={`Toggle ${provider.name}`}
                accessibilityHint="Enables this shipping provider"
                accessibilityState={{ checked: enabled, disabled: isPending }}
              />
            </View>
          </View>
        );
      })}
    </View>
  );
}
