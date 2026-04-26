/**
 * Help & Support / FAQ Screen
 * Common questions and support contact options
 */

import * as Linking from 'expo-linking';
import { Stack } from 'expo-router';
import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { FAQAccordion } from '@/components/faq/FAQAccordion';
import { FAQStoreInfo } from '@/components/faq/FAQStoreInfo';
import {
  FAQSupportGrid,
  type FAQSupportOption,
} from '@/components/faq/FAQSupportGrid';
import { fallbackStoreHours, faqItems } from '@/components/faq/faq-data';
import { StorefrontScreenShell } from '@/components/storefront/StorefrontScreenShell';
import { useColorScheme } from '@/components/useColorScheme';
import Colors, { SPACING, TYPOGRAPHY } from '@/constants/Colors';
import {
  SUPPORT_EMAIL,
  SUPPORT_PHONE_E164,
  SUPPORT_WHATSAPP_PHONE,
} from '@/constants/Support';
import { useMerchant } from '@/hooks/use-merchant';
import { useStorefrontInsets } from '@/hooks/use-storefront-insets';

const SUPPORT_WHATSAPP_MESSAGE = 'Hi, I need help with my order';
const FALLBACK_STORE_ADDRESS =
  'Address available on request. Use the contact options above for the latest store location.';

export default function FAQScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const { getScrollContentStyle } = useStorefrontInsets();
  const { data: merchant } = useMerchant();
  const storeAddress =
    merchant?.business_address?.trim() || FALLBACK_STORE_ADDRESS;

  const openSupportLink = (url: string, title: string, message: string) => {
    void Linking.openURL(url).catch(() => {
      Alert.alert(title, message);
    });
  };

  const supportOptions: FAQSupportOption[] = [
    {
      id: 'whatsapp',
      title: 'WhatsApp Support',
      subtitle: 'Chat with us directly',
      icon: 'logo-whatsapp',
      accessibilityHint: `Starts a WhatsApp chat with support at ${SUPPORT_WHATSAPP_PHONE}`,
      iconBackgroundColor: '#25D366',
      iconColor: '#FFF',
      onPress: () =>
        openSupportLink(
          `https://wa.me/${SUPPORT_WHATSAPP_PHONE}?text=${encodeURIComponent(SUPPORT_WHATSAPP_MESSAGE)}`,
          'Unable to open WhatsApp',
          `Please contact support on WhatsApp at ${SUPPORT_WHATSAPP_PHONE}.`
        ),
    },
    {
      id: 'call',
      title: 'Call Us',
      subtitle: SUPPORT_PHONE_E164,
      icon: 'call-outline',
      accessibilityHint: `Calls support at ${SUPPORT_PHONE_E164}`,
      onPress: () =>
        openSupportLink(
          `tel:${SUPPORT_PHONE_E164}`,
          'Unable to start the call',
          `Please call support at ${SUPPORT_PHONE_E164}.`
        ),
    },
    {
      id: 'email',
      title: 'Email Support',
      subtitle: SUPPORT_EMAIL,
      icon: 'mail-outline',
      accessibilityHint: `Composes an email to ${SUPPORT_EMAIL}`,
      onPress: () =>
        openSupportLink(
          `mailto:${SUPPORT_EMAIL}`,
          'Unable to open your mail app',
          `Please email support at ${SUPPORT_EMAIL}.`
        ),
    },
  ];

  return (
    <StorefrontScreenShell
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
        contentContainerStyle={[
          styles.scrollContent,
          getScrollContentStyle({
            includeBottomInset: false,
            paddingTop: SPACING.lg,
            paddingBottom: SPACING.xl * 2,
          }),
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Contact Us
          </Text>
          <FAQSupportGrid
            cardColor={colors.card}
            defaultIconBackgroundColor={colors.selectedIconBackground}
            options={supportOptions}
            secondaryTextColor={colors.textSecondary}
            textColor={colors.text}
          />
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Frequently Asked Questions
          </Text>
          <FAQAccordion
            borderColor={colors.border}
            cardColor={colors.card}
            expandedId={expandedId}
            items={faqItems}
            onToggle={(id) => {
              setExpandedId((current) => (current === id ? null : id));
            }}
            secondaryTextColor={colors.textSecondary}
            textColor={colors.text}
          />
        </View>

        <FAQStoreInfo
          address={storeAddress}
          cardColor={colors.card}
          hours={fallbackStoreHours}
          secondaryTextColor={colors.textSecondary}
          textColor={colors.text}
        />
      </ScrollView>
    </StorefrontScreenShell>
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
    paddingHorizontal: SPACING.lg,
  },
  section: {
    marginBottom: SPACING.xl,
  },
  sectionTitle: {
    fontSize: TYPOGRAPHY.size.lg,
    fontFamily: 'Inter_700Bold',
    marginBottom: SPACING.md,
  },
});
