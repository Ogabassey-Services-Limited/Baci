/**
 * KYC Verification Screen
 * Identity verification for merchants (NIN, BVN, CAC)
 */

import { Ionicons } from '@expo/vector-icons';
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
import { RADIUS, SPACING, TYPOGRAPHY } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/hooks/useTheme';
import { supabase } from '@/lib/supabase';

export default function KYCScreen() {
  const { colors, shadows, isDark } = useTheme();
  const { user } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();

  // Form state
  const [nin, setNin] = useState('');
  const [bvn, setBvn] = useState('');
  const [cac, setCac] = useState('');

  // Fetch existing KYC data
  const { data: merchant, isLoading } = useQuery({
    queryKey: ['merchant-kyc', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('merchants')
        .select('id, nin, bvn, cac_rc_number')
        .eq('user_id', user?.id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  useEffect(() => {
    if (merchant) {
      setNin(merchant.nin || '');
      setBvn(merchant.bvn || '');
      setCac(merchant.cac_rc_number || '');
    }
  }, [merchant]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!merchant?.id) throw new Error('Merchant not found');
      const { error } = await supabase
        .from('merchants')
        .update({
          nin: nin.trim() || null,
          bvn: bvn.trim() || null,
          cac_rc_number: cac.trim() || null,
        })
        .eq('id', merchant.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['merchant'] });
      queryClient.invalidateQueries({ queryKey: ['merchant-kyc'] });
      queryClient.invalidateQueries({ queryKey: ['store-readiness'] });
      Alert.alert('Success', 'Verification details updated successfully');
      router.back();
    },
    onError: (error: unknown) => {
      Alert.alert(
        'Error',
        (error as Error).message || 'Failed to update verification details'
      );
    },
  });

  if (isLoading) {
    return (
      <View
        style={[
          styles.container,
          styles.center,
          { backgroundColor: colors.background },
        ]}
      >
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Identity Verification',
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.text,
          headerShadowVisible: false,
        }}
      />
      <SafeAreaView
        style={[styles.container, { backgroundColor: colors.background }]}
        edges={['bottom']}
      >
        <SystemBars style={isDark ? 'light' : 'dark'} />

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.header}>
            <View
              style={[
                styles.iconCircle,
                { backgroundColor: `${colors.primary}15` },
              ]}
            >
              <Ionicons
                name="shield-checkmark-outline"
                size={40}
                color={colors.primary}
              />
            </View>
            <Text style={[styles.title, { color: colors.text }]}>
              KYC Verification
            </Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              Provide your identification details to enable full payment
              features and build customer trust.
            </Text>
          </View>

          <View style={styles.form}>
            {/* NIN */}
            <View
              style={[
                styles.inputGroup,
                { backgroundColor: colors.card },
                shadows.sm,
              ]}
            >
              <Text style={[styles.label, { color: colors.textSecondary }]}>
                National Identity Number (NIN)
              </Text>
              <TextInput
                style={[
                  styles.input,
                  { color: colors.text, borderColor: colors.border },
                ]}
                value={nin}
                onChangeText={setNin}
                placeholder="11-digit NIN"
                placeholderTextColor={colors.textMuted}
                keyboardType="number-pad"
                maxLength={11}
              />
              <Text style={[styles.helperText, { color: colors.textMuted }]}>
                Your private 11-digit identification number.
              </Text>
            </View>

            {/* BVN */}
            <View
              style={[
                styles.inputGroup,
                { backgroundColor: colors.card },
                shadows.sm,
              ]}
            >
              <Text style={[styles.label, { color: colors.textSecondary }]}>
                Bank Verification Number (BVN)
              </Text>
              <TextInput
                style={[
                  styles.input,
                  { color: colors.text, borderColor: colors.border },
                ]}
                value={bvn}
                onChangeText={setBvn}
                placeholder="11-digit BVN"
                placeholderTextColor={colors.textMuted}
                keyboardType="number-pad"
                maxLength={11}
              />
              <Text style={[styles.helperText, { color: colors.textMuted }]}>
                Required for payment settlement verification.
              </Text>
            </View>

            {/* CAC */}
            <View
              style={[
                styles.inputGroup,
                { backgroundColor: colors.card },
                shadows.sm,
              ]}
            >
              <Text style={[styles.label, { color: colors.textSecondary }]}>
                CAC Registration Number (RC/BN)
              </Text>
              <TextInput
                style={[
                  styles.input,
                  { color: colors.text, borderColor: colors.border },
                ]}
                value={cac}
                onChangeText={setCac}
                placeholder="RC1234567 or BN1234567"
                placeholderTextColor={colors.textMuted}
                autoCapitalize="characters"
              />
              <Text style={[styles.helperText, { color: colors.textMuted }]}>
                Required for registered businesses only.
              </Text>
            </View>

            <Pressable
              style={[
                styles.submitButton,
                { backgroundColor: colors.primary },
                saveMutation.isPending && { opacity: 0.7 },
              ]}
              onPress={() => saveMutation.mutate()}
              disabled={saveMutation.isPending}
            >
              {saveMutation.isPending ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons
                    name="checkmark-circle-outline"
                    size={20}
                    color="#FFFFFF"
                  />
                  <Text style={styles.submitButtonText}>
                    Submit Verification
                  </Text>
                </>
              )}
            </Pressable>
          </View>

          <View style={styles.securityNote}>
            <Ionicons
              name="lock-closed-outline"
              size={14}
              color={colors.textMuted}
            />
            <Text
              style={[styles.securityNoteText, { color: colors.textMuted }]}
            >
              Your data is encrypted and used only for verification purposes.
            </Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { justifyContent: 'center', alignItems: 'center' },
  scrollContent: { padding: SPACING.lg, paddingBottom: SPACING['3xl'] },
  header: { alignItems: 'center', marginBottom: SPACING.xl },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  title: {
    fontSize: TYPOGRAPHY.size.xl,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    marginBottom: SPACING.xs,
  },
  subtitle: {
    fontSize: TYPOGRAPHY.size.sm,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    textAlign: 'center',
    paddingHorizontal: SPACING.md,
  },
  form: { gap: SPACING.lg },
  inputGroup: { padding: SPACING.lg, borderRadius: RADIUS.lg },
  label: {
    fontSize: TYPOGRAPHY.size.sm,
    fontFamily: TYPOGRAPHY.fontFamily.semiBold,
    marginBottom: SPACING.sm,
  },
  input: {
    borderWidth: 1,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    fontSize: TYPOGRAPHY.size.md,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
  },
  helperText: {
    fontSize: TYPOGRAPHY.size.xs,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    marginTop: SPACING.xs,
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.lg,
    borderRadius: RADIUS.lg,
    gap: SPACING.sm,
    marginTop: SPACING.md,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: TYPOGRAPHY.size.md,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
  },
  securityNote: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
    marginTop: SPACING.xl,
  },
  securityNoteText: {
    fontSize: TYPOGRAPHY.size.xs,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
  },
});
