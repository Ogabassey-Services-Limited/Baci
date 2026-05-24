import Ionicons, { type IoniconsIconName } from "@react-native-vector-icons/ionicons/static";
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import type { ThemeColors } from '@/constants/theme';
import type {
  ShipmentCompletionMode,
  ShipmentFlowStep,
} from '@/lib/order-shipment';
import { styles } from './ShipmentFlowSheet.styles';

interface ShipmentFlowFooterProps {
  colors: ThemeColors;
  isSubmitting: boolean;
  onBack: () => void;
  onPrimaryAction: () => void;
  primaryActionLabel: string;
  selectedMode: ShipmentCompletionMode;
  showBack: boolean;
  step: ShipmentFlowStep;
}

function getPrimaryIconName(
  step: ShipmentFlowStep,
  selectedMode: ShipmentCompletionMode
): IoniconsIconName {
  if (step === 'details') {
    return 'arrow-forward';
  }

  if (step === 'method' && selectedMode === 'self_fulfillment') {
    return 'bicycle-outline';
  }

  return 'checkmark-circle-outline';
}

export function ShipmentFlowFooter({
  colors,
  isSubmitting,
  onBack,
  onPrimaryAction,
  primaryActionLabel,
  selectedMode,
  showBack,
  step,
}: ShipmentFlowFooterProps) {
  return (
    <View style={styles.footer}>
      {showBack ? (
        <Pressable
          accessibilityLabel="Back"
          accessibilityRole="button"
          accessibilityState={{ disabled: isSubmitting }}
          disabled={isSubmitting}
          onPress={onBack}
          style={[
            styles.secondaryButton,
            { backgroundColor: colors.backgroundLight },
            isSubmitting ? styles.secondaryButtonDisabled : null,
          ]}
        >
          <Text style={[styles.secondaryButtonText, { color: colors.text }]}>
            Back
          </Text>
        </Pressable>
      ) : null}

      <Pressable
        accessibilityLabel={primaryActionLabel}
        accessibilityRole="button"
        accessibilityState={{ disabled: isSubmitting }}
        disabled={isSubmitting}
        onPress={onPrimaryAction}
        style={[
          styles.primaryButton,
          { backgroundColor: colors.primary },
          showBack ? null : styles.primaryButtonFull,
          isSubmitting ? styles.primaryButtonDisabled : null,
        ]}
      >
        {isSubmitting ? (
          <ActivityIndicator color={colors.textOnPrimary} size="small" />
        ) : (
          <>
            <Ionicons
              color={colors.textOnPrimary}
              name={getPrimaryIconName(step, selectedMode)}
              size={18}
            />
            <Text
              style={[
                styles.primaryButtonText,
                { color: colors.textOnPrimary },
              ]}
            >
              {primaryActionLabel}
            </Text>
          </>
        )}
      </Pressable>
    </View>
  );
}
