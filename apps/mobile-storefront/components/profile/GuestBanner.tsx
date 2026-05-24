import Ionicons from "@react-native-vector-icons/ionicons/static";
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { BRAND, palette, RADIUS, SHADOWS, SPACING } from '@/constants/Colors';

const PERKS = [
  { icon: 'receipt-outline' as const, text: 'Track orders in real-time' },
  { icon: 'sparkles-outline' as const, text: 'Earn loyalty rewards' },
  {
    icon: 'shield-checkmark-outline' as const,
    text: 'Secure checkout & support',
  },
];

export function GuestBanner() {
  return (
    <Animated.View entering={FadeInUp.duration(600)} style={styles.container}>
      <LinearGradient
        colors={[BRAND.primary, BRAND.primaryDark]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <View style={styles.decorCircle} />

      <View style={styles.content}>
        <Ionicons
          name="person-circle"
          size={56}
          color="rgba(255,255,255,0.9)"
        />

        <Text style={styles.title}>Welcome to the family</Text>
        <Text style={styles.subtitle}>
          Sign in to unlock your personalized shopping experience
        </Text>

        <View style={styles.perks}>
          {PERKS.map((perk) => (
            <Animated.View
              key={perk.text}
              entering={FadeInDown.delay(300).duration(400)}
              style={styles.perkRow}
            >
              <View style={styles.perkIcon}>
                <Ionicons
                  name={perk.icon}
                  size={16}
                  color={palette.amber[400]}
                />
              </View>
              <Text style={styles.perkText}>{perk.text}</Text>
            </Animated.View>
          ))}
        </View>

        <Pressable
          style={({ pressed }) => [
            styles.cta,
            pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] },
          ]}
          onPress={() => router.push('/auth/login')}
          accessibilityRole="button"
          accessibilityLabel="Sign in or create account"
        >
          <Text style={styles.ctaText}>Sign In / Create Account</Text>
          <Ionicons name="arrow-forward" size={18} color={BRAND.primaryDark} />
        </Pressable>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: SPACING.md,
    borderRadius: RADIUS['3xl'],
    overflow: 'hidden',
    ...SHADOWS.xl,
  },
  decorCircle: {
    position: 'absolute',
    top: -40,
    right: -40,
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  content: {
    paddingVertical: SPACING.xl,
    paddingHorizontal: SPACING.lg,
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: -0.5,
    textAlign: 'center',
    marginTop: SPACING.md,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: SPACING.lg,
    maxWidth: 260,
  },
  perks: {
    width: '100%',
    gap: 10,
    marginBottom: SPACING.lg,
  },
  perkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  perkIcon: {
    width: 30,
    height: 30,
    borderRadius: RADIUS.md,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  perkText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.85)',
    fontWeight: '500',
  },
  cta: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
    paddingVertical: 16,
    borderRadius: RADIUS['2xl'],
    ...SHADOWS.md,
  },
  ctaText: {
    fontSize: 16,
    fontWeight: '800',
    color: BRAND.primaryDark,
  },
});
