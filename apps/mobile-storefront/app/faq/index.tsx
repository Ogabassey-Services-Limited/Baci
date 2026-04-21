/**
 * Help & Support / FAQ Screen
 * Common questions and support contact options
 */

import { Ionicons } from '@expo/vector-icons';
import * as Linking from 'expo-linking';
import { Stack } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useColorScheme } from '@/components/useColorScheme';
import Colors, { BRAND, RADIUS, SPACING, TYPOGRAPHY } from '@/constants/Colors';
import { SUPPORT_PHONE, SUPPORT_WHATSAPP_PHONE } from '@/constants/Support';

interface FAQItem {
  id: string;
  question: string;
  answer: string;
}

const faqItems: FAQItem[] = [
  {
    id: '1',
    question: 'How do I track my order?',
    answer:
      'You can track your order by going to "Orders" in the menu. Each order has a status indicator and tracking information when available. You\'ll also receive SMS and email updates as your order progresses.',
  },
  {
    id: '2',
    question: 'What payment methods do you accept?',
    answer:
      'We accept multiple payment methods including card payments via Paystack, bank transfers, and Pay on Delivery. We also offer Buy Now Pay Later options through CredPal and Credit Direct for eligible orders.',
  },
  {
    id: '3',
    question: 'How long does delivery take?',
    answer:
      'Delivery times vary based on your location. Lagos deliveries typically take 1-2 business days, while other states take 2-5 business days. Same-day delivery is available for select areas within Lagos.',
  },
  {
    id: '4',
    question: 'Can I return or exchange an item?',
    answer:
      'Yes! We offer a 7-day return policy for most items. The product must be in its original condition with all accessories. Contact our support team to initiate a return or exchange.',
  },
  {
    id: '5',
    question: "How do I verify a phone\'s IMEI?",
    answer:
      "Use our IMEI Checker feature in the app. Enter the 15-digit IMEI number to check if the device is blacklisted, iCloud locked, or has any other issues. This helps ensure you\'re buying a legitimate device.",
  },
  {
    id: '6',
    question: 'What is the Swap/Trade-in program?',
    answer:
      'Our trade-in program lets you exchange your old device for credit towards a new purchase. Simply upload a video of your device, and our AI will provide an instant valuation. Contact us via WhatsApp to complete the swap.',
  },
  {
    id: '7',
    question: 'Are your products genuine?',
    answer:
      'Yes, all our products are 100% authentic. We source directly from authorized distributors and offer warranty on all new devices. Pre-owned devices are thoroughly tested and verified.',
  },
];

interface SupportOption {
  id: string;
  title: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  action: () => void;
}

