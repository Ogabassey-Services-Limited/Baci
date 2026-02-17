/**
 * Repairs Screen — Redesigned
 * Premium repair services page inspired by the Swap & Trade-in design.
 * Uses brand-colored hero, clean step list, full-width service cards.
 */

import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router, Stack } from 'expo-router';
import {
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useColorScheme } from '@/components/useColorScheme';
import Colors, { BRAND, RADIUS, SPACING } from '@/constants/Colors';
import { SUPPORT_WHATSAPP_PHONE } from '@/constants/Support';

// ─── Data ──────────────────────────────────────────────

interface RepairService {
  title: string;
  price: string;
  desc: string;
  icon: keyof typeof Ionicons.glyphMap;
}

const REPAIR_SERVICES: RepairService[] = [
  {
    title: 'Screen Renewal',
    price: 'From ₦25,000',
    desc: "Cracked or unresponsive display? We'll restore it to factory clarity.",
    icon: 'phone-portrait-outline',
  },
  {
    title: 'Battery Boost',
    price: 'From ₦15,000',
    desc: 'Restore all-day power with a genuine battery replacement.',
    icon: 'battery-half-outline',
  },
  {
    title: 'Port Restoration',
    price: 'From ₦12,000',
    desc: "Charging issues? We'll fix or replace your connector port.",
    icon: 'flash-outline',
  },
  {
    title: 'System Revive',
    price: 'From ₦10,000',
    desc: 'Software optimization, OS updates, and performance tuning.',
    icon: 'settings-outline',
  },
];

const HOW_IT_WORKS = [
  {
    title: 'Book Online',
    desc: 'Tap the button below to chat with us on WhatsApp',
    icon: 'chatbubble-ellipses-outline' as const,
  },
  {
    title: 'Drop Off or Ship',
    desc: 'Bring your device in or schedule a pickup',
    icon: 'cube-outline' as const,
  },
  {
    title: 'Expert Repair',
    desc: 'Certified technicians fix it with genuine parts',
    icon: 'construct-outline' as const,
  },
  {
    title: 'Pick Up',
    desc: 'Get your device back, good as new',
    icon: 'checkmark-done-outline' as const,
  },
];

// Imported from shared constant for consistency across the app
const SUPPORT_PHONE = SUPPORT_WHATSAPP_PHONE;

// ─── Component ─────────────────────────────────────────

