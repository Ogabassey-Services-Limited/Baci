import Ionicons from '@react-native-vector-icons/ionicons';
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
import Colors, { BRAND, palette } from '@/constants/Colors';
import { permissionModalStyles as styles } from './PermissionModal.styles';

interface PermissionModalProps {
  visible: boolean;
  onGrant: () => void;
  onDeny: () => void;
}

const CONTENT = {
  icon: 'notifications' as const,
  title: 'Stay Updated',
  message:
    'Enable notifications to get real-time updates on your orders and be the first to know about exclusive flash sales.',
  action: 'Enable Notifications',
};

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export const PermissionModal: React.FC<PermissionModalProps> = ({
  visible,
  onGrant,
  onDeny,
}) => {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const theme = Colors[colorScheme ?? 'light'];
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
              <Ionicons name={CONTENT.icon} size={26} color={accentColor} />
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
            NOTIFICATIONS
          </Animated.Text>

          {/* Title */}
          <Animated.Text
            entering={FadeInDown.delay(300)
              .duration(400)
              .springify()
              .damping(20)}
            style={[styles.title, { color: theme.foreground }]}
          >
            {CONTENT.title}
          </Animated.Text>

          {/* Body */}
          <Animated.Text
            entering={FadeIn.delay(400).duration(500)}
            style={[styles.message, { color: theme.textSecondary }]}
          >
            {CONTENT.message}
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
              accessibilityLabel={CONTENT.action}
            >
              <LinearGradient
                colors={accentGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
              <Text style={styles.primaryButtonText}>{CONTENT.action}</Text>
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
