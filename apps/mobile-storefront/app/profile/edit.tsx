/**
 * Profile Edit Screen
 *
 * 2026 Best Practices:
 * - react-hook-form for form management
 * - Zod validation for type safety
 * - Optimistic updates with rollback on error
 * - Proper loading and error states
 */

import { Ionicons } from '@expo/vector-icons';
import { zodResolver } from '@hookform/resolvers/zod';
import { Redirect, router, Stack } from 'expo-router';
import type React from 'react';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { z } from 'zod';
import AppKeyboardContainer from '@/components/ui/AppKeyboardContainer';
import { useToast } from '@/components/ui/Toast';
import { useColorScheme } from '@/components/useColorScheme';
import Colors, { BRAND } from '@/constants/Colors';
import { useRequireAuth } from '@/hooks/use-auth-guard';
import { TextContentTypes } from '@/hooks/use-keyboard';
import { useAuthStore } from '@/stores/auth-store';

// Profile validation schema
const ProfileSchema = z.object({
  first_name: z.string().min(1, 'First name is required'),
  last_name: z.string().min(1, 'Last name is required'),
  phone: z
    .string()
    .min(10, 'Valid phone number required')
    .optional()
    .or(z.literal('')),
});

type ProfileFormData = z.infer<typeof ProfileSchema>;