export default function RepairsScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  const handleBookRepair = (service?: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const serviceText = service ? `\n\nService: ${service}` : '';
    const message = encodeURIComponent(
      `Hello! I'd like to book a device repair.${serviceText}\n\nPlease let me know your available time slots.`
    );
    Linking.openURL(`https://wa.me/${SUPPORT_PHONE}?text=${message}`);
  };

  const handleSwap = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push('/swap');
  };

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
      edges={['bottom', 'left', 'right']}
    >
      <Stack.Screen
        options={{
          title: 'Repair Lab',
          headerLeft: () => (
            <Pressable onPress={() => router.back()}>
              <Ionicons name="arrow-back" size={24} color={colors.text} />
            </Pressable>
          ),
        }}
      />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Hero Card ── */}
        <View style={styles.heroCard}>
          <View style={styles.heroBadge}>
            <Ionicons name="shield-checkmark" size={12} color="#FFF" />
            <Text style={styles.heroBadgeText}>Certified Technicians</Text>
          </View>
          <Text style={styles.heroTitle}>
            Don't Replace It.{'\n'}Repair It.
          </Text>
          <Text style={styles.heroSubtitle}>
            Expert repairs with genuine parts. Every device fixed is one less in
            a landfill — saving you money and the planet.
          </Text>
          <Pressable
            style={styles.heroButton}
            onPress={() => handleBookRepair()}
            accessibilityRole="button"
            accessibilityLabel="Book a Repair"
            accessibilityHint="Opens WhatsApp to schedule a repair with a technician"
          >
            <Text style={styles.heroButtonText}>Book a Repair</Text>
            <Ionicons name="arrow-forward" size={18} color={BRAND.primary} />
          </Pressable>
        </View>

        {/* ── How It Works ── */}
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          How it Works
        </Text>
        <View style={styles.stepsContainer}>
          {HOW_IT_WORKS.map((step, index) => (
            <View
              key={index}
              style={[styles.stepCard, { backgroundColor: colors.card }]}
            >
              <View style={styles.stepIconContainer}>
                <Ionicons name={step.icon} size={24} color={BRAND.primary} />
              </View>
              <View style={styles.stepTextContainer}>
                <Text style={[styles.stepTitle, { color: colors.text }]}>
                  {index + 1}. {step.title}
                </Text>
                <Text
                  style={[styles.stepDesc, { color: colors.textSecondary }]}
                >
                  {step.desc}
                </Text>
              </View>
            </View>
          ))}
        </View>

        {/* ── Services ── */}
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          Our Services
        </Text>
        <View style={styles.servicesList}>
          {REPAIR_SERVICES.map((service, index) => (
            <Pressable
              key={index}
              style={[styles.serviceCard, { backgroundColor: colors.card }]}
              onPress={() => handleBookRepair(service.title)}
              accessibilityRole="button"
              accessibilityLabel={`${service.title}, ${service.price}`}
              accessibilityHint={`Inquire about ${service.title} repair`}
            >
              <View style={styles.serviceIconContainer}>
                <Ionicons name={service.icon} size={22} color={BRAND.primary} />
              </View>
              <View style={styles.serviceContent}>
                <Text style={[styles.serviceTitle, { color: colors.text }]}>
                  {service.title}
                </Text>
                <Text
                  style={[styles.serviceDesc, { color: colors.textSecondary }]}
                >
                  {service.desc}
                </Text>
              </View>
              <View style={styles.servicePriceBadge}>
                <Text style={styles.servicePriceText}>{service.price}</Text>
              </View>
            </Pressable>
          ))}
        </View>

        {/* ── Free Cleaning Banner ── */}
        <View style={styles.freeBanner}>
          <View style={styles.freeBannerIcon}>
            <Ionicons name="sparkles" size={24} color="#059669" />
          </View>
          <View style={styles.freeBannerContent}>
            <Text style={[styles.freeBannerTitle, { color: colors.text }]}>
              Free Port & Speaker Cleaning
            </Text>
            <Text
              style={[styles.freeBannerDesc, { color: colors.textSecondary }]}
            >
              Often, a "broken" port is just dirty. Visit us for a{' '}
              <Text style={{ fontWeight: '700' }}>free cleaning</Text> — no
              appointment needed.
            </Text>
          </View>
        </View>

        {/* ── Trade-in CTA ── */}
        <View style={[styles.tradeinCard, { backgroundColor: colors.card }]}>
          <View style={styles.tradeinContent}>
            <Ionicons name="swap-horizontal" size={24} color={BRAND.primary} />
            <View style={styles.tradeinText}>
              <Text style={[styles.tradeinTitle, { color: colors.text }]}>
                Beyond Repair?
              </Text>
              <Text
                style={[styles.tradeinDesc, { color: colors.textSecondary }]}
              >
                Trade in your old device for credit toward a new one.
              </Text>
            </View>
          </View>
          <Pressable
            style={styles.tradeinButton}
            onPress={handleSwap}
            accessibilityRole="button"
            accessibilityLabel="Trade-in your device"
            accessibilityHint="Navigate to Swap and Trade-in page"
          >
            <Text style={styles.tradeinButtonText}>Trade-in</Text>
            <Ionicons name="arrow-forward" size={16} color={BRAND.primary} />
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ──────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: SPACING.md,
    paddingBottom: 40,
  },

  // ── Hero ──
  heroCard: {
    backgroundColor: BRAND.primary,
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    marginBottom: SPACING.xl,
  },
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignSelf: 'flex-start',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: 20,
    marginBottom: SPACING.md,
  },
  heroBadgeText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  heroTitle: {
    color: '#FFF',
    fontSize: 26,
    fontWeight: '800',
    lineHeight: 32,
    marginBottom: SPACING.sm,
  },
  heroSubtitle: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 13,
    lineHeight: 20,
    marginBottom: SPACING.lg,
  },
  heroButton: {
    backgroundColor: '#FFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.lg,
  },
  heroButtonText: {
    color: BRAND.primary,
    fontSize: 15,
    fontWeight: '700',
  },

  // ── Section Titles ──
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: SPACING.md,
  },

  // ── Steps ──
  stepsContainer: {
    gap: SPACING.sm,
    marginBottom: SPACING.xl,
  },
  stepCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    gap: SPACING.md,
  },
  stepIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: `${BRAND.primary}15`,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepTextContainer: {
    flex: 1,
  },
  stepTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 2,
  },
  stepDesc: {
    fontSize: 12,
    lineHeight: 17,
  },

  // ── Services ──
  servicesList: {
    gap: SPACING.sm,
    marginBottom: SPACING.xl,
  },
  serviceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    gap: SPACING.md,
  },
  serviceIconContainer: {
    width: 44,
    height: 44,
    borderRadius: RADIUS.md,
    backgroundColor: `${BRAND.primary}15`,
    justifyContent: 'center',
    alignItems: 'center',
  },
  serviceContent: {
    flex: 1,
  },
  serviceTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 2,
  },
  serviceDesc: {
    fontSize: 12,
    lineHeight: 17,
  },
  servicePriceBadge: {
    backgroundColor: `${BRAND.primary}15`,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: RADIUS.md,
  },
  servicePriceText: {
    color: BRAND.primary,
    fontSize: 11,
    fontWeight: '700',
  },

  // ── Free Cleaning Banner ──
  freeBanner: {
    flexDirection: 'row',
    backgroundColor: '#ECFDF5',
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    gap: SPACING.md,
    marginBottom: SPACING.lg,
    alignItems: 'flex-start',
  },
  freeBannerIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#D1FAE5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  freeBannerContent: {
    flex: 1,
  },
  freeBannerTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4,
  },
  freeBannerDesc: {
    fontSize: 12,
    lineHeight: 18,
  },

  // ── Trade-in CTA ──
  tradeinCard: {
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.lg,
  },
  tradeinContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    marginBottom: SPACING.md,
  },
  tradeinText: {
    flex: 1,
  },
  tradeinTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 2,
  },
  tradeinDesc: {
    fontSize: 12,
    lineHeight: 17,
  },
  tradeinButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: BRAND.primary,
  },
  tradeinButtonText: {
    color: BRAND.primary,
    fontSize: 13,
    fontWeight: '700',
  },
});
