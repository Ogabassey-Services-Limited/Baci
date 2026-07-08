import { zodResolver } from '@hookform/resolvers/zod';
import Ionicons from '@react-native-vector-icons/ionicons';
import { Redirect, router, Stack } from 'expo-router';
import { useState } from 'react';
import { type Resolver, useForm } from 'react-hook-form';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { ProfileEditView } from '@/components/profile/ProfileEditView';
import { ProfileUsernameSection } from '@/components/profile/ProfileUsernameSection';
import { styles } from '@/components/profile/profile-edit.styles';
import { useToast } from '@/components/ui/Toast';
import { useColorScheme } from '@/components/useColorScheme';
import Colors, { BRAND } from '@/constants/Colors';
import { useRequireAuth } from '@/hooks/use-auth-guard';
import { type ProfileFormData, ProfileSchema } from '@/schemas/profile-edit';
import { useAuthStore } from '@/stores/auth-store';

const profileResolver: Resolver<ProfileFormData> = zodResolver(ProfileSchema);

export default function ProfileEditScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  const { isLoading: isAuthLoading, redirectTo } = useRequireAuth();

  const customer = useAuthStore((state) => state.customer);
  const updateProfile = useAuthStore((state) => state.updateProfile);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const toast = useToast();

  const {
    control,
    handleSubmit,
    formState: { errors, isDirty },
  } = useForm<ProfileFormData>({
    resolver: profileResolver,
    defaultValues: {
      first_name: customer?.first_name || '',
      last_name: customer?.last_name || '',
      phone: customer?.phone || '',
    },
  });

  // Promise chain instead of try/finally: a `finally` clause in the component
  // body makes React Compiler bail out of memoizing this screen.
  const onSubmit = (data: ProfileFormData) => {
    setIsSubmitting(true);
    return updateProfile({
      first_name: data.first_name,
      last_name: data.last_name,
      phone: data.phone || undefined,
    })
      .then((result) => {
        if (result.success) {
          toast.success('Profile updated successfully');
          router.back();
        } else {
          toast.error(result.error || 'Failed to update profile');
        }
      })
      .catch(() => {
        toast.error('Something went wrong. Please try again.');
      })
      .finally(() => {
        setIsSubmitting(false);
      });
  };

  if (redirectTo) {
    return <Redirect href={redirectTo} />;
  }

  if (isAuthLoading) {
    return (
      <View
        style={[
          styles.container,
          styles.loadingContent,
          { backgroundColor: colors.background },
        ]}
      >
        <ActivityIndicator size="large" color={BRAND.primary} />
      </View>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Edit Profile',
          headerLeft: () => (
            <Pressable
              accessibilityLabel="Back from edit profile"
              accessibilityRole="button"
              onPress={() => router.back()}
              style={styles.backBtn}
            >
              <Ionicons name="arrow-back" size={24} color={colors.text} />
            </Pressable>
          ),
        }}
      />
      <ProfileEditView
        colors={colors}
        control={control}
        customerEmail={customer?.email}
        errors={errors}
        isDirty={isDirty}
        isSubmitting={isSubmitting}
        onSave={handleSubmit(onSubmit)}
        toast={<toast.Toast />}
        usernameSection={
          <ProfileUsernameSection
            colors={colors}
            onSaved={() => {
              toast.success('Username saved');
            }}
            username={customer?.username}
          />
        }
      />
    </>
  );
}
