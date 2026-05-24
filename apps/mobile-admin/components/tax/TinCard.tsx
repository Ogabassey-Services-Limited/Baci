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

interface TinCardProps {
  colors: TaxColors;
  shadowStyle: TaxCardShadow;
  taxId: string;
  isPending: boolean;
  onChangeText: (value: string) => void;
  onSave: () => void;
}

export function TinCard({
  colors,
  shadowStyle,
  taxId,
  isPending,
  onChangeText,
  onSave,
}: TinCardProps) {
  const handleChangeText = (value: string) => {
    onChangeText(value.replace(/\D/g, '').slice(0, 10));
  };

  return (
    <View style={[styles.card, { backgroundColor: colors.card }, shadowStyle]}>
      <View style={styles.cardHeader}>
        <View
          style={[styles.iconContainer, { backgroundColor: colors.cardHover }]}
        >
          <Ionicons
            name="document-text-outline"
            size={24}
            color={colors.textSecondary}
          />
        </View>
        <View style={styles.cardHeaderText}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>
            Tax Identification Number
          </Text>
          <Text
            style={[styles.toggleDescription, { color: colors.textSecondary }]}
          >
            Your 10-digit FIRS TIN
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
        placeholder="1234567890"
        placeholderTextColor={colors.textMuted}
        value={taxId}
        onChangeText={handleChangeText}
        keyboardType="number-pad"
        maxLength={10}
        accessible={true}
        accessibilityLabel="Tax identification number input"
        accessibilityHint="Enter your 10-digit Nigerian tax identification number"
      />
      <Pressable
        style={[styles.saveButton, { backgroundColor: colors.primary }]}
        onPress={onSave}
        disabled={isPending}
        accessible={true}
        accessibilityRole="button"
        accessibilityLabel="Save TIN"
        accessibilityHint="Saves your tax identification number"
        accessibilityState={{ disabled: isPending }}
      >
        {isPending ? (
          <ActivityIndicator size="small" color="#FFF" />
        ) : (
          <Text style={styles.saveButtonText}>Save TIN</Text>
        )}
      </Pressable>
    </View>
  );
}
