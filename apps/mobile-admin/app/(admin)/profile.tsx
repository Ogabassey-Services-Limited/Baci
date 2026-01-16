import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  ActivityIndicator,
  Alert,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/hooks/useTheme';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { SPACING, RADIUS, TYPOGRAPHY } from '@/constants/theme';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { usePushNotifications } from '@/hooks/usePushNotifications';

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

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');

  // Fetch staff registration details (where the personal name/phone usually lives)
  const { data: profile, isLoading } = useQuery({
    queryKey: ['user-profile', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('staff_members')
        .select('id, email, name, role, phone')
        .eq('user_id', user!.id)
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

  const handleLogout = async () => {
    Alert.alert('Log Out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log Out',
        style: 'destructive',
        onPress: async () => {
          // Unregister push notifications first
          await unregisterPush();
          await signOut();
          router.replace('/(auth)/login');
        },
      },
    ]);
  };

  const { colors, isDark } = useTheme();
  const router = useRouter();
  const queryClient = useQueryClient();

  if (isLoading) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: colors.background }]}
      >
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
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
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
        >
          {/* Header/Avatar Section */}
          <View style={styles.headerSection}>
            <View
              style={[
                styles.avatar,
                { backgroundColor: colors.primary + '20' },
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
            <Text style={[styles.versionText, { color: colors.textMuted }]}>
              Version 1.0.0
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
});
