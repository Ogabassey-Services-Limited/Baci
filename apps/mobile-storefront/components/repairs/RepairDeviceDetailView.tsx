import type {
  RepairDeviceDetail,
  RepairQuoteSummary,
} from '@baci/shared/repairs';
import Ionicons from '@react-native-vector-icons/ionicons';
import { Pressable, ScrollView, Text, View } from 'react-native';
import {
  formatQuotePrice,
  quoteMetaLabel,
} from '@/components/repairs/repair-quote-format';
import { repairsCatalogStyles as styles } from '@/components/repairs/repairs-catalog.styles';
import { useColorScheme } from '@/components/useColorScheme';
import Colors, { BRAND } from '@/constants/Colors';

interface RepairDeviceDetailViewProps {
  detail: RepairDeviceDetail;
  /** `null` = book without a specific quote (free-text / request-a-quote path). */
  onBookQuote: (quote: RepairQuoteSummary | null) => void;
}

/**
 * Per-device repair options: the device name, its linked product key specs
 * (when the catalogue row is linked to a product), and each active quote with
 * a "From ₦X" price + a Book CTA. When the device has no fixed prices we still
 * let the customer request a quote (books with a null quote).
 */
export function RepairDeviceDetailView({
  detail,
  onBookQuote,
}: RepairDeviceDetailViewProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const { device, quotes, product } = detail;
  const keySpecs = product?.keySpecs ?? [];

  return (
    <ScrollView
      style={styles.scrollView}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.deviceHeader}>
        <Text style={[styles.deviceHeaderTitle, { color: colors.text }]}>
          {device.model}
        </Text>
        <Text style={[styles.deviceMeta, { color: colors.textSecondary }]}>
          {device.brand}
          {device.deviceType ? ` · ${device.deviceType}` : ''}
        </Text>
        {keySpecs.length > 0 ? (
          <View style={styles.specsRow}>
            {keySpecs.map((spec) => (
              <View key={spec.label} style={styles.specChip}>
                <Text style={styles.specChipText}>
                  {spec.label}: {spec.value}
                </Text>
              </View>
            ))}
          </View>
        ) : null}
      </View>

      {quotes.length > 0 ? (
        <>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Repair options
          </Text>
          {quotes.map((quote) => {
            const meta = quoteMetaLabel(quote);
            return (
              <View
                key={quote.id}
                style={[
                  styles.quoteCard,
                  { backgroundColor: colors.card, borderColor: colors.border },
                ]}
              >
                <View style={styles.quoteRow}>
                  <Text style={[styles.quoteName, { color: colors.text }]}>
                    {quote.serviceTypeName}
                  </Text>
                  <Text style={styles.quotePrice}>
                    {formatQuotePrice(quote)}
                  </Text>
                </View>
                {quote.description ? (
                  <Text
                    style={[styles.quoteMeta, { color: colors.textSecondary }]}
                  >
                    {quote.description}
                  </Text>
                ) : null}
                {meta ? (
                  <Text
                    style={[styles.quoteMeta, { color: colors.textSecondary }]}
                  >
                    {meta}
                  </Text>
                ) : null}
                <Pressable
                  style={styles.primaryButton}
                  onPress={() => onBookQuote(quote)}
                  accessibilityRole="button"
                  accessibilityLabel={`Book ${quote.serviceTypeName}`}
                >
                  <Text style={styles.primaryButtonText}>Book this repair</Text>
                  <Ionicons name="arrow-forward" size={18} color="#FFF" />
                </Pressable>
              </View>
            );
          })}
        </>
      ) : (
        <View
          style={[
            styles.notListedCard,
            { borderColor: colors.border, borderStyle: 'solid' },
          ]}
        >
          <Text style={[styles.notListedTitle, { color: colors.text }]}>
            No fixed prices listed
          </Text>
          <Text style={[styles.notListedDesc, { color: colors.textSecondary }]}>
            Send us the details and we'll get back with a quote for this device.
          </Text>
          <Pressable
            style={styles.primaryButton}
            onPress={() => onBookQuote(null)}
            accessibilityRole="button"
            accessibilityLabel="Request a quote for this device"
          >
            <Text style={styles.primaryButtonText}>Request a quote</Text>
            <Ionicons name="arrow-forward" size={18} color="#FFF" />
          </Pressable>
        </View>
      )}

      <Pressable
        style={[styles.secondaryButton, { marginTop: 8 }]}
        onPress={() => onBookQuote(null)}
        accessibilityRole="button"
        accessibilityLabel="Book without picking a specific repair"
      >
        <Ionicons name="create-outline" size={16} color={BRAND.primary} />
        <Text style={styles.secondaryButtonText}>
          Something else? Describe the issue
        </Text>
      </Pressable>
    </ScrollView>
  );
}
