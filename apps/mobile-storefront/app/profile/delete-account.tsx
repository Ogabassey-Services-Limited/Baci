import { Ionicons } from '@expo/vector-icons';
import { Redirect, Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useToast } from '@/components/ui/Toast';
import { useColorScheme } from '@/components/useColorScheme';
import Colors, { BRAND } from '@/constants/Colors';
import { useRequireAuth } from '@/hooks/use-auth-guard';
import { hasAppleProvider } from '@/lib/account-deletion';
import { useAuthStore } from '@/stores/auth-store';
import { styles } from '@/components/profile/delete-account-styles';

const APPLE_REVOKE_GUIDE_URL = 'https://support.apple.com/en-us/102571';

export default function DeleteAccountScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const router = useRouter();
  const { isLoading: isAuthLoading, redirectTo, user } = useRequireAuth();
  const deleteAccount = useAuthStore((state) => state.deleteAccount);
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const toast = useToast();

  const signedInWithApple = hasAppleProvider(user);

  const openAppleRevokeGuide = async () => {
    try {
      const canOpen = await Linking.canOpenURL(APPLE_REVOKE_GUIDE_URL);
      if (!canOpen) {
        toast.error('Unable to open Apple support link on this device.');
        return;
      }

      await Linking.openURL(APPLE_REVOKE_GUIDE_URL);
    } catch {
      toast.error('Unable to open Apple support link on this device.');
    }
  };

  const runDeleteAccount = async () => {
    setIsDeleting(true);
    try {
      const result = await deleteAccount();

      if (!result.success) {
        toast.error(result.error || 'Unable to delete your account right now.');
        return;
      }

      setIsConfirmed(false);

      Alert.alert(
        'Account deleted',
        'Your account has been permanently deleted from this app.',
        [{ text: 'OK', onPress: () => router.replace('/') }]
      );
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : 'Something went wrong. Please try again.'
      );
    } finally {
      setIsDeleting(false);
    }
  };

  const confirmDelete = () => {
    Alert.alert(
      'Delete account permanently?',
      'This action cannot be undone. Your sign-in access will be removed immediately.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete account',
          style: 'destructive',
          onPress: () => {
            void runDeleteAccount();
          },
        },
      ]
    );
  };

  if (redirectTo) {
    return <Redirect href={redirectTo} />;
  }

  if (isAuthLoading) {
    return (
      <View
        style={[
          styles.loadingContainer,
          { backgroundColor: colors.background },
        ]}
      >
        <ActivityIndicator size="large" color={BRAND.primary} />
      </View>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: 'Delete Account' }} />
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={[styles.title, { color: colors.text }]}>
            Delete your account
          </Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            This action is permanent. Once deleted, you cannot recover this
            account.
          </Text>

          <View
            style={[
              styles.card,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <Text style={[styles.cardTitle, { color: colors.text }]}>
              What will be deleted now
            </Text>
            <Text style={[styles.bullet, { color: colors.textSecondary }]}>
              • Sign-in access for this account
            </Text>
            <Text style={[styles.bullet, { color: colors.textSecondary }]}>
              • Customer profile data linked to this account
            </Text>
            <Text style={[styles.bullet, { color: colors.textSecondary }]}>
              • Saved wishlist items linked to this email
            </Text>
            <Text style={[styles.bullet, { color: colors.textSecondary }]}>
              • Storefront push notification tokens
            </Text>
          </View>

          <View
            style={[
              styles.card,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <Text style={[styles.cardTitle, { color: colors.text }]}>
              What we retain for compliance
            </Text>
            <Text style={[styles.bullet, { color: colors.textSecondary }]}>
              • Historical order and transaction records required for legal,
              tax, fraud, dispute, and audit obligations.
            </Text>
          </View>

          {signedInWithApple ? (
            <View
              style={[
                styles.card,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
            >
              <Text style={[styles.cardTitle, { color: colors.text }]}>
                Signed in with Apple?
              </Text>
              <Text style={[styles.bullet, { color: colors.textSecondary }]}>
                • After deletion, revoke app access from your Apple ID settings
                if needed.
              </Text>
              <Pressable
                onPress={() => {
                  void openAppleRevokeGuide();
                }}
                style={styles.linkButton}
                accessibilityRole="button"
                accessibilityLabel="Open Apple revoke guide"
              >
                <Text style={[styles.linkText, { color: BRAND.primary }]}>
                  Open Apple revoke guide
                </Text>
              </Pressable>
            </View>
          ) : null}

          <Pressable
            testID="delete-account-confirm"
            onPress={() => setIsConfirmed((current) => !current)}
            style={[
              styles.checkboxRow,
              { borderColor: colors.border, backgroundColor: colors.card },
            ]}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: isConfirmed }}
            accessibilityLabel="I understand this action is permanent"
          >
            <Ionicons
              name={isConfirmed ? 'checkbox' : 'square-outline'}
              size={22}
              color={isConfirmed ? BRAND.primary : colors.textSecondary}
            />
            <Text style={[styles.checkboxText, { color: colors.text }]}>
              I understand this action is permanent.
            </Text>
          </Pressable>
        </ScrollView>

        <SafeAreaView
          edges={['bottom']}
          style={[
            styles.footer,
            {
              backgroundColor: colors.background,
              borderTopColor: colors.border,
            },
          ]}
        >
          <Pressable
            testID="delete-account-button"
            onPress={confirmDelete}
            disabled={!isConfirmed || isDeleting}
            style={[
              styles.deleteButton,
              {
                backgroundColor:
                  !isConfirmed || isDeleting ? colors.border : colors.error,
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Delete account"
            accessibilityHint="Permanently deletes your account"
          >
            {isDeleting ? (
              <>
                <ActivityIndicator color={colors.destructiveForeground} />
                <Text
                  style={[
                    styles.deleteButtonText,
                    { color: colors.destructiveForeground },
                  ]}
                >
                  Deleting account...
                </Text>
              </>
            ) : (
              <Text
                style={[
                  styles.deleteButtonText,
                  {
                    color: isConfirmed
                      ? colors.destructiveForeground
                      : colors.textSecondary,
                  },
                ]}
              >
                Delete Account
              </Text>
            )}
          </Pressable>
        </SafeAreaView>
        <toast.Toast />
      </View>
    </>
  );
}
