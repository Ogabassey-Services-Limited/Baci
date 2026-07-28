import Ionicons from '@react-native-vector-icons/ionicons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { RADIUS, SPACING, TYPOGRAPHY } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';

interface ProgressCardProps {
  title: string;
  subtitle?: string;
  progress: number; // 0-100
  onPress?: () => void;
}

export function ProgressCard({
  title,
  subtitle,
  progress,
  onPress,
}: ProgressCardProps) {
  const { colors, shadows } = useTheme();
  const size = 48;
  const strokeWidth = 5;
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.card,
          borderColor: colors.primary,
        },
        shadows.sm,
      ]}
    >
      <Pressable
        style={({ pressed }) => [styles.pressable, pressed && { opacity: 0.7 }]}
        onPress={onPress}
        disabled={!onPress}
        android_ripple={{ color: colors.cardHover }}
        accessibilityRole="button"
        accessibilityState={{ disabled: !onPress }}
        accessibilityLabel={`${title}, ${Math.round(progress)}% complete${subtitle ? `, ${subtitle}` : ''}`}
        accessibilityHint={onPress ? 'View details' : ''}
      >
        <View style={styles.content}>
          <View>
            <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
            {subtitle ? (
              <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                {subtitle}
              </Text>
            ) : null}
          </View>

          <View style={styles.progressContainer}>
            <Svg width={size} height={size} style={styles.progressSvg}>
              {/* Background circle */}
              <Circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                stroke={colors.border}
                strokeWidth={strokeWidth}
                fill="none"
              />
              {/* Progress circle */}
              <Circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                stroke={colors.gold}
                strokeWidth={strokeWidth}
                fill="none"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                transform={`rotate(-90 ${size / 2} ${size / 2})`}
              />
            </Svg>
            <View style={styles.progressTextContainer}>
              <Text style={[styles.progressText, { color: colors.gold }]}>
                {Math.round(progress)}%
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.arrow}>
          <Ionicons
            name="chevron-forward"
            size={20}
            color={colors.textSecondary}
          />
        </View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    overflow: 'hidden',
  },
  pressable: {
    padding: SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
  },
  content: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontSize: TYPOGRAPHY.size.sm,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    marginBottom: 2,
  },
  subtitle: {
    fontSize: TYPOGRAPHY.size.xs,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
  },
  progressContainer: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressSvg: {
    transform: [{ rotateZ: '0deg' }],
  },
  progressTextContainer: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressText: {
    fontSize: TYPOGRAPHY.size.xs,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
  },
  arrow: {
    marginLeft: SPACING.sm,
  },
});
