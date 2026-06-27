import { StyleSheet, Text, View } from 'react-native';
import type { ThemeColors } from '@/constants/theme';
import type { OrderAuditEvent } from '@/hooks/orders/useOrderAuditEvents';

interface OrderAuditTrailCardProps {
  colors: Pick<
    ThemeColors,
    'border' | 'card' | 'text' | 'textMuted' | 'textSecondary'
  >;
  events: OrderAuditEvent[];
  isError: boolean;
  formatDate: (value: string) => string;
  isLoading: boolean;
}

function labelValue(value: string): string {
  return value
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

export function OrderAuditTrailCard({
  colors,
  events,
  formatDate,
  isError,
  isLoading,
}: OrderAuditTrailCardProps) {
  if (!isLoading && !isError && events.length === 0) {
    return null;
  }

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.card, borderColor: colors.border },
      ]}
    >
      <Text style={[styles.title, { color: colors.text }]}>Audit trail</Text>

      {isError ? (
        <Text style={[styles.emptyText, { color: colors.textMuted }]}>
          Audit trail could not be loaded.
        </Text>
      ) : isLoading ? (
        <Text style={[styles.emptyText, { color: colors.textMuted }]}>
          Loading audit trail...
        </Text>
      ) : (
        events.map((event) => (
          <View
            key={event.id}
            style={[styles.eventRow, { borderTopColor: colors.border }]}
          >
            <View style={styles.eventHeader}>
              <Text style={[styles.category, { color: colors.text }]}>
                {labelValue(event.change_category)}
              </Text>
              <Text style={[styles.date, { color: colors.textMuted }]}>
                {formatDate(event.created_at)}
              </Text>
            </View>
            <Text style={[styles.fields, { color: colors.textSecondary }]}>
              {event.changed_fields.map(labelValue).join(', ') ||
                'Order details'}
            </Text>
          </View>
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 16,
    padding: 16,
  },
  category: {
    fontSize: 14,
    fontWeight: '700',
  },
  date: {
    fontSize: 12,
    fontWeight: '500',
  },
  emptyText: {
    fontSize: 13,
    marginTop: 12,
  },
  eventHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  eventRow: {
    borderTopWidth: 1,
    marginTop: 12,
    paddingTop: 12,
  },
  fields: {
    fontSize: 13,
    marginTop: 6,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
  },
});
