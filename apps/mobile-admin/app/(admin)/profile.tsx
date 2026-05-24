import Ionicons from "@react-native-vector-icons/ionicons/static";
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Stack, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SystemBars } from 'react-native-edge-to-edge';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScreenSkeleton } from '@/components/ui/ScreenSkeleton';
import { RADIUS, SPACING, TYPOGRAPHY } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { useRevenueCat } from '@/hooks/useRevenueCat';
import { useTheme } from '@/hooks/useTheme';
import { supabase } from '@/lib/supabase';
import { SubscriptionManagement } from '@/utils/SubscriptionManagement';

interface UserProfile {
  id: string;
  email: string;
  name: string | null;
  role: string | null;
  phone: string | null;
}

export default function ProfileScreen() {
  const { user, signOut } = useAuth();
  const { unregisterPush } = usePushNotifications();
  const { isPro } = useRevenueCat();

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');

  // Fetch staff registration details (where the personal name/phone usually lives)
  const { data: profile, isLoading } = useQuery({
    queryKey: ['user-profile', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('staff_members')
        .select('id, email, name, role, phone')
        .eq('user_id', user?.id)
        .maybeSingle();

      if (error) throw error;
      return data as UserProfile;
    },
    enabled: !!user?.id,
  });

  useEffect(() => {
    if (profile) {
      setFullName(profile.name || '');
      setPhone(profile.phone || '');
    }
  }, [profile]);

  const updateProfileMutation = useMutation({
    mutationFn: async () => {
      if (!profile?.id) throw new Error('Profile not found');
      const { error } = await supabase
        .from('staff_members')
        .update({
          name: fullName,
          phone: phone,
        })
        .eq('id', profile.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-profile'] });
      Alert.alert('Success', 'Profile updated successfully');
    },
    onError: (error: unknown) => {
      Alert.alert(
        'Error',
        (error as Error).message || 'Failed to update profile'
      );
    },
  });

  const handleLogout = () => {
    Alert.alert('Log Out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log Out',
        style: 'destructive',
        onPress: async () => {
          // Unregister push notifications first
          await unregisterPush();
          await signOut();
        },
      },
    ]);
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'Are you sure you want to delete your account? This action is permanent and cannot be undone. All your store data will be lost.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            Alert.alert(
              'Final Confirmation',
              'This is your LAST chance. Delete everything?',
              [
                { text: 'No, Keep It', style: 'cancel' },
                {
                  text: 'Yes, Delete Permanently',
                  style: 'destructive',
                  onPress: async () => {
                    try {
                      const { data: session } =
                        await supabase.auth.getSession();
                      if (!session.session)
                        throw new Error('No active session');

                      const response = await fetch(
                        `${process.env.EXPO_PUBLIC_API_URL}/api/merchant/auth/account-deletion`,
                        {
                          method: 'POST',
                          headers: {
                            Authorization: `Bearer ${session.session.access_token}`,
                          },
                        }
                      );

                      if (!response.ok) {
                        const errorData = await response.json();
                        throw new Error(
                          errorData.error || 'Failed to delete account'
                        );
                      }

                      Alert.alert(
                        'Account Deleted',
                        'Your account has been successfully removed. We are sorry to see you go.',
                        [
                          {
                            text: 'OK',
                            onPress: async () => {
                              await unregisterPush();
                              await signOut();
                            },
                          },
                        ]
                      );
                    } catch (error: unknown) {
                      Alert.alert(
                        'Error',
                        (error as Error).message || 'Failed to delete account'
                      );
                    }
                  },
                },
              ]
            );
          },
        },
      ]
    );
  };

  const { colors, isDark } = useTheme();
  const router = useRouter();
  const queryClient = useQueryClient();
  const manageSubscriptionLabel =
    SubscriptionManagement.getManagementLabel() || 'Manage Subscription';

  if (isLoading) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: colors.background }]}
      >
        <ScreenSkeleton variant="settings" cards={3} />
      </SafeAreaView>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Profile',
          headerLeft: () => (
            <Pressable onPress={() => router.back()} style={styles.backButton}>
              <Ionicons name="arrow-back" size={24} color={colors.text} />
            </Pressable>
          ),
          headerRight: () => (
            <Pressable
              onPress={() => updateProfileMutation.mutate()}
              disabled={updateProfileMutation.isPending}
              style={styles.saveButton}
            >
              {updateProfileMutation.isPending ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Text style={[styles.saveText, { color: colors.primary }]}>
                  Save
                </Text>
              )}
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
        >
          {/* Header/Avatar Section */}
          <View style={styles.headerSection}>
            <View
              style={[
                styles.avatar,
                { backgroundColor: `${colors.primary}20` },
              ]}
            >
              <Text style={[styles.avatarText, { color: colors.primary }]}>
                {fullName
                  ? fullName.charAt(0).toUpperCase()
                  : user?.email?.charAt(0).toUpperCase() || 'U'}
              </Text>
            </View>
            <Text style={[styles.userName, { color: colors.text }]}>
              {fullName || 'Baci Merchant'}
            </Text>
            <Text style={[styles.userRole, { color: colors.textSecondary }]}>
              {profile?.role?.toUpperCase() || 'ADMIN'}
            </Text>
          </View>

          {/* Account Details */}
          <View style={[styles.section, { borderTopColor: colors.border }]}>
            <Text
              style={[styles.sectionTitle, { color: colors.textSecondary }]}
            >
              Account Details
            </Text>

            <View style={styles.formGroup}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>
                Full Name
              </Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: colors.card,
                    color: colors.text,
                    borderColor: colors.border,
                  },
                ]}
                value={fullName}
                onChangeText={setFullName}
                placeholder="Enter your full name"
                placeholderTextColor={colors.textMuted}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>
                Email Address
              </Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: colors.card,
                    color: colors.textMuted,
                    borderColor: colors.border,
                  },
                ]}
                value={user?.email}
                editable={false}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>
                Phone Number
              </Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: colors.card,
                    color: colors.text,
                    borderColor: colors.border,
                  },
                ]}
                value={phone}
                onChangeText={setPhone}
                placeholder="Enter your phone number"
                placeholderTextColor={colors.textMuted}
                keyboardType="phone-pad"
              />
            </View>
          </View>

          {/* Subscription Section */}
          <View
            style={[
              styles.section,
              { borderTopColor: colors.border, paddingTop: 0 },
            ]}
          >
            <Text
              style={[styles.sectionTitle, { color: colors.textSecondary }]}
            >
              Subscription
            </Text>

            <Pressable
              style={[
                styles.subscriptionCard,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
              onPress={() => router.push('/(admin)/subscribe')}
            >
              <View
                style={[
                  styles.subscriptionIconContainer,
                  {
                    backgroundColor: isDark
                      ? 'rgba(255,255,255,0.05)'
                      : 'rgba(0,0,0,0.03)',
                  },
                ]}
              >
                <Ionicons
                  name="star"
                  size={24}
                  color={isPro ? colors.primary : colors.textMuted}
                />
              </View>
              <View style={styles.subscriptionInfo}>
                <Text style={[styles.planLabel, { color: colors.text }]}>
                  {SubscriptionManagement.getPlanLabel(isPro)}
                </Text>
                <Text
                  style={[styles.planStatus, { color: colors.textSecondary }]}
                >
                  {isPro
                    ? 'You have full access to pro features'
                    : 'Individual Store Builder'}
                </Text>
              </View>
              <Ionicons
                name="chevron-forward"
                size={20}
                color={colors.textSecondary}
              />
            </Pressable>

            {isPro && (
              <Pressable
                style={[styles.manageButton, { marginTop: SPACING.md }]}
                onPress={async () => {
                  try {
                    await SubscriptionManagement.openNativeManagement();
                  } catch {
                    Alert.alert(
                      'Error',
                      'Unable to open subscription management'
                    );
                  }
                }}
              >
                <Text
                  style={[styles.manageButtonText, { color: colors.primary }]}
                >
                  {manageSubscriptionLabel}
                </Text>
                <Ionicons
                  name="open-outline"
                  size={16}
                  color={colors.primary}
                  style={{ marginLeft: SPACING.xs }}
                />
              </Pressable>
            )}
          </View>

          {/* Actions */}
          <View style={styles.footer}>
            <Pressable
              style={[styles.logoutButton, { borderColor: colors.error }]}
              onPress={handleLogout}
            >
              <Ionicons name="log-out-outline" size={20} color={colors.error} />
              <Text style={[styles.logoutText, { color: colors.error }]}>
                Log Out
              </Text>
            </Pressable>

            <Pressable
              style={[styles.deleteButton, { marginTop: SPACING.sm }]}
              onPress={handleDeleteAccount}
            >
              <Text style={[styles.deleteText, { color: colors.error }]}>
                Delete Account
              </Text>
            </Pressable>

            <Text style={[styles.versionText, { color: colors.textMuted }]}>
              Version 1.1.0
            </Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollView: { flex: 1 },
  scrollContent: { padding: SPACING.lg },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  headerSection: { alignItems: 'center', marginBottom: SPACING.xl },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  avatarText: { fontSize: 36, fontFamily: TYPOGRAPHY.fontFamily.bold },
  userName: {
    fontSize: TYPOGRAPHY.size.xl,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    marginBottom: 4,
  },
  userRole: {
    fontSize: TYPOGRAPHY.size.sm,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
  },
  section: { marginTop: SPACING.md, paddingVertical: SPACING.lg },
  sectionTitle: {
    fontSize: TYPOGRAPHY.size.xs,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: SPACING.md,
  },
  formGroup: { marginBottom: SPACING.md },
  label: {
    fontSize: TYPOGRAPHY.size.sm,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    marginBottom: SPACING.xs,
  },
  input: {
    height: 50,
    borderWidth: 1,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    fontSize: TYPOGRAPHY.size.md,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
  },
  footer: { marginTop: SPACING.xl, alignItems: 'center' },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: RADIUS.lg,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.xl,
    width: '100%',
    marginBottom: SPACING.lg,
  },
  logoutText: {
    fontSize: TYPOGRAPHY.size.md,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    marginLeft: SPACING.sm,
  },
  deleteButton: {
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.xl,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.lg,
  },
  deleteText: {
    fontSize: TYPOGRAPHY.size.sm,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    textDecorationLine: 'underline',
  },
  versionText: {
    fontSize: TYPOGRAPHY.size.xs,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
  },
  backButton: { padding: SPACING.sm, marginLeft: -SPACING.sm },
  saveButton: { padding: SPACING.sm, marginRight: -SPACING.sm },
  saveText: {
    fontSize: TYPOGRAPHY.size.md,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
  },
  subscriptionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
  },
  subscriptionIconContainer: {
    width: 48,
    height: 48,
    borderRadius: RADIUS.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  subscriptionInfo: {
    flex: 1,
  },
  planLabel: {
    fontSize: TYPOGRAPHY.size.md,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
  },
  planStatus: {
    fontSize: TYPOGRAPHY.size.xs,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
  },
  manageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    padding: SPACING.xs,
  },
  manageButtonText: {
    fontSize: TYPOGRAPHY.size.sm,
    fontFamily: TYPOGRAPHY.fontFamily.semiBold,
  },
});
