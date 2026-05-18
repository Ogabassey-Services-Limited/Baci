import { Ionicons } from '@expo/vector-icons';
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { BRAND } from '@/constants/Colors';
import type {
  OrderListFilterKey,
  OrderListFilterOption,
} from '@/lib/order-list-filters';

interface OrdersListHeaderColors {
  card: string;
  border: string;
  muted: string;
  text: string;
  textSecondary: string;
  placeholder: string;
}

interface OrdersListHeaderProps {
  colors: OrdersListHeaderColors;
  orderFilters: OrderListFilterOption[];
  selectedFilter: OrderListFilterKey;
  onSelectFilter: (filter: OrderListFilterKey) => void;
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
  filteredOrdersCount: number;
}

export function OrdersListHeader({
  colors,
  orderFilters,
  selectedFilter,
  onSelectFilter,
  searchQuery,
  onSearchQueryChange,
  filteredOrdersCount,
}: OrdersListHeaderProps) {
  return (
    <View
      style={[
        styles.heroCard,
        { backgroundColor: colors.card, borderColor: colors.border },
      ]}
    >
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterRow}
      >
        {orderFilters.map((filter) => {
          const isActive = selectedFilter === filter.key;

          return (
            <TouchableOpacity
              key={filter.key}
              onPress={() => onSelectFilter(filter.key)}
              style={[
                styles.filterChip,
                {
                  backgroundColor: isActive ? BRAND.primary : colors.muted,
                  borderColor: isActive ? BRAND.primary : colors.border,
                },
              ]}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityState={{ selected: isActive }}
              accessibilityLabel={`Filter orders by ${filter.label}`}
            >
              <Text
                style={[
                  styles.filterLabel,
                  { color: isActive ? '#FFF' : colors.textSecondary },
                ]}
              >
                {filter.label}
              </Text>
              <Text
                style={[
                  styles.filterCount,
                  { color: isActive ? '#FFF' : colors.text },
                ]}
              >
                {filter.count}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <View
        style={[
          styles.searchContainer,
          { backgroundColor: colors.muted, borderColor: colors.border },
        ]}
      >
        <Ionicons
          name="search-outline"
          size={20}
          color={colors.textSecondary}
        />
        <TextInput
          style={[styles.searchInput, { color: colors.text }]}
          placeholder="Search orders, items, or status"
          placeholderTextColor={colors.placeholder}
          value={searchQuery}
          onChangeText={onSearchQueryChange}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity
            onPress={() => onSearchQueryChange('')}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityRole="button"
            accessibilityLabel="Clear order search"
          >
            <Ionicons
              name="close-circle"
              size={20}
              color={colors.textSecondary}
            />
          </TouchableOpacity>
        )}
      </View>

      {searchQuery.length > 0 && (
        <Text style={[styles.searchResults, { color: colors.textSecondary }]}>
          {filteredOrdersCount}{' '}
          {filteredOrdersCount === 1 ? 'match' : 'matches'}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  heroCard: {
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: 14,
  },
  filterRow: {
    gap: 10,
    paddingRight: 4,
  },
  filterChip: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  filterLabel: {
    fontSize: 13,
    fontWeight: '700',
  },
  filterCount: {
    fontSize: 15,
    fontWeight: '800',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 16,
    borderWidth: 1,
    gap: 10,
    marginTop: 18,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    paddingVertical: 0,
  },
  searchResults: {
    fontSize: 13,
    marginTop: 10,
  },
});
