import Ionicons from "@react-native-vector-icons/ionicons/static";
import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SystemBars } from 'react-native-edge-to-edge';
import { SafeAreaView } from 'react-native-safe-area-context';
import { RADIUS, SPACING, TYPOGRAPHY } from '@/constants/theme';
import { useMerchant } from '@/hooks/useMerchant';
import { useTheme } from '@/hooks/useTheme';

const SUBJECT_OPTIONS = [
  { id: 'order', label: 'Order Issue', icon: 'cube-outline' as const },
  { id: 'payment', label: 'Payment Problem', icon: 'card-outline' as const },
  { id: 'technical', label: 'Technical Bug', icon: 'bug-outline' as const },
  { id: 'feature', label: 'Feature Request', icon: 'bulb-outline' as const },
  { id: 'other', label: 'Other', icon: 'ellipsis-horizontal-outline' as const },
];

const WHATSAPP_NUMBER = '+2349169449282';
const SUPPORT_EMAIL = 'support@usebaci.com';
const SUPPORT_PHONE = '+234 916 944 9282';

export default function ContactSupportScreen() {
  const { colors, shadows, isDark } = useTheme();
  const { merchant } = useMerchant();
  const router = useRouter();

  const [selectedSubject, setSelectedSubject] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);

  const handleWhatsApp = () => {
    const whatsappUrl = `https://wa.me/${WHATSAPP_NUMBER.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(`Hi, I need help with my Baci store (${merchant?.business_name || 'My Store'})`)}`;
    Linking.openURL(whatsappUrl);
  };

  const handleSubmit = async () => {
    if (!selectedSubject) {
      Alert.alert(
        'Missing Subject',
        'Please select a subject for your message.'
      );
      return;
    }
    if (!message.trim()) {
      Alert.alert('Missing Message', 'Please enter a message.');
      return;
    }

    setIsSending(true);

    // Build mailto URL with pre-filled content
    const subjectLabel =
      SUBJECT_OPTIONS.find((s) => s.id === selectedSubject)?.label ||
      'Support Request';
    const emailSubject = `[${subjectLabel}] Support Request - ${merchant?.business_name || 'Merchant'}`;
    const emailBody = `Store: ${merchant?.business_name || 'N/A'}\nSubject: ${subjectLabel}\n\n${message}`;

    const mailtoUrl = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}`;

    try {
      await Linking.openURL(mailtoUrl);
      Alert.alert(
        'Email Opened',
        'Your default email app has been opened with the message. Please send the email to complete your request.'
      );
      setMessage('');
      setSelectedSubject(null);
    } catch {
      Alert.alert(
        'Error',
        `Could not open email app. Please email us directly at ${SUPPORT_EMAIL}`
      );
    } finally {
      setIsSending(false);
    }
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Contact Support',
          headerLeft: () => (
            <Pressable onPress={() => router.back()} style={styles.backButton}>
              <Ionicons name="arrow-back" size={24} color={colors.text} />
            </Pressable>
          ),
        }}
      />
      <SafeAreaView
        style={[styles.container, { backgroundColor: colors.background }]}
        edges={['bottom']}
      >
        <SystemBars style={isDark ? 'light' : 'dark'} />

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* WhatsApp Quick Contact */}
          <Pressable
            style={[styles.whatsappCard, { backgroundColor: '#25D366' }]}
            onPress={handleWhatsApp}
          >
            <Ionicons name="logo-whatsapp" size={28} color="#FFFFFF" />
            <View style={styles.whatsappContent}>
              <Text style={styles.whatsappTitle}>Chat on WhatsApp</Text>
              <Text style={styles.whatsappSubtitle}>Get instant support</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#FFFFFF" />
          </Pressable>

          {/* Subject Selection */}
          <View
            style={[styles.card, { backgroundColor: colors.card }, shadows.sm]}
          >
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              What do you need help with?
            </Text>
            <View style={styles.subjectsGrid}>
              {SUBJECT_OPTIONS.map((option) => (
                <Pressable
                  key={option.id}
                  style={[
                    styles.subjectChip,
                    {
                      backgroundColor:
                        selectedSubject === option.id
                          ? colors.primary
                          : colors.cardHover,
                    },
                  ]}
                  onPress={() => setSelectedSubject(option.id)}
                >
                  <Ionicons
                    name={option.icon}
                    size={18}
                    color={
                      selectedSubject === option.id ? '#FFFFFF' : colors.text
                    }
                  />
                  <Text
                    style={[
                      styles.subjectChipText,
                      {
                        color:
                          selectedSubject === option.id
                            ? '#FFFFFF'
                            : colors.text,
                      },
                    ]}
                  >
                    {option.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Message Input */}
          <View
            style={[styles.card, { backgroundColor: colors.card }, shadows.sm]}
          >
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              Your Message
            </Text>
            <TextInput
              style={[
                styles.textArea,
                {
                  backgroundColor: colors.cardHover,
                  color: colors.text,
                  borderColor: colors.border,
                },
              ]}
              value={message}
              onChangeText={setMessage}
              placeholder="Describe your issue or question..."
              placeholderTextColor={colors.textMuted}
              multiline
              numberOfLines={5}
              textAlignVertical="top"
            />
          </View>

          {/* Submit Button */}
          <Pressable
            style={[
              styles.submitButton,
              { backgroundColor: colors.primary, opacity: isSending ? 0.7 : 1 },
            ]}
            onPress={handleSubmit}
            disabled={isSending}
          >
            {isSending ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Ionicons name="send" size={20} color="#FFFFFF" />
                <Text style={styles.submitButtonText}>Send Message</Text>
              </>
            )}
          </Pressable>

          {/* Alternative Contact Info */}
          <View style={styles.altContact}>
            <Text
              style={[styles.altContactTitle, { color: colors.textSecondary }]}
            >
              Or reach us directly
            </Text>
            <Pressable
              style={styles.altContactItem}
              onPress={() => Linking.openURL(`mailto:${SUPPORT_EMAIL}`)}
            >
              <Ionicons name="mail-outline" size={18} color={colors.primary} />
              <Text style={[styles.altContactText, { color: colors.text }]}>
                {SUPPORT_EMAIL}
              </Text>
            </Pressable>
            <Pressable
              style={styles.altContactItem}
              onPress={() =>
                Linking.openURL(`tel:${SUPPORT_PHONE.replace(/\s/g, '')}`)
              }
            >
              <Ionicons name="call-outline" size={18} color={colors.primary} />
              <Text style={[styles.altContactText, { color: colors.text }]}>
                {SUPPORT_PHONE}
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  backButton: { padding: SPACING.sm, marginLeft: -SPACING.sm },
  scrollView: { flex: 1 },
  scrollContent: { padding: SPACING.lg, paddingBottom: SPACING['3xl'] },
  whatsappCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.lg,
    borderRadius: RADIUS.lg,
    marginBottom: SPACING.lg,
    gap: SPACING.md,
  },
  whatsappContent: { flex: 1 },
  whatsappTitle: {
    color: '#FFFFFF',
    fontSize: TYPOGRAPHY.size.md,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
  },
  whatsappSubtitle: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: TYPOGRAPHY.size.sm,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
  },
  card: {
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
  },
  sectionTitle: {
    fontSize: TYPOGRAPHY.size.md,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    marginBottom: SPACING.md,
  },
  subjectsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  subjectChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.full,
    gap: SPACING.xs,
  },
  subjectChipText: {
    fontSize: TYPOGRAPHY.size.sm,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
  },
  textArea: {
    minHeight: 120,
    borderWidth: 1,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    fontSize: TYPOGRAPHY.size.md,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.lg,
    borderRadius: RADIUS.lg,
    gap: SPACING.sm,
    marginBottom: SPACING.xl,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: TYPOGRAPHY.size.md,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
  },
  altContact: { alignItems: 'center' },
  altContactTitle: {
    fontSize: TYPOGRAPHY.size.sm,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    marginBottom: SPACING.md,
  },
  altContactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  altContactText: {
    fontSize: TYPOGRAPHY.size.md,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
  },
});
