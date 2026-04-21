import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useState } from 'react';
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
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  RADIUS,
  SPACING,
  type ThemeColors,
  TYPOGRAPHY,
} from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';
import { getEmailError } from '@/lib/sanitize';
import { supabase } from '@/lib/supabase';

export default function ForgotPasswordScreen() {
  const { colors, isDark } = useTheme();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleReset = async () => {
    if (!email) {
      Alert.alert('Error', 'Please enter your email address');
      return;
    }

    const emailError = getEmailError(email.trim());
    if (emailError) {
      Alert.alert('Invalid Email', emailError);
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: 'https://usebaci.com/update-password',
      });

      if (error) throw error;

      Alert.alert(
        'Check your email',
        `We have sent a password reset link to ${email}`,
        [{ text: 'Back to Login', onPress: () => router.back() }]
      );
    } catch (error: unknown) {
      const err = error as Error;
      console.error('Reset error:', err);
      Alert.alert('Error', err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const styles = getStyles(colors);

  return (
    <View style={styles.container}>
      <SystemBars style={isDark ? 'light' : 'dark'} />
      <LinearGradient
        colors={[colors.background, colors.backgroundLight]}
        style={StyleSheet.absoluteFillObject}
      />
      <SafeAreaView style={styles.content}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </Pressable>

        <View style={styles.header}>
          <Text style={styles.title}>Reset Password</Text>
          <Text style={styles.subtitle}>
            Enter your email to receive reset instructions.
          </Text>
        </View>

        <View style={styles.form}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Email Address</Text>
            <TextInput
              style={styles.input}
              placeholder="your@email.com"
              placeholderTextColor={colors.textSecondary}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
            />
          </View>

          <Pressable
            style={[styles.button, isLoading && { opacity: 0.7 }]}
            onPress={handleReset}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color={colors.textOnPrimary} />
            ) : (
              <Text style={styles.buttonText}>Send Instructions</Text>
            )}
          </Pressable>
        </View>
      </SafeAreaView>
    </View>
  );
}

const getStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    content: {
      flex: 1,
      padding: SPACING.lg,
    },
    backButton: {
      marginBottom: SPACING.lg,
    },
    header: {
      marginBottom: SPACING.xl,
    },
    title: {
      fontSize: TYPOGRAPHY.size['3xl'],
      fontFamily: TYPOGRAPHY.fontFamily.bold,
      color: colors.text,
      marginBottom: SPACING.sm,
    },
    subtitle: {
      fontSize: TYPOGRAPHY.size.md,
      color: colors.textSecondary,
      lineHeight: TYPOGRAPHY.size.md * TYPOGRAPHY.lineHeight.relaxed,
    },
    form: {
      gap: SPACING.lg,
    },
    inputGroup: {
      gap: SPACING.xs,
    },
    label: {
      color: colors.textSecondary,
      fontSize: TYPOGRAPHY.size.sm,
      fontFamily: TYPOGRAPHY.fontFamily.medium,
    },
    input: {
      backgroundColor: colors.inputBg,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: RADIUS.md,
      padding: SPACING.md,
      color: colors.text,
      fontSize: TYPOGRAPHY.size.md,
    },
    button: {
      backgroundColor: colors.primary,
      paddingVertical: SPACING.lg,
      borderRadius: RADIUS.full,
      alignItems: 'center',
      marginTop: SPACING.md,
    },
    buttonText: {
      color: colors.textOnPrimary,
      fontSize: TYPOGRAPHY.size.lg,
      fontFamily: TYPOGRAPHY.fontFamily.bold,
    },
  });
