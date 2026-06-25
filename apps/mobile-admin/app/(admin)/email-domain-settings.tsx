import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Clipboard from 'expo-clipboard';
import { Stack } from 'expo-router';
import { ActivityIndicator, Alert, ScrollView, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/hooks/useTheme';
import {
  type EmailDomainConfig,
  getEmailDomain,
  registerEmailDomain,
  setEmailDomainEnabled,
  verifyEmailDomain,
} from '@/lib/email-domain-api';
import { EmailDomainConfiguredView } from '@/components/email-domain/email-domain-configured-view';
import {
  EmailDomainLoadError,
  getEmailDomainErrorMessage,
} from '@/components/email-domain/email-domain-load-error';
import { EmailDomainRegistrationForm } from '@/components/email-domain/email-domain-registration-form';
import { makeEmailDomainSettingsStyles } from '@/components/email-domain/email-domain-settings.styles';

const QUERY_KEY = ['merchant', 'email-domain'];

export default function EmailDomainSettingsScreen() {
  const { colors } = useTheme();
  const styles = makeEmailDomainSettingsStyles(colors);
  const queryClient = useQueryClient();

  const {
    data: config,
    error: loadError,
    isError,
    isFetching,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: getEmailDomain,
  });

  const handleError = (error: unknown) =>
    Alert.alert('Email domain', getEmailDomainErrorMessage(error));
  const refresh = (nextConfig: EmailDomainConfig | null) => {
    queryClient.setQueryData(QUERY_KEY, nextConfig);
    void queryClient.invalidateQueries({ queryKey: QUERY_KEY });
  };

  const registerMutation = useMutation({
    mutationFn: registerEmailDomain,
    onSuccess: refresh,
    onError: handleError,
  });
  const verifyMutation = useMutation({
    mutationFn: verifyEmailDomain,
    onSuccess: refresh,
    onError: handleError,
  });
  const enableMutation = useMutation({
    mutationFn: setEmailDomainEnabled,
    onSuccess: refresh,
    onError: handleError,
  });

  const copy = async (value: string) => {
    await Clipboard.setStringAsync(value);
    Alert.alert('Copied', 'Value copied to clipboard.');
  };

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <Stack.Screen options={{ title: 'Email Domain' }} />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.intro}>
          Send your store's emails from your own domain (e.g.
          noreply@yourstore.com) for better inbox delivery.
        </Text>

        {isLoading && !config ? (
          <ActivityIndicator color={colors.primary} style={styles.loading} />
        ) : isError && !config ? (
          <EmailDomainLoadError
            colors={colors}
            error={loadError}
            refreshing={isFetching}
            onRetry={() => refetch()}
          />
        ) : config ? (
          <EmailDomainConfiguredView
            colors={colors}
            config={config}
            onCopy={copy}
            onVerify={() => verifyMutation.mutate()}
            verifying={verifyMutation.isPending}
            onToggle={(enabled) => enableMutation.mutate(enabled)}
            toggling={enableMutation.isPending}
          />
        ) : (
          <EmailDomainRegistrationForm
            colors={colors}
            onSubmit={(domain) => registerMutation.mutate(domain)}
            pending={registerMutation.isPending}
          />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
