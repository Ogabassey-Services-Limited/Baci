import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import { AppPageSheet } from '@/components/ui/AppPageSheet';
import type { ThemeColors } from '@/constants/theme';
import { useBranches } from '@/hooks/useBranches';
import { useRestockVariantInventory } from '@/hooks/useVariantInventory';
import { ProductRestockOptions } from './ProductRestockOptions';
import { productRestockSheetStyles as styles } from './ProductRestockSheet.styles';
import {
  buildRestockUnits,
  findInvalidImeis,
  parseRestockIdentifiers,
  type RestockIdentifierMode,
  type RestockSource,
} from './ProductRestockSheet.utils';

interface ProductRestockSheetProps {
  colors: ThemeColors;
  productId: string;
  variantId?: string | null;
  onClose: () => void;
  visible: boolean;
}

export function ProductRestockSheet({
  colors,
  productId,
  variantId,
  onClose,
  visible,
}: ProductRestockSheetProps) {
  const [mode, setMode] = useState<RestockIdentifierMode>('imei');
  const [inputText, setInputText] = useState('');
  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(null);
  const [source, setSource] = useState<RestockSource>('merchant_stock');
  const [notes, setNotes] = useState('');

  const { data: branches = [] } = useBranches();
  const restockMutation = useRestockVariantInventory();
  const identifiers = parseRestockIdentifiers(inputText);

  const handleRestock = async () => {
    if (identifiers.length === 0) {
      Alert.alert('Validation Error', 'Please enter at least one identifier.');
      return;
    }

    if (mode === 'imei') {
      const invalidImeis = findInvalidImeis(identifiers);
      if (invalidImeis.length > 0) {
        Alert.alert(
          'Invalid IMEI Shape',
          `The following IMEIs are invalid (must be exactly 15 digits):\n\n${invalidImeis.join('\n')}`
        );
        return;
      }
    }

    try {
      await restockMutation.mutateAsync({
        productId,
        variantId,
        units: buildRestockUnits({ identifiers, mode, notes, source }),
        branchId: selectedBranchId,
      });

      Alert.alert(
        'Success',
        `Successfully restocked ${identifiers.length} units.`
      );
      setInputText('');
      setNotes('');
      onClose();
    } catch (error) {
      Alert.alert(
        'Restock Failed',
        error instanceof Error
          ? error.message
          : 'An error occurred during restocking.'
      );
    }
  };

  return (
    <AppPageSheet
      title="Restock Serialized Units"
      visible={visible}
      onClose={onClose}
      footer={
        <Pressable
          accessibilityLabel="Submit restock"
          accessibilityRole="button"
          disabled={restockMutation.isPending || !inputText.trim()}
          onPress={handleRestock}
          style={[
            styles.submitButton,
            { backgroundColor: colors.primary },
            (restockMutation.isPending || !inputText.trim()) && {
              opacity: 0.6,
            },
          ]}
        >
          {restockMutation.isPending ? (
            <ActivityIndicator color={colors.textOnPrimary} size="small" />
          ) : (
            <Text style={[styles.submitText, { color: colors.textOnPrimary }]}>
              Restock {identifiers.length || 0} Units
            </Text>
          )}
        </Pressable>
      }
    >
      <ProductRestockOptions
        branches={branches}
        colors={colors}
        mode={mode}
        onBranchChange={setSelectedBranchId}
        onModeChange={setMode}
        onSourceChange={setSource}
        selectedBranchId={selectedBranchId}
        source={source}
      />

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          Enter {mode === 'imei' ? 'IMEIs' : 'Serial Numbers'}
        </Text>
        <Text style={[styles.helperText, { color: colors.textSecondary }]}>
          {mode === 'imei'
            ? 'Enter 15-digit IMEIs. You can type one per line, or separate with commas.'
            : 'Enter alphanumeric Serial Numbers. You can type one per line, or separate with commas.'}
        </Text>
        <TextInput
          accessibilityLabel="Identifiers text list"
          autoCapitalize="characters"
          autoCorrect={false}
          multiline
          numberOfLines={6}
          onChangeText={setInputText}
          placeholder={
            mode === 'imei'
              ? '358201920192019\n358201920192020'
              : 'SN12345\nSN12346'
          }
          placeholderTextColor={colors.textSecondary}
          style={[
            styles.textarea,
            {
              backgroundColor: colors.inputBg,
              borderColor: colors.border,
              color: colors.text,
            },
          ]}
          value={inputText}
        />
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          Notes (Optional)
        </Text>
        <TextInput
          accessibilityLabel="Fulfillment notes"
          onChangeText={setNotes}
          placeholder="e.g. Batch received from supplier A"
          placeholderTextColor={colors.textSecondary}
          style={[
            styles.input,
            {
              backgroundColor: colors.inputBg,
              borderColor: colors.border,
              color: colors.text,
            },
          ]}
          value={notes}
        />
      </View>
    </AppPageSheet>
  );
}
