import Ionicons from "@react-native-vector-icons/ionicons/static";
import {
  ActivityIndicator,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import { styles } from './styles';
import type { TaxCardShadow, TaxColors } from './types';

interface LegalEntityCardProps {
  colors: TaxColors;
  shadowStyle: TaxCardShadow;
  legalEntityName: string;
  isPending: boolean;
  onChangeText: (value: string) => void;
  onSave: () => void;
}

export function LegalEntityCard({
  colors,
  shadowStyle,
  legalEntityName,
  isPending,
  onChangeText,
  onSave,
}: LegalEntityCardProps) {
  return (
    <View style={[styles.card, { backgroundColor: colors.card }, shadowStyle]}>
      <View style={styles.cardHeader}>
        <View
          style={[styles.iconContainer, { backgroundColor: colors.cardHover }]}
        >
          <Ionicons
            name="business-outline"
            size={24}
            color={colors.textSecondary}
          />
        </View>
        <View style={styles.cardHeaderText}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>
            Legal Entity Name
          </Text>
          <Text
            style={[styles.toggleDescription, { color: colors.textSecondary }]}
          >
            Registered name on CAC documents
          </Text>
        </View>
      </View>
      <View style={[styles.divider, { backgroundColor: colors.border }]} />
      <TextInput
        style={[
          styles.textInput,
          {
            color: colors.text,
            backgroundColor: colors.cardHover,
            borderColor: colors.border,
          },
        ]}
        placeholder="e.g. Acme Enterprises Limited"
        placeholderTextColor={colors.textMuted}
        value={legalEntityName}
        onChangeText={onChangeText}
        accessibilityLabel="Legal entity name"
        accessibilityHint="Enter the registered company name on CAC documents"
      />
      <Pressable
        style={[styles.saveButton, { backgroundColor: colors.primary }]}
        onPress={onSave}
        disabled={isPending}
        accessibilityRole="button"
        accessibilityLabel="Save legal entity"
        accessibilityHint="Saves the legal entity name"
        accessibilityState={{ disabled: isPending }}
      >
        {isPending ? (
          <ActivityIndicator size="small" color="#FFF" />
        ) : (
          <Text style={styles.saveButtonText}>Save</Text>
        )}
      </Pressable>
    </View>
  );
}