export default function FAQScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const STORE_ADDRESS = 'Computer Village, Ikeja, Lagos';
  const STORE_HOURS_WEEKDAY = 'Monday - Saturday: 9:00 AM - 7:00 PM';
  const STORE_HOURS_WEEKEND = 'Sunday: 12:00 PM - 5:00 PM';

  const supportOptions: SupportOption[] = [
    {
      id: 'whatsapp',
      title: 'WhatsApp Support',
      subtitle: 'Chat with us directly',
      icon: 'logo-whatsapp',
      action: () =>
        Linking.openURL(
          `https://wa.me/${SUPPORT_WHATSAPP_PHONE}?text=${encodeURIComponent('Hi, I need help with my order')}`
        ).catch(() => Alert.alert('Unable to Open', 'Please try again later')),
    },
    {
      id: 'call',
      title: 'Call Us',
      subtitle: SUPPORT_PHONE,
      icon: 'call-outline',
      action: () =>
        Linking.openURL(`tel:+234${SUPPORT_PHONE.slice(1)}`).catch(() =>
          Alert.alert('Unable to Open', 'Please try again later')
        ),
    },
    {
      id: 'email',
      title: 'Email Support',
      subtitle: 'support@ogabassey.com',
      icon: 'mail-outline',
      action: () =>
        Linking.openURL('mailto:support@ogabassey.com').catch(() =>
          Alert.alert('Unable to Open', 'Please try again later')
        ),
    },
  ];

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
      edges={['bottom']}
    >
      <Stack.Screen
        options={{
          title: 'Help & Support',
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.text,
        }}
      />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Support Options */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Contact Us
          </Text>
          <View style={styles.supportGrid}>
            {supportOptions.map((option) => (
              <Pressable
                key={option.id}
                style={[styles.supportCard, { backgroundColor: colors.card }]}
                onPress={option.action}
              >
                <View
                  style={[
                    styles.supportIconContainer,
                    {
                      backgroundColor:
                        option.id === 'whatsapp'
                          ? '#25D366'
                          : `${BRAND.primary}15`,
                    },
                  ]}
                >
                  <Ionicons
                    name={option.icon}
                    size={24}
                    color={option.id === 'whatsapp' ? '#FFF' : BRAND.primary}
                  />
                </View>
                <Text style={[styles.supportTitle, { color: colors.text }]}>
                  {option.title}
                </Text>
                <Text
                  style={[
                    styles.supportSubtitle,
                    { color: colors.textSecondary },
                  ]}
                >
                  {option.subtitle}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* FAQ Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Frequently Asked Questions
          </Text>

          <View style={styles.faqList}>
            {faqItems.map((item) => {
              const isExpanded = expandedId === item.id;
              return (
                <Pressable
                  key={item.id}
                  style={[
                    styles.faqItem,
                    {
                      backgroundColor: colors.card,
                      borderColor: colors.border,
                    },
                  ]}
                  onPress={() => toggleExpand(item.id)}
                  accessibilityRole="button"
                  accessibilityState={{ expanded: isExpanded }}
                  accessibilityLabel={item.question}
                >
                  <View style={styles.faqHeader}>
                    <Text
                      style={[styles.faqQuestion, { color: colors.text }]}
                      numberOfLines={isExpanded ? undefined : 2}
                    >
                      {item.question}
                    </Text>
                    <Ionicons
                      name={isExpanded ? 'chevron-up' : 'chevron-down'}
                      size={20}
                      color={colors.textSecondary}
                    />
                  </View>
                  {isExpanded && (
                    <Text
                      style={[
                        styles.faqAnswer,
                        { color: colors.textSecondary },
                      ]}
                    >
                      {item.answer}
                    </Text>
                  )}
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Store Info */}
        <View style={[styles.storeInfo, { backgroundColor: colors.card }]}>
          <Text style={[styles.storeInfoTitle, { color: colors.text }]}>
            Store Hours
          </Text>
          <Text style={[styles.storeInfoText, { color: colors.textSecondary }]}>
            {STORE_HOURS_WEEKDAY}
          </Text>
          <Text style={[styles.storeInfoText, { color: colors.textSecondary }]}>
            {STORE_HOURS_WEEKEND}
          </Text>
          <View style={styles.storeAddressContainer}>
            <Ionicons
              name="location-outline"
              size={16}
              color={colors.textSecondary}
            />
            <Text
              style={[styles.storeInfoText, { color: colors.textSecondary }]}
            >
              {STORE_ADDRESS}
            </Text>
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
    padding: SPACING.lg,
    paddingBottom: SPACING.xl * 2,
  },
  section: {
    marginBottom: SPACING.xl,
  },
  sectionTitle: {
    fontSize: TYPOGRAPHY.size.lg,
    fontFamily: 'Inter_700Bold',
    marginBottom: SPACING.md,
  },
  supportGrid: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  supportCard: {
    flex: 1,
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    alignItems: 'center',
  },
  supportIconContainer: {
    width: 48,
    height: 48,
    borderRadius: RADIUS.full,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  supportTitle: {
    fontSize: TYPOGRAPHY.size.sm,
    fontFamily: 'Inter_600SemiBold',
    textAlign: 'center',
    marginBottom: 2,
  },
  supportSubtitle: {
    fontSize: TYPOGRAPHY.size.xs,
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
  },
  faqList: {
    gap: SPACING.sm,
  },
  faqItem: {
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
  },
  faqHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: SPACING.sm,
  },
  faqQuestion: {
    flex: 1,
    fontSize: TYPOGRAPHY.size.base,
    fontFamily: 'Inter_600SemiBold',
    lineHeight: 22,
  },
  faqAnswer: {
    fontSize: TYPOGRAPHY.size.sm,
    fontFamily: 'Inter_400Regular',
    lineHeight: 22,
    marginTop: SPACING.sm,
  },
  storeInfo: {
    padding: SPACING.lg,
    borderRadius: RADIUS.lg,
  },
  storeInfoTitle: {
    fontSize: TYPOGRAPHY.size.base,
    fontFamily: 'Inter_700Bold',
    marginBottom: SPACING.sm,
  },
  storeInfoText: {
    fontSize: TYPOGRAPHY.size.sm,
    fontFamily: 'Inter_400Regular',
    lineHeight: 22,
  },
  storeAddressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    marginTop: SPACING.sm,
  },
});
