import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { RADIUS, SPACING, TYPOGRAPHY } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';
import type { CacCompany, CacRegistrationPrefix } from './cac-types';

interface CacSearchStepProps {
  registrationPrefix: CacRegistrationPrefix;
  onChangeRegistrationPrefix: (value: CacRegistrationPrefix) => void;
  rcNumber: string;
  onChangeRcNumber: (value: string) => void;
  onSearch: () => void;
  isSearching: boolean;
  results: CacCompany[] | undefined;
  onSelect: (company: CacCompany) => void;
}

export default function CacSearchStep({
  registrationPrefix,
  onChangeRegistrationPrefix,
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
      <Text style={[styles.helperText, { color: colors.textSecondary }]}>
        Choose the registration type, then enter only the number.
      </Text>
      <View style={styles.inputRow}>
        <View
          style={[
            styles.prefixContainer,
            {
              backgroundColor: colors.inputBg,
              borderColor: colors.border,
            },
          ]}
        >
          {(['RC', 'BN'] as const).map((prefix) => {
            const isSelected = registrationPrefix === prefix;

            return (
              <Pressable
                key={prefix}
                style={[
                  styles.prefixButton,
                  isSelected && {
                    backgroundColor: colors.primary,
                  },
                ]}
                onPress={() => onChangeRegistrationPrefix(prefix)}
                accessibilityRole="button"
                accessibilityLabel={`Use ${prefix} registration type`}
              >
                <Text
                  style={[
                    styles.prefixButtonText,
                    { color: isSelected ? colors.textOnPrimary : colors.text },
                  ]}
                >
                  {prefix}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <TextInput
          style={[
            styles.input,
            {
              backgroundColor: colors.inputBg,
              color: colors.text,
              borderColor: colors.border,
            },
          ]}
          placeholder="7389159"
          placeholderTextColor={colors.textMuted}
          value={rcNumber}
          onChangeText={(value) => onChangeRcNumber(value.replace(/\D/g, ''))}
          keyboardType="number-pad"
          returnKeyType="search"
          onSubmitEditing={() => {
            if (rcNumber.trim() && !isSearching) onSearch();
          }}
          accessibilityLabel={`${registrationPrefix} registration number`}
        />
      </View>
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
              accessibilityLabel={`Select ${item.approvedName}, registration number ${item.rcNumber}, status ${item.status}`}
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
  helperText: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.size.sm,
    marginBottom: SPACING.sm,
  },
  inputRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    alignItems: 'stretch',
  },
  prefixContainer: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: RADIUS.sm,
    padding: 4,
    gap: 4,
  },
  prefixButton: {
    minHeight: 44,
    minWidth: 52,
    borderRadius: RADIUS.sm,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.sm,
  },
  prefixButtonText: {
    fontFamily: TYPOGRAPHY.fontFamily.semiBold,
    fontSize: TYPOGRAPHY.size.sm,
  },
  input: {
    flex: 1,
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
