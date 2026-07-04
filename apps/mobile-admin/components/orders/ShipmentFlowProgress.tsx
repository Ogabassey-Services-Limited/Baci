import { Text, View } from 'react-native';
import type { ThemeColors } from '@/constants/theme';
import { styles } from './ShipmentFlowSheet.styles';

interface ShipmentFlowProgressProps {
  colors: ThemeColors;
  currentStepIndex: number;
  steps: Array<{
    id: string;
    label: string;
  }>;
}

const COMPACT_PROGRESS_STEP_LIMIT = 4;

export function ShipmentFlowProgress({
  colors,
  currentStepIndex,
  steps,
}: ShipmentFlowProgressProps) {
  if (steps.length > COMPACT_PROGRESS_STEP_LIMIT) {
    const currentStep = steps[currentStepIndex] ?? steps[0];

    return (
      <View
        accessible
        accessibilityRole="text"
        accessibilityLabel={`Step ${currentStepIndex + 1} of ${steps.length}: ${currentStep?.label ?? 'Step'}. Current step.`}
        style={[
          styles.stepCounter,
          {
            backgroundColor: colors.backgroundLight,
            borderColor: colors.border,
          },
        ]}
      >
        <View
          style={[
            styles.stepDot,
            {
              backgroundColor: colors.primary,
              borderColor: colors.primary,
            },
          ]}
        >
          <Text
            style={[
              styles.stepDotText,
              {
                color: colors.textOnPrimary,
              },
            ]}
          >
            {currentStepIndex + 1}
          </Text>
        </View>
        <View style={styles.stepCounterCopy}>
          <Text style={[styles.stepCounterLabel, { color: colors.text }]}>
            {currentStep?.label ?? 'Step'}
          </Text>
          <Text
            style={[styles.stepCounterMeta, { color: colors.textSecondary }]}
          >
            Step {currentStepIndex + 1} of {steps.length}
          </Text>
        </View>
      </View>
    );
  }

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
