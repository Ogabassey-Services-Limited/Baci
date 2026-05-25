import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';
import type Colors from '@/constants/Colors';
import { styles } from './wallet.styles';

type WalletColors = (typeof Colors)['light'];

type WalletActionsRowProps = {
  colors: WalletColors;
  onManageCards: () => void;
  onQuickSave: () => void;
  onStartSavings: () => void;
  showQuickSave: boolean;
};

export function WalletActionsRow({
  colors,
  onManageCards,
  onQuickSave,
  onStartSavings,
  showQuickSave,
}: WalletActionsRowProps) {
  return (
    <>
      <View style={styles.primaryActionRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Start savings"
          onPress={onStartSavings}
          style={styles.primaryActionButton}
        >
          <Ionicons
            name="sparkles-outline"
            size={16}
            color={colors.white}
          />
          <Text style={styles.primaryActionButtonText}>Start Savings</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Manage cards"
          onPress={onManageCards}
          style={styles.secondaryActionButton}
        >
          <Ionicons name="card-outline" size={16} color={colors.text} />
          <Text
            style={[styles.secondaryActionButtonText, { color: colors.text }]}
          >
            Manage Cards
          </Text>
        </Pressable>
      </View>
      {showQuickSave ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Quick save"
          style={styles.quickSaveButton}
          onPress={onQuickSave}
        >
          <Ionicons
            name="add-circle-outline"
            size={16}
            color={colors.white}
          />
          <Text style={styles.quickSaveButtonText}>Quick Save</Text>
        </Pressable>
      ) : null}
    </>
  );
}
