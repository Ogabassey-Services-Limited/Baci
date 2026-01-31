/**
 * Repairs Screen
 * Device repair services and information
 * Extends device lifespan and reduces e-waste
 */

import { Ionicons } from '@expo/vector-icons';
import { router, Stack } from 'expo-router';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useColorScheme } from '@/components/useColorScheme';
import Colors, { BRAND, RADIUS, SPACING } from '@/constants/Colors';

interface RepairService {
  title: string;
  price: string;
  desc: string;
  icon: keyof typeof Ionicons.glyphMap;
}

const REPAIR_SERVICES: RepairService[] = [
  {
    title: 'Screen Renewal',
    price: 'From N25,000',
    desc: "Don't let a crack end its life.",
    icon: 'phone-portrait-outline',
  },
  {
    title: 'Battery Boost',
    price: 'From N15,000',
    desc: 'Restore all-day power.',
    icon: 'battery-half-outline',
  },
  {
    title: 'Port Restoration',
    price: 'From N12,000',
    desc: 'Fix charging connection issues.',
    icon: 'flash-outline',
  },
  {
    title: 'System Revive',
    price: 'From N10,000',
    desc: 'Software fixes & optimization.',
    icon: 'settings-outline',
  },
];

const IMPACT_CARDS = [
  {
    title: 'Extend Lifespan',
    desc: "Repairing adds 2-3 years to your device's life, saving you the cost of a new phone.",
    icon: 'heart-outline' as const,
    color: BRAND.primary,
    bg: `${BRAND.primary}15`,
  },
  {
    title: 'Reduce E-Waste',
    desc: 'Electronic waste is toxic. Repairing keeps hazardous materials out of the soil.',
    icon: 'leaf-outline' as const,
    color: '#059669',
    bg: '#ECFDF5',
  },
  {
    title: 'Data Safety',
    desc: 'Keep your photos and files. Transferring data to a new device is risky; keeping yours is safe.',
    icon: 'shield-checkmark-outline' as const,
    color: '#2563EB',
    bg: '#EFF6FF',
  },
];

const RECYCLING_INFO = [
  {
    title: 'Safe Disposal',
    desc: 'of Lithium Batteries',
    icon: 'warning-outline' as const,
    color: '#DC2626',
    bg: '#FEE2E2',
  },
  {
    title: 'Glass Recycling',
    desc: 'Screens processed correctly',
    icon: 'phone-portrait-outline' as const,
    color: '#6B7280',
    bg: '#F3F4F6',
  },
  {
    title: 'Component Harvest',
    desc: 'Chips reused for repairs',
    icon: 'hardware-chip-outline' as const,
    color: '#2563EB',
    bg: '#EFF6FF',
  },
];

const SUPPORT_PHONE = '2348146978921';

