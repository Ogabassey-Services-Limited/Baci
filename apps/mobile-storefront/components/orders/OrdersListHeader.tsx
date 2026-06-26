import Ionicons from '@react-native-vector-icons/ionicons';
import {
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

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
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
  filteredOrdersCount: number;
}

export function OrdersListHeader({
  colors,
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
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 16,
    borderWidth: 1,
    gap: 10,
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
