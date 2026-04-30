import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';
import { utilityPurchaseStyles as styles } from '@/app/utilities/utility-purchase.styles';
import type Colors from '@/constants/Colors';
import type { VTUHistoryTransaction } from '@/hooks/use-vtu-history';

const QUICK_REPEAT_AMOUNT_FORMATTER = new Intl.NumberFormat('en-NG', {
  style: 'currency',
  currency: 'NGN',
});

interface QuickRepeatPromptProps {
  bottom: number;
  colors: typeof Colors.light;
  isLoading: boolean;
  lastTransaction: VTUHistoryTransaction | null;
  notice: string | null;
  onQuickRepeat: () => void;
  showQuickRepeat: boolean;
  title: string;
}

export function QuickRepeatPrompt({
  bottom,
  colors,
  isLoading,
  lastTransaction,
  notice,
  onQuickRepeat,
  showQuickRepeat,
  title,
}: QuickRepeatPromptProps) {
  if (notice) {
    return (
      <View
        accessible={true}
        accessibilityRole="alert"
        accessibilityLabel={notice}
        style={[
          styles.quickRepeatBase,
          {
            backgroundColor: colors.card,
            borderColor: colors.border,
            bottom,
          },
        ]}
      >
        <Ionicons
          name={isLoading ? 'time-outline' : 'alert-circle-outline'}
          size={18}
          color={colors.textSecondary}
        />
        <Text
          style={[
            styles.quickRepeatNoticeText,
            { color: colors.textSecondary },
          ]}
        >
          {notice}
        </Text>
      </View>
    );
  }

  if (!showQuickRepeat || !lastTransaction) {
    return null;
  }

  return (
    <Pressable
      style={[
        styles.quickRepeatBase,
        styles.quickRepeatButton,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          bottom,
        },
      ]}
      onPress={onQuickRepeat}
      accessibilityRole="button"
      accessibilityLabel={`Repeat last ${title} transaction`}
    >
      <Ionicons name="refresh" size={18} color={colors.tint} />
      <View style={styles.quickRepeatCopy}>
        <Text style={[styles.quickRepeatLabel, { color: colors.text }]}>
          Repeat last {title}
        </Text>
        <Text
          style={[styles.quickRepeatDetail, { color: colors.textSecondary }]}
          numberOfLines={1}
        >
          {QUICK_REPEAT_AMOUNT_FORMATTER.format(lastTransaction.amount)}
        </Text>
      </View>
    </Pressable>
  );
}
