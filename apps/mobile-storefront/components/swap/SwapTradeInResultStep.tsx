import Ionicons from '@react-native-vector-icons/ionicons';
import { Pressable, Text, View } from 'react-native';
import { getSwapGradeColor } from '@/lib/swap-utils';
import type { SwapResultStepProps } from './SwapTradeInModal.types';
import { swapScreenStyles as styles } from './swap-screen.styles';

export function SwapTradeInResultStep({
  colors,
  onAcceptOffer,
  onReset,
  result,
}: SwapResultStepProps) {
  if (!result) {
    return null;
  }

  return (
    <>
      <View style={[styles.valueCard, { backgroundColor: colors.muted }]}>
        <Text style={[styles.valueLabel, { color: colors.success }]}>
          Estimated Trade-in Value
        </Text>
        <Text style={[styles.valueAmount, { color: colors.success }]}>
          N{result.estimatedValue.toLocaleString()}
        </Text>
        {result.basePrice > 0 && (
          <Text style={[styles.valueBase, { color: colors.success }]}>
            Based on market price: N{result.basePrice.toLocaleString()}
          </Text>
        )}
      </View>

      <View style={styles.detailsGrid}>
        <View style={[styles.detailCard, { backgroundColor: colors.card }]}>
          <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>
            Model
          </Text>
          <Text style={[styles.detailValue, { color: colors.text }]}>
            {result.model}
          </Text>
        </View>
        <View style={[styles.detailCard, { backgroundColor: colors.card }]}>
          <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>
            Condition
          </Text>
          <Text
            style={[
              styles.detailValue,
              { color: getSwapGradeColor(result.grade, colors) },
            ]}
          >
            {result.grade}
          </Text>
        </View>
      </View>

      <View style={[styles.observationsCard, { backgroundColor: colors.card }]}>
        <Text style={[styles.observationsTitle, { color: colors.text }]}>
          AI Observations:
        </Text>
        {result.observations.map((observation) => (
          <Text
            key={observation}
            style={[styles.observationItem, { color: colors.textSecondary }]}
          >
            • {observation}
          </Text>
        ))}
        <Text style={[styles.observationNote, { color: colors.textSecondary }]}>
          *Final verification required in-store.
        </Text>
      </View>

      <Pressable
        style={[styles.acceptButton, { backgroundColor: colors.success }]}
        onPress={onAcceptOffer}
      >
        <Text style={[styles.acceptButtonText, { color: colors.white }]}>
          Accept Offer & Chat
        </Text>
        <Ionicons name="checkmark" size={20} color={colors.white} />
      </Pressable>

      <Pressable style={styles.retryButton} onPress={onReset}>
        <Text style={[styles.retryButtonText, { color: colors.textSecondary }]}>
          Try Another Device
        </Text>
      </Pressable>
    </>
  );
}
