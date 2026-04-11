import { Text, View } from 'react-native';
import type { ThemeColors } from '@/constants/theme';
import { styles } from './ShipmentFlowSheet.styles';

interface ShipmentFlowProgressProps {
  colors: ThemeColors;
  currentStepIndex: number;
  steps: Array<{
    id: 'details' | 'method' | 'rider';
    label: string;
  }>;
}

export function ShipmentFlowProgress({
  colors,
  currentStepIndex,
  steps,
}: ShipmentFlowProgressProps) {
  return (
    <View style={styles.stepRow}>
      {steps.map((item, index) => {
        const isActive = index <= currentStepIndex;
        const isCurrent = index === currentStepIndex;
        return (
          <View
            key={item.id}
            accessible
            accessibilityRole="text"
            accessibilityLabel={`Step ${index + 1}: ${item.label}. ${
              isCurrent
                ? 'Current step'
                : isActive
                  ? 'Completed'
                  : 'Not completed'
            }.`}
            accessibilityState={{ selected: isCurrent }}
            style={styles.stepItem}
          >
            <View
              style={[
                styles.stepDot,
                {
                  backgroundColor: isActive
                    ? colors.primary
                    : colors.backgroundLight,
                  borderColor: isCurrent ? colors.primary : colors.border,
                },
              ]}
            >
              <Text
                style={[
                  styles.stepDotText,
                  {
                    color: isActive
                      ? colors.textOnPrimary
                      : colors.textSecondary,
                  },
                ]}
              >
                {index + 1}
              </Text>
            </View>
            <Text
              style={[
                styles.stepLabel,
                {
                  color: isCurrent ? colors.text : colors.textSecondary,
                },
              ]}
            >
              {item.label}
            </Text>
          </View>
        );
      })}
    </View>
  );
}
