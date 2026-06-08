import Ionicons from '@react-native-vector-icons/ionicons';
import { Pressable, Text, View } from 'react-native';
import type Colors from '@/constants/Colors';
import { WALLET_COLORS } from './wallet.colors';
import { styles } from './wallet.styles';

type WalletColors = (typeof Colors)['light'];

type WalletActionsRowProps = {
  colors: WalletColors;
  hasActiveSavingsGoal: boolean;
  onManageCards: () => void;
  onQuickSave: () => void;
  onStartSavings: () => void;
  showQuickSave: boolean;
};

export function WalletActionsRow({
  colors,
  hasActiveSavingsGoal,
  onManageCards,
  onQuickSave,
  onStartSavings,
  showQuickSave,
}: WalletActionsRowProps) {
  const primaryActionLabel = hasActiveSavingsGoal
    ? 'Add to Savings'
    : 'Start Savings';

  return (
    <>
      <View style={styles.primaryActionRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={primaryActionLabel}
          onPress={onStartSavings}
          style={styles.primaryActionButton}
        >
          <Ionicons name="sparkles-outline" size={16} color={colors.white} />
          <Text style={styles.primaryActionButtonText}>
            {primaryActionLabel}
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Manage Cards"
          onPress={onManageCards}
          style={styles.secondaryActionButton}
        >
          <Ionicons
            name="card-outline"
            size={16}
            color={WALLET_COLORS.darkText}
          />
          <Text
            style={[
              styles.secondaryActionButtonText,
              { color: WALLET_COLORS.darkText },
            ]}
          >
            Manage Cards
          </Text>
        </Pressable>
      </View>
      {showQuickSave ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Quick Save"
          style={styles.quickSaveButton}
          onPress={onQuickSave}
        >
          <Ionicons name="add-circle-outline" size={16} color={colors.white} />
          <Text style={styles.quickSaveButtonText}>Quick Save</Text>
        </Pressable>
      ) : null}
    </>
  );
}
