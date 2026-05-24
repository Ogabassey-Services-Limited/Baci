import Ionicons from "@react-native-vector-icons/ionicons/static";
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import type React from 'react';
import {
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  useColorScheme,
  View,
} from 'react-native';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInUp,
  SlideInDown,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  ZoomIn,
} from 'react-native-reanimated';
import Colors, {
  BRAND,
  palette,
  RADIUS,
  SHADOWS,
  SPACING,
  TYPOGRAPHY,
} from '@/constants/Colors';

export type PermissionType = 'notifications' | 'tracking';

interface PermissionModalProps {
  visible: boolean;
  type: PermissionType;
  onGrant: () => void;
  onDeny: () => void;
}

const CONTENT = {
  notifications: {
    icon: 'notifications' as const,
    title: 'Stay Updated',
    message:
      'Enable notifications to get real-time updates on your orders and be the first to know about exclusive flash sales.',
    action: 'Enable Notifications',
  },
  tracking: {
    icon: 'compass' as const,
    title: 'Personalized For You',
    message:
      'Allow us to tailor your shopping experience. We use this to show you products and deals that match your unique style.',
    action: 'Allow Personalization',
  },
};

const CATEGORY_LABELS: Record<PermissionType, string> = {
  notifications: 'NOTIFICATIONS',
  tracking: 'PERSONALIZATION',
};

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export const PermissionModal: React.FC<PermissionModalProps> = ({
  visible,
  type,
  onGrant,
  onDeny,
}) => {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const theme = Colors[colorScheme ?? 'light'];
  const content = CONTENT[type];

  const buttonScale = useSharedValue(1);

  const animatedButtonStyle = useAnimatedStyle(() => ({
    transform: [{ scale: buttonScale.get() }],
  }));

  if (!visible) return null;

  const handleGrant = () => {
    if (Platform.OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    onGrant();
  };

  const handleDeny = () => {
    if (Platform.OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    onDeny();
  };

  const handlePressIn = () => {
    buttonScale.set(withSpring(0.96, { damping: 15, stiffness: 300 }));
  };

  const handlePressOut = () => {
    buttonScale.set(withSpring(1, { damping: 12, stiffness: 200 }));
  };

  const accentGradient: readonly [string, string] = isDark
    ? [palette.amber[500], palette.amber[600]]
    : [BRAND.primary, BRAND.primaryDark];

  const iconBgGradient: readonly [string, string] = isDark
    ? [`${palette.amber[100]}20`, `${palette.amber[500]}08`]
    : [palette.red[50], `${palette.red[100]}60`];

  const accentStripeColors: readonly [string, string, string] = isDark
    ? [palette.amber[600], palette.amber[400], palette.amber[600]]
    : [BRAND.primaryDark, BRAND.primary, palette.red[400]];

  const accentColor = isDark ? palette.amber[500] : BRAND.primary;
  const accentBgTint = isDark ? `${palette.amber[500]}12` : palette.red[50];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        <Animated.View
          entering={SlideInDown.springify().damping(18).stiffness(140)}
          style={[
            styles.card,
            {
              backgroundColor: theme.card,
              borderColor: isDark
                ? `${palette.gray[700]}40`
                : palette.gray[200],
            },
          ]}
        >
          {/* Branded accent stripe */}
          <View style={styles.accentStripe}>
            <LinearGradient
              colors={accentStripeColors}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={StyleSheet.absoluteFill}
            />
          </View>

          {/* Geometric icon stage */}
          <Animated.View
            entering={ZoomIn.delay(150).springify().damping(12)}
            style={styles.iconStage}
          >
            <View
              style={[
                styles.diamond,
                {
                  backgroundColor: isDark
                    ? `${palette.amber[500]}0A`
                    : palette.red[50],
                  borderColor: isDark
                    ? `${palette.amber[500]}15`
                    : `${palette.red[200]}50`,
                },
              ]}
            />
            <View style={styles.iconCircle}>
              <LinearGradient
                colors={iconBgGradient}
                style={StyleSheet.absoluteFill}
                start={{ x: 0.2, y: 0 }}
                end={{ x: 0.8, y: 1 }}
              />
              <Ionicons name={content.icon} size={26} color={accentColor} />
            </View>
          </Animated.View>

          {/* Category label pill */}
          <Animated.Text
            entering={FadeIn.delay(250).duration(400)}
            style={[
              styles.label,
              { color: accentColor, backgroundColor: accentBgTint },
            ]}
          >
            {CATEGORY_LABELS[type]}
          </Animated.Text>

          {/* Title */}
          <Animated.Text
            entering={FadeInDown.delay(300)
              .duration(400)
              .springify()
              .damping(20)}
            style={[styles.title, { color: theme.foreground }]}
          >
            {content.title}
          </Animated.Text>

          {/* Body */}
          <Animated.Text
            entering={FadeIn.delay(400).duration(500)}
            style={[styles.message, { color: theme.textSecondary }]}
          >
            {content.message}
          </Animated.Text>

          {/* Actions */}
          <Animated.View
            entering={FadeInUp.delay(450).duration(400).springify().damping(18)}
            style={styles.actions}
          >
            <AnimatedPressable
              onPress={handleGrant}
              onPressIn={handlePressIn}
              onPressOut={handlePressOut}
              style={[styles.primaryButton, animatedButtonStyle]}
              accessibilityRole="button"
              accessibilityLabel={content.action}
            >
              <LinearGradient
                colors={accentGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
              <Text style={styles.primaryButtonText}>{content.action}</Text>
            </AnimatedPressable>

            <Pressable
              onPress={handleDeny}
              style={({ pressed }) => [
                styles.secondaryButton,
                pressed && {
                  backgroundColor: isDark
                    ? palette.gray[800]
                    : palette.gray[100],
                },
              ]}
              accessibilityRole="button"
              accessibilityLabel="Maybe Later"
            >
              <Text
                style={[
                  styles.secondaryButtonText,
                  { color: theme.textSecondary },
                ]}
              >
                Maybe Later
              </Text>
            </Pressable>
          </Animated.View>
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.lg,
  },
  card: {
    width: '100%',
    maxWidth: 348,
    borderRadius: RADIUS['3xl'],
    paddingHorizontal: SPACING.xl,
    paddingTop: 0,
    paddingBottom: 36,
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    ...SHADOWS.xl,
  },
  accentStripe: {
    width: '100%',
    height: 3,
    marginBottom: 28,
  },
  iconStage: {
    width: 96,
    height: 96,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  diamond: {
    position: 'absolute',
    width: 80,
    height: 80,
    borderRadius: RADIUS['2xl'],
    transform: [{ rotate: '45deg' }],
    borderWidth: 1,
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: RADIUS.full,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  label: {
    fontSize: TYPOGRAPHY.size.xs,
    fontFamily: 'Inter_600SemiBold',
    fontWeight: '600',
    letterSpacing: 1.5,
    paddingHorizontal: SPACING.md,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
    overflow: 'hidden',
    marginBottom: SPACING.md,
  },
  title: {
    fontSize: TYPOGRAPHY.size.xl,
    fontFamily: 'Inter_700Bold',
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: SPACING.sm,
    letterSpacing: -0.5,
  },
  message: {
    fontSize: TYPOGRAPHY.size.sm,
    fontFamily: 'Inter_400Regular',
    fontWeight: '400',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 28,
    paddingHorizontal: SPACING.xs,
  },
  actions: {
    width: '100%',
    gap: SPACING.sm,
  },
  primaryButton: {
    width: '100%',
    height: 54,
    borderRadius: RADIUS.xl,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: BRAND.primary,
    ...SHADOWS.lg,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: TYPOGRAPHY.size.base,
    fontFamily: 'Inter_600SemiBold',
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  secondaryButton: {
    width: '100%',
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: RADIUS.lg,
  },
  secondaryButtonText: {
    fontSize: TYPOGRAPHY.size.sm,
    fontFamily: 'Inter_500Medium',
    fontWeight: '500',
    textAlign: 'center',
  },
});