export default function ProfileEditScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  // 2026 Best Practice: Declarative auth-gate with intent-preserving returnTo
  const { isLoading: isAuthLoading, redirectTo } = useRequireAuth();

  const customer = useAuthStore((state) => state.customer);
  const updateProfile = useAuthStore((state) => state.updateProfile);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 2026 Best Practice: Toast feedback for profile update
  const toast = useToast();

  const {
    control,
    handleSubmit,
    formState: { errors, isDirty },
  } = useForm<ProfileFormData>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Zod 4 + @hookform/resolvers type mismatch
    resolver: zodResolver(ProfileSchema as unknown as z.ZodType<any, any, any>),
    defaultValues: {
      first_name: customer?.first_name || '',
      last_name: customer?.last_name || '',
      phone: customer?.phone || '',
    },
  });

  const onSubmit = async (data: ProfileFormData) => {
    setIsSubmitting(true);
    try {
      const result = await updateProfile({
        first_name: data.first_name,
        last_name: data.last_name,
        phone: data.phone || undefined,
      });

      if (result.success) {
        // 2026 Best Practice: Use toast for success feedback instead of blocking alert
        toast.success('Profile updated successfully');
        // Small delay to let the toast show before navigating back
        setTimeout(() => router.back(), 500);
      } else {
        toast.error(result.error || 'Failed to update profile');
      }
    } catch (_error) {
      toast.error('Something went wrong. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Show redirect for unauthenticated users
  if (redirectTo) {
    return <Redirect href={redirectTo} />;
  }

  if (isAuthLoading) {
    return (
      <View
        style={[
          styles.container,
          {
            backgroundColor: colors.background,
            alignItems: 'center',
            justifyContent: 'center',
          },
        ]}
      >
        <ActivityIndicator size="large" color={BRAND.primary} />
      </View>
    );
  }

  const FormField = ({
    name,
    label,
    placeholder,
    keyboardType = 'default',
    autoCapitalize = 'words',
    textContentType,
  }: {
    name: keyof ProfileFormData;
    label: string;
    placeholder: string;
    keyboardType?: 'default' | 'phone-pad' | 'email-address';
    autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
    textContentType?: React.ComponentProps<typeof TextInput>['textContentType'];
  }) => (
    <View style={styles.inputGroup}>
      <Text style={[styles.label, { color: colors.textSecondary }]}>
        {label}
      </Text>
      <Controller
        control={control}
        name={name}
        render={({ field: { onChange, onBlur, value } }) => (
          <TextInput
            style={[
              styles.input,
              { backgroundColor: colors.muted, color: colors.text },
              { borderColor: errors[name] ? '#EF4444' : colors.border },
            ]}
            value={value}
            onChangeText={onChange}
            onBlur={onBlur}
            placeholder={placeholder}
            placeholderTextColor={colors.placeholder}
            keyboardType={keyboardType}
            autoCapitalize={autoCapitalize}
            autoCorrect={false}
            accessibilityLabel={label}
            accessibilityHint={`Enter your ${label.toLowerCase()}`}
            // 2026 Best Practice: textContentType for iOS autofill
            textContentType={textContentType}
          />
        )}
      />
      {errors?.[name] && (
        <Text style={styles.errorText} accessibilityLiveRegion="polite">
          {errors?.[name]?.message}
        </Text>
      )}
    </View>
  );

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Edit Profile',
          headerLeft: () => (
            <Pressable onPress={() => router.back()} style={styles.backBtn}>
              <Ionicons name="arrow-back" size={24} color={colors.text} />
            </Pressable>
          ),
        }}
      />

      <AppKeyboardContainer
        style={[styles.container, { backgroundColor: colors.background }]}
      >
        <ScrollView
          style={styles.scrollView}
          showsVerticalScrollIndicator={false}
          keyboardDismissMode="on-drag"
        >
          <View style={styles.formContainer}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              Personal Information
            </Text>

            <FormField
              name="first_name"
              label="First Name"
              placeholder="Enter your first name"
              textContentType={TextContentTypes.givenName}
            />

            <FormField
              name="last_name"
              label="Last Name"
              placeholder="Enter your last name"
              textContentType={TextContentTypes.familyName}
            />

            <FormField
              name="phone"
              label="Phone Number"
              placeholder="08012345678"
              keyboardType="phone-pad"
              autoCapitalize="none"
              textContentType={TextContentTypes.telephoneNumber}
            />

            <Text style={[styles.emailLabel, { color: colors.textSecondary }]}>
              Email
            </Text>
            <View
              style={[
                styles.emailContainer,
                { backgroundColor: colors.muted, borderColor: colors.border },
              ]}
            >
              <Text style={[styles.emailText, { color: colors.text }]}>
                {customer?.email || 'Not set'}
              </Text>
              <Ionicons
                name="lock-closed"
                size={16}
                color={colors.textSecondary}
              />
            </View>
            <Text style={[styles.emailHint, { color: colors.textSecondary }]}>
              Email cannot be changed
            </Text>
          </View>
        </ScrollView>

        <SafeAreaView
          edges={['bottom']}
          style={[
            styles.bottomAction,
            { backgroundColor: colors.card, borderTopColor: colors.border },
          ]}
        >
          <Pressable
            style={[
              styles.saveButton,
              { backgroundColor: isDirty ? BRAND.primary : colors.border },
            ]}
            onPress={handleSubmit(onSubmit)}
            disabled={isSubmitting || !isDirty}
            accessibilityRole="button"
            accessibilityLabel="Save Changes"
          >
            {isSubmitting ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.saveButtonText}>Save Changes</Text>
            )}
          </Pressable>
        </SafeAreaView>

        {/* 2026 Best Practice: Toast feedback component */}
        <toast.Toast />
      </AppKeyboardContainer>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  backBtn: {
    padding: 8,
  },
  scrollView: {
    flex: 1,
  },
  formContainer: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 20,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 13,
    fontWeight: '500',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
  },
  errorText: {
    color: '#EF4444',
    fontSize: 12,
    marginTop: 4,
  },
  emailLabel: {
    fontSize: 13,
    fontWeight: '500',
    marginBottom: 8,
    marginTop: 8,
  },
  emailContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  emailText: {
    fontSize: 15,
  },
  emailHint: {
    fontSize: 12,
    marginTop: 4,
  },
  bottomAction: {
    padding: 16,
    borderTopWidth: 1,
  },
  saveButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