export default function RepairsScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  const handleBookRepair = () => {
    const message = encodeURIComponent(
      `Hello! I'd like to book a device repair.\n\nPlease let me know your available time slots.`
    );
    Linking.openURL(`https://wa.me/${SUPPORT_PHONE}?text=${message}`);
  };

  const handleVisitStore = () => {
    Linking.openURL(`https://wa.me/${SUPPORT_PHONE}`);
  };

  const handleSwap = () => {
    router.push('/swap');
  };

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
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
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerIcon}>
            <Ionicons name="build" size={24} color={BRAND.primary} />
          </View>
          <View style={styles.headerText}>
            <Text style={[styles.headerTitle, { color: colors.text }]}>
              Repair Lab
            </Text>
            <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>
              Expert repairs that save you money
            </Text>
          </View>
        </View>

        {/* Hero Card */}
        <View style={styles.heroCard}>
          <View style={styles.heroBadge}>
            <Ionicons name="sparkles" size={12} color={BRAND.primary} />
            <Text style={styles.heroBadgeText}>Premium Service</Text>
          </View>
          <Text style={styles.heroTitle}>
            Don't Ditch It.{'\n'}
            <Text style={{ color: BRAND.primary }}>Fix It.</Text>
          </Text>
          <Text style={styles.heroSubtitle}>
            Every device repaired is one less in a landfill. Our certified
            technicians use genuine parts to give your gadget a second life.
          </Text>
          <View style={styles.heroButtons}>
            <Pressable style={styles.primaryButton} onPress={handleBookRepair}>
              <Text style={styles.primaryButtonText}>Book a Repair</Text>
            </Pressable>
            <Pressable
              style={[styles.secondaryButton, { borderColor: 'rgba(255,255,255,0.3)' }]}
              onPress={handleSwap}
            >
              <Text style={styles.secondaryButtonText}>Trade-in Instead</Text>
            </Pressable>
          </View>
        </View>

        {/* Impact Cards */}
        <View style={styles.impactContainer}>
          {IMPACT_CARDS.map((card, index) => (
            <View
              key={index}
              style={[styles.impactCard, { backgroundColor: colors.card }]}
            >
              <View style={[styles.impactIcon, { backgroundColor: card.bg }]}>
                <Ionicons name={card.icon} size={24} color={card.color} />
              </View>
              <Text style={[styles.impactTitle, { color: colors.text }]}>
                {card.title}
              </Text>
              <Text style={[styles.impactDesc, { color: colors.textSecondary }]}>
                {card.desc}
              </Text>
            </View>
          ))}
        </View>

        {/* Services Section */}
        <View style={styles.servicesSection}>
          <View style={styles.servicesHeader}>
            <Ionicons name="build" size={18} color={BRAND.primary} />
            <Text style={[styles.servicesTitle, { color: colors.text }]}>
              Restoration Services
            </Text>
          </View>

          <View style={styles.servicesGrid}>
            {REPAIR_SERVICES.map((service, index) => (
              <Pressable
                key={index}
                style={[styles.serviceCard, { backgroundColor: colors.card }]}
              >
                <View
                  style={[styles.serviceIcon, { backgroundColor: colors.background }]}
                >
                  <Ionicons
                    name={service.icon}
                    size={22}
                    color={colors.textSecondary}
                  />
                </View>
                <Text style={[styles.serviceTitle, { color: colors.text }]}>
                  {service.title}
                </Text>
                <Text
                  style={[styles.serviceDesc, { color: colors.textSecondary }]}
                >
                  {service.desc}
                </Text>
                <View style={styles.serviceFooter}>
                  <Text style={[styles.servicePrice, { color: BRAND.primary }]}>
                    {service.price}
                  </Text>
                  <Ionicons
                    name="chevron-forward"
                    size={16}
                    color={colors.textSecondary}
                  />
                </View>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Preventative Care Banner */}
        <View style={[styles.careCard, { backgroundColor: colors.card }]}>
          <View style={styles.careIconContainer}>
            <Ionicons name="sparkles" size={32} color={BRAND.primary} />
          </View>
          <View style={styles.careContent}>
            <Text style={[styles.careTitle, { color: colors.text }]}>
              Preventative Care is Free
            </Text>
            <Text style={[styles.careDesc, { color: colors.textSecondary }]}>
              Often, a "broken" charging port is just dirty. Visit us for a{' '}
              <Text style={{ fontWeight: '700' }}>free cleaning service</Text>.
              We'll clear out dust and lint from your speakers and ports.
            </Text>
          </View>
          <Pressable
            style={[styles.careButton, { backgroundColor: colors.text }]}
            onPress={handleVisitStore}
          >
            <Text style={styles.careButtonText}>Visit Store</Text>
          </Pressable>
        </View>

        {/* Recycling Section */}
        <View style={styles.recyclingSection}>
          <View style={styles.recyclingIcon}>
            <Ionicons name="sync" size={28} color="#6B7280" />
          </View>
          <Text style={[styles.recyclingTitle, { color: colors.text }]}>
            Beyond Repair? Recycle Responsibly.
          </Text>
          <Text style={[styles.recyclingDesc, { color: colors.textSecondary }]}>
            If your device is truly at the end of its life, don't throw it in
            the trash. Electronic waste contains harmful chemicals. Drop it off
            at any of our locations, and we will ensure it is recycled safely.
          </Text>

          <View style={styles.recyclingGrid}>
            {RECYCLING_INFO.map((item, index) => (
              <View
                key={index}
                style={[styles.recyclingCard, { backgroundColor: colors.card }]}
              >
                <View style={[styles.recyclingCardIcon, { backgroundColor: item.bg }]}>
                  <Ionicons name={item.icon} size={18} color={item.color} />
                </View>
                <View style={styles.recyclingCardText}>
                  <Text
                    style={[styles.recyclingCardTitle, { color: colors.text }]}
                  >
                    {item.title}
                  </Text>
                  <Text
                    style={[
                      styles.recyclingCardDesc,
                      { color: colors.textSecondary },
                    ]}
                  >
                    {item.desc}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    marginBottom: SPACING.lg,
  },
  headerIcon: {
    width: 44,
    height: 44,
    borderRadius: RADIUS.md,
    backgroundColor: `${BRAND.primary}15`,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerText: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
  },
  headerSubtitle: {
    fontSize: 14,
    marginTop: 2,
  },
  heroCard: {
    backgroundColor: '#1A1A1A',
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    marginBottom: SPACING.xl,
  },
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: `${BRAND.primary}30`,
    borderWidth: 1,
    borderColor: `${BRAND.primary}40`,
    alignSelf: 'flex-start',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: 20,
    marginBottom: SPACING.md,
  },
  heroBadgeText: {
    color: BRAND.primary,
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  heroTitle: {
    color: '#FFF',
    fontSize: 28,
    fontWeight: '800',
    lineHeight: 34,
    marginBottom: SPACING.sm,
  },
  heroSubtitle: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 13,
    lineHeight: 20,
    marginBottom: SPACING.lg,
  },
  heroButtons: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  primaryButton: {
    backgroundColor: BRAND.primary,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    borderRadius: RADIUS.lg,
  },
  primaryButtonText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '700',
  },
  secondaryButton: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
  },
  secondaryButtonText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
  impactContainer: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginBottom: SPACING.xl,
  },
  impactCard: {
    flex: 1,
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    alignItems: 'center',
  },
  impactIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  impactTitle: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 4,
    textAlign: 'center',
  },
  impactDesc: {
    fontSize: 10,
    textAlign: 'center',
    lineHeight: 14,
  },
  servicesSection: {
    marginBottom: SPACING.xl,
  },
  servicesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    marginBottom: SPACING.md,
  },
  servicesTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  servicesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  serviceCard: {
    width: '48%',
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
  },
  serviceIcon: {
    width: 44,
    height: 44,
    borderRadius: RADIUS.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  serviceTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4,
  },
  serviceDesc: {
    fontSize: 11,
    lineHeight: 16,
    marginBottom: SPACING.sm,
  },
  serviceFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
  },
  servicePrice: {
    fontSize: 13,
    fontWeight: '700',
  },
  careCard: {
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.xl,
  },
  careIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: `${BRAND.primary}15`,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  careContent: {
    marginBottom: SPACING.md,
  },
  careTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: SPACING.xs,
  },
  careDesc: {
    fontSize: 13,
    lineHeight: 20,
  },
  careButton: {
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    borderRadius: RADIUS.lg,
    alignSelf: 'flex-start',
  },
  careButtonText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '700',
  },
  recyclingSection: {
    backgroundColor: '#F3F4F6',
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    alignItems: 'center',
  },
  recyclingIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#FFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  recyclingTitle: {
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: SPACING.sm,
  },
  recyclingDesc: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: SPACING.lg,
  },
  recyclingGrid: {
    width: '100%',
    gap: SPACING.sm,
  },
  recyclingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    gap: SPACING.sm,
  },
  recyclingCardIcon: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  recyclingCardText: {
    flex: 1,
  },
  recyclingCardTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  recyclingCardDesc: {
    fontSize: 11,
  },
});
