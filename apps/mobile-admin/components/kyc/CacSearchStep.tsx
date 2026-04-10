import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
} from 'react-native';
import { RADIUS, SPACING, TYPOGRAPHY } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';
import type { CacCompany } from './cac-types';

interface CacSearchStepProps {
  rcNumber: string;
  onChangeRcNumber: (value: string) => void;
  onSearch: () => void;
  isSearching: boolean;
  results: CacCompany[] | undefined;
  onSelect: (company: CacCompany) => void;
}

export default function CacSearchStep({
  rcNumber,
  onChangeRcNumber,
  onSearch,
  isSearching,
  results,
  onSelect,
}: CacSearchStepProps) {
  const { colors } = useTheme();

  return (
    <>
      <TextInput
        style={[
          styles.input,
          {
            backgroundColor: colors.inputBg,
            color: colors.text,
            borderColor: colors.border,
          },
        ]}
        placeholder="RC or BN number (e.g. RC1234567)"
        placeholderTextColor={colors.textMuted}
        value={rcNumber}
        onChangeText={onChangeRcNumber}
        autoCapitalize="characters"
        returnKeyType="search"
        onSubmitEditing={() => {
          if (rcNumber.trim() && !isSearching) onSearch();
        }}
        accessibilityLabel="RC or BN number"
      />
      <Pressable
        style={[
          styles.button,
          {
            backgroundColor: colors.primary,
            opacity: rcNumber.trim() && !isSearching ? 1 : 0.5,
          },
        ]}
        onPress={onSearch}
        disabled={!rcNumber.trim() || isSearching}
        accessibilityRole="button"
      >
        {isSearching ? (
          <ActivityIndicator size="small" color={colors.textOnPrimary} />
        ) : (
          <Text style={[styles.buttonText, { color: colors.textOnPrimary }]}>
            Search CAC
          </Text>
        )}
      </Pressable>
      {results && (
        <FlatList
          data={results}
          keyExtractor={(item) => item.rcNumber}
          style={styles.resultsList}
          ListEmptyComponent={
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              No companies found for this RC/BN number.
            </Text>
          }
          renderItem={({ item }) => (
            <Pressable
              style={[styles.resultItem, { borderColor: colors.border }]}
              onPress={() => onSelect(item)}
              accessibilityRole="button"
              accessibilityLabel={`Select ${item.approvedName}, RC ${item.rcNumber}, status ${item.status}`}
            >
              <Text style={[styles.resultName, { color: colors.text }]}>
                {item.approvedName}
              </Text>
              <Text
                style={[styles.resultMeta, { color: colors.textSecondary }]}
              >
                {item.rcNumber} — {item.status}
              </Text>
            </Pressable>
          )}
        />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  input: {
    borderWidth: 1,
    borderRadius: RADIUS.sm,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.size.md,
  },
  button: {
    borderRadius: RADIUS.sm,
    paddingVertical: SPACING.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: SPACING.sm,
  },
  buttonText: {
    fontFamily: TYPOGRAPHY.fontFamily.semiBold,
    fontSize: TYPOGRAPHY.size.md,
  },
  resultsList: { maxHeight: 200, marginTop: SPACING.sm },
  resultItem: { borderBottomWidth: 1, paddingVertical: SPACING.sm },
  resultName: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.size.md,
  },
  resultMeta: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.size.sm,
    marginTop: 2,
  },
  emptyText: {
    padding: SPACING.md,
  },
});
