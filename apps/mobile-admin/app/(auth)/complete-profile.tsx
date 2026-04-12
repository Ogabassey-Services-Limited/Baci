import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SystemBars } from 'react-native-edge-to-edge';
import { BusinessTypeSelector } from '@/components/auth/BusinessTypeSelector';
import { RegisterLegalText } from '@/components/auth/register/RegisterLegalText';
import { AppFormScreen } from '@/components/ui/AppFormScreen';
import SafeImage from '@/components/ui/SafeImage';
import { RADIUS, SPACING, TYPOGRAPHY } from '@/constants/theme';
import { useRegistration } from '@/hooks/useRegistration';
import { useTheme } from '@/hooks/useTheme';
import { supabase } from '@/lib/supabase';

export default function CompleteProfileScreen() {
  const router = useRouter();
  const { colors, isDark } = useTheme();

  const { completeProfile, isLoading } = useRegistration();
  const [isInitializing, setIsInitializing] = useState(true);

  // Form State
  const [formData, setFormData] = useState({
    fullName: '',
    phone: '',
    businessName: '',
    businessType: '',
    otherBusinessType: '',
    slug: '',
    email: '',
    logoUrl: '',
  });
  const [isSlugEdited, setIsSlugEdited] = useState(false);

  // Prefill Data on Mount
  useEffect(() => {
    async function prefillData() {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (user) {
          const metadata = user.user_metadata || {};
          const metadataFullName = metadata.full_name || metadata.name || '';
          const avatarUrl = metadata.avatar_url || metadata.picture || '';

          // Default business name to user's name if available (e.g. "John's Store")
          // Logic: "John Doe" -> "John" -> "John's Store"
          // Or just use full name for now and let them edit
          const suggestedName = metadataFullName
            ? `${metadataFullName.split(' ')[0]}'s Store`
            : '';

          // Generate slug from suggested name
          const suggestedSlug = suggestedName
            ? suggestedName
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, '-')
                .replace(/(^-|-$)/g, '')
            : '';

          setFormData((prev) => ({
            ...prev,
            fullName: metadataFullName,
            email: user.email || '',
            businessName: suggestedName,
            slug: suggestedSlug,
            logoUrl: avatarUrl,
          }));
        }
      } catch (e) {
        console.error('Error prefilling data:', e);
      } finally {
        setIsInitializing(false);
      }
    }
    prefillData();
  }, []);

  const updateForm = <K extends keyof typeof formData>(
    key: K,
    value: (typeof formData)[K]
  ) => {
    setFormData((prev) => {
      const updates: Partial<typeof formData> = { [key]: value };

      // Auto-generate slug if business name changes and slug hasn't been manually edited
      if (key === 'businessName' && !isSlugEdited) {
        const slugBase = value
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/(^-|-$)/g, '');
        updates.slug = slugBase;
      }

      if (key === 'businessType' && value !== 'other') {
        updates.otherBusinessType = '';
      }

      return { ...prev, ...updates };
    });
  };

  const handleSlugChange = (text: string) => {
    setIsSlugEdited(true);
    const sanitized = text.toLowerCase().replace(/[^a-z0-9-]/g, '');
    setFormData((prev) => ({ ...prev, slug: sanitized }));
  };

  const handleCompleteSetup = () => {
    if (
      !formData.businessName.trim() ||
      !formData.businessType.trim() ||
      !formData.fullName.trim()
    ) {
      Alert.alert(
        'Error',
        'Please fill in all required fields (Name, Business Name, Type)'
      );
      return;
    }

    if (!formData.email?.trim()) {
      Alert.alert(
        'Email Required',
        'We could not retrieve your email address. Please sign in with an account that provides an email.'
      );
      return;
    }

    if (
      formData.businessType === 'other' &&
      !formData.otherBusinessType.trim()
    ) {
      Alert.alert('Error', 'Please specify your business type');
      return;
    }

    // Split fullName into firstName and lastName for the API
    const nameParts = formData.fullName.trim().split(/\s+/);
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || '';

    completeProfile.mutate(
      {
        firstName,
        lastName,
        phone: formData.phone,
        email: formData.email,
        businessName: formData.businessName,
        businessType: formData.businessType,
        otherBusinessType: formData.otherBusinessType,
        slug: formData.slug || undefined,
        logoUrl: formData.logoUrl || undefined,
        brandColors: JSON.stringify({
          primary: '#000000',
          background: '#ffffff',
          accent: '#F59E0B',
        }),
      },
      {
        onSuccess: () => {
          Alert.alert('Success', 'Store created!', [
            {
              text: 'Go to Dashboard',
              onPress: () => router.replace('/(admin)/(tabs)'),
            },
          ]);
        },
        onError: (error) => {
          console.error('Setup error:', error);
          Alert.alert(
            'Setup Failed',
            error.message || 'Please try again later.'
          );
        },
      }
    );
  };

  if (isInitializing) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: colors.background,
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <SystemBars style={isDark ? 'light' : 'dark'} />
      {isDark && (
        <LinearGradient
          colors={['#0D0D1A', '#1A1A2E']}
          style={StyleSheet.absoluteFillObject}
        />
      )}

      <AppFormScreen
        contentContainerStyle={styles.content}
        header={
          <View style={styles.header}>
            {/* No back button, this is a forced step */}
            <View />
            <Text style={[styles.headerTitle, { color: colors.text }]}>
              Complete Setup
            </Text>
            <View style={{ width: 24 }} />
          </View>
        }
        style={styles.safeArea}
      >
        <View style={styles.introSection}>
          {formData.logoUrl ? (
            <SafeImage
              source={{ uri: formData.logoUrl }}
              style={[styles.avatar, { borderColor: colors.primary }]}
            />
          ) : (
            <View
              style={[
                styles.avatarPlaceholder,
                { backgroundColor: colors.card },
              ]}
            >
              <Ionicons
                name="storefront-outline"
                size={40}
                color={colors.textSecondary}
              />
            </View>
          )}
          <Text style={[styles.introTitle, { color: colors.text }]}>
            Welcome
            {formData.fullName ? `, ${formData.fullName.split(' ')[0]}` : ''}!
          </Text>
          <Text style={[styles.introText, { color: colors.textSecondary }]}>
            Let's finish setting up your profile and store.
          </Text>
        </View>

        <View style={styles.formSection}>
          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>
              Your Name
            </Text>
            <TextInput
              accessibilityLabel="Your Name"
              style={[
                styles.input,
                {
                  backgroundColor: colors.inputBg,
                  borderColor: colors.border,
                  color: colors.text,
                },
              ]}
              placeholder="John Doe"
              placeholderTextColor={colors.textMuted}
              value={formData.fullName}
              onChangeText={(t) => updateForm('fullName', t)}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>
              Phone Number (Optional)
            </Text>
            <TextInput
              accessibilityLabel="Phone Number (Optional)"
              style={[
                styles.input,
                {
                  backgroundColor: colors.inputBg,
                  borderColor: colors.border,
                  color: colors.text,
                },
              ]}
              placeholder="+1 234 567 8900"
              placeholderTextColor={colors.textMuted}
              value={formData.phone}
              onChangeText={(t) => updateForm('phone', t)}
              keyboardType="phone-pad"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>
              Business Name
            </Text>
            <TextInput
              accessibilityLabel="Business Name"
              style={[
                styles.input,
                {
                  backgroundColor: colors.inputBg,
                  borderColor: colors.border,
                  color: colors.text,
                },
              ]}
              placeholder="My Awesome Store"
              placeholderTextColor={colors.textMuted}
              value={formData.businessName}
              onChangeText={(t) => updateForm('businessName', t)}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>
              Store Link
            </Text>
            <View
              style={[
                styles.urlInputContainer,
                {
                  backgroundColor: colors.inputBg,
                  borderColor: colors.border,
                },
              ]}
            >
              <TextInput
                accessibilityLabel="Store Link"
                style={[
                  styles.urlInput,
                  { textAlign: 'right', color: colors.text },
                ]}
                placeholder="my-store"
                placeholderTextColor={colors.textMuted}
                autoCapitalize="none"
                value={formData.slug}
                onChangeText={handleSlugChange}
              />
              <Text
                style={[
                  styles.urlSuffix,
                  {
                    color: colors.textSecondary,
                    backgroundColor: isDark
                      ? 'rgba(255,255,255,0.05)'
                      : 'rgba(0,0,0,0.05)',
                  },
                ]}
              >
                .usebaci.com
              </Text>
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>
              Business Type
            </Text>
            <BusinessTypeSelector
              accessibilityLabelSuffix="business type"
              borderColor={colors.border}
              cardBackgroundColor={
                isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'
              }
              onSelect={(typeId) => updateForm('businessType', typeId)}
              selectedBackgroundColor={colors.primary}
              selectedBorderColor={colors.primary}
              selectedTextColor={colors.textOnPrimary}
              selectedType={formData.businessType}
              textColor={colors.textSecondary}
            />
          </View>

          {formData.businessType === 'other' && (
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>
                Please specify
              </Text>
              <TextInput
                accessibilityLabel="Please specify"
                style={[
                  styles.input,
                  {
                    backgroundColor: colors.inputBg,
                    borderColor: colors.border,
                    color: colors.text,
                  },
                ]}
                placeholder="e.g. Pet Supplies"
                placeholderTextColor={colors.textMuted}
                value={formData.otherBusinessType}
                onChangeText={(text) => updateForm('otherBusinessType', text)}
              />
            </View>
          )}

          <Pressable
            style={[
              styles.button,
              { backgroundColor: colors.primary },
              isLoading && { opacity: 0.7 },
            ]}
            onPress={handleCompleteSetup}
            disabled={isLoading}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel="Launch Store"
            accessibilityState={{ disabled: isLoading }}
          >
            {isLoading ? (
              <ActivityIndicator color={colors.textOnPrimary} />
            ) : (
              <>
                <Text
                  style={[styles.buttonText, { color: colors.textOnPrimary }]}
                >
                  Launch Store
                </Text>
                <Ionicons
                  name="rocket-outline"
                  size={20}
                  color={colors.textOnPrimary}
                />
              </>
            )}
          </Pressable>

          <RegisterLegalText
            linkColor={colors.primary}
            prefixText="By continuing, you agree to our"
            textColor={colors.textSecondary}
          />
        </View>
      </AppFormScreen>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
  },
  headerTitle: {
    fontSize: TYPOGRAPHY.size.lg,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
  },
  content: {
    padding: SPACING.lg,
  },
  introSection: {
    alignItems: 'center',
    marginBottom: SPACING.xl,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: RADIUS.full,
    marginBottom: SPACING.md,
    borderWidth: 2,
  },
  avatarPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: RADIUS.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.md,
  },
  introTitle: {
    fontSize: TYPOGRAPHY.size.xl,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    marginBottom: SPACING.xs,
  },
  introText: {
    fontSize: TYPOGRAPHY.size.md,
    textAlign: 'center',
  },
  formSection: {
    gap: SPACING.xl,
  },
  inputGroup: {
    gap: SPACING.sm,
  },
  label: {
    fontSize: TYPOGRAPHY.size.sm,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
  },
  input: {
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    fontSize: TYPOGRAPHY.size.md,
    borderWidth: 1,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: RADIUS.full,
    marginTop: SPACING.lg,
    gap: SPACING.sm,
  },
  buttonText: {
    fontSize: TYPOGRAPHY.size.lg,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
  },
  urlInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: RADIUS.md,
    borderWidth: 1,
    overflow: 'hidden',
  },
  urlSuffix: {
    paddingRight: SPACING.md,
    paddingLeft: SPACING.xs,
    fontSize: TYPOGRAPHY.size.md,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    height: '100%',
    textAlignVertical: 'center',
    paddingVertical: SPACING.md,
  },
  urlInput: {
    flex: 1,
    padding: SPACING.md,
    fontSize: TYPOGRAPHY.size.md,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
  },
  termsText: {
    fontSize: TYPOGRAPHY.size.sm,
    textAlign: 'center',
    marginTop: SPACING.lg,
    lineHeight: 20,
  },
  termsLink: {
    textDecorationLine: 'underline',
  },
});
