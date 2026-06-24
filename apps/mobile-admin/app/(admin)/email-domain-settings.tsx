import Ionicons from '@react-native-vector-icons/ionicons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Clipboard from 'expo-clipboard';
import { Stack } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { RADIUS, SPACING, TYPOGRAPHY } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';
import {
  type EmailDomainConfig,
  type EmailDomainDnsRecord,
  getEmailDomain,
  registerEmailDomain,
  setEmailDomainEnabled,
  verifyEmailDomain,
} from '@/lib/email-domain-api';

const QUERY_KEY = ['merchant', 'email-domain'];

type Colors = ReturnType<typeof useTheme>['colors'];

export default function EmailDomainSettingsScreen() {
  const { colors } = useTheme();
  const queryClient = useQueryClient();
  const [domainInput, setDomainInput] = useState('');

  const { data: config, isLoading } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: getEmailDomain,
  });

  const handleError = (error: unknown) =>
    Alert.alert(
      'Email domain',
      error instanceof Error ? error.message : 'Something went wrong'
    );
  const refresh = () => queryClient.invalidateQueries({ queryKey: QUERY_KEY });

  const registerMutation = useMutation({
    mutationFn: () => registerEmailDomain(domainInput.trim()),
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

  const styles = makeStyles(colors);

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <Stack.Screen options={{ title: 'Email Domain' }} />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.intro}>
          Send your store's emails from your own domain (e.g.
          noreply@yourstore.com) for better inbox delivery.
        </Text>

        {isLoading ? (
          <ActivityIndicator color={colors.primary} style={styles.loading} />
        ) : config ? (
          <ConfiguredView
            colors={colors}
            config={config}
            onCopy={copy}
            onVerify={() => verifyMutation.mutate()}
            verifying={verifyMutation.isPending}
            onToggle={(enabled) => enableMutation.mutate(enabled)}
            toggling={enableMutation.isPending}
          />
        ) : (
          <View style={styles.card}>
            <Text style={styles.label}>Your sending domain</Text>
            <TextInput
              style={styles.input}
              value={domainInput}
              onChangeText={setDomainInput}
              placeholder="yourstore.com"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              accessibilityLabel="Sending domain"
            />
            <Pressable
              style={[
                styles.primaryButton,
                (!domainInput.trim() || registerMutation.isPending) &&
                  styles.buttonDisabled,
              ]}
              disabled={!domainInput.trim() || registerMutation.isPending}
              onPress={() => registerMutation.mutate()}
              accessibilityRole="button"
            >
              {registerMutation.isPending ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.primaryButtonText}>Add domain</Text>
              )}
            </Pressable>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function ConfiguredView({
  colors,
  config,
  onCopy,
  onVerify,
  verifying,
  onToggle,
  toggling,
}: {
  colors: Colors;
  config: EmailDomainConfig;
  onCopy: (value: string) => void;
  onVerify: () => void;
  verifying: boolean;
  onToggle: (enabled: boolean) => void;
  toggling: boolean;
}) {
  const styles = makeStyles(colors);
  const verified = config.status === 'verified';
  return (
    <View style={styles.card}>
      <View style={styles.domainRow}>
        <Text style={styles.domainName}>{config.domain}</Text>
        <View
          style={[
            styles.badge,
            {
              backgroundColor: verified
                ? colors.successLight
                : colors.infoLight,
            },
          ]}
        >
          <Text
            style={[
              styles.badgeText,
              { color: verified ? colors.success : colors.info },
            ]}
          >
            {verified ? 'Verified' : 'Pending DNS'}
          </Text>
        </View>
      </View>

      {!verified && (
        <Text style={styles.helper}>
          Add these records to your domain's DNS, then tap Verify. It can take a
          few minutes to propagate.
        </Text>
      )}

      {config.records.map((record) => (
        <RecordRow
          key={`${record.type}:${record.host}`}
          colors={colors}
          record={record}
          onCopy={onCopy}
        />
      ))}

      {verified ? (
        <View style={styles.toggleRow}>
          <Text style={styles.label}>Send from this domain</Text>
          <Switch
            value={config.enabled}
            disabled={toggling}
            onValueChange={onToggle}
            accessibilityLabel="Send from this domain"
          />
        </View>
      ) : (
        <Pressable
          style={[styles.primaryButton, verifying && styles.buttonDisabled]}
          disabled={verifying}
          onPress={onVerify}
          accessibilityRole="button"
        >
          {verifying ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.primaryButtonText}>
              I've added these — Verify
            </Text>
          )}
        </Pressable>
      )}
    </View>
  );
}

function RecordRow({
  colors,
  record,
  onCopy,
}: {
  colors: Colors;
  record: EmailDomainDnsRecord;
  onCopy: (value: string) => void;
}) {
  const styles = makeStyles(colors);
  return (
    <View style={styles.record}>
      <Text style={styles.recordType}>{record.type}</Text>
      <Text style={styles.recordHost} numberOfLines={1}>
        {record.host}
      </Text>
      <View style={styles.recordValueRow}>
        <Text style={styles.recordValue} numberOfLines={1}>
          {record.value}
        </Text>
        <Pressable
          onPress={() => onCopy(record.value)}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={`Copy ${record.type} value`}
        >
          <Ionicons name="copy-outline" size={18} color={colors.primary} />
        </Pressable>
      </View>
    </View>
  );
}

function makeStyles(colors: Colors) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    content: { padding: SPACING.lg, gap: SPACING.lg },
    intro: {
      fontFamily: TYPOGRAPHY.fontFamily.regular,
      fontSize: TYPOGRAPHY.size.md,
      color: colors.textSecondary,
      lineHeight: 20,
    },
    loading: { marginTop: SPACING['2xl'] },
    card: {
      backgroundColor: colors.card,
      borderRadius: RADIUS.lg,
      borderWidth: 1,
      borderColor: colors.border,
      padding: SPACING.lg,
      gap: SPACING.md,
    },
    label: {
      fontFamily: TYPOGRAPHY.fontFamily.semiBold,
      fontSize: TYPOGRAPHY.size.md,
      color: colors.text,
    },
    input: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: RADIUS.md,
      padding: SPACING.md,
      fontSize: TYPOGRAPHY.size.lg,
      color: colors.text,
    },
    primaryButton: {
      backgroundColor: colors.primary,
      borderRadius: RADIUS.md,
      paddingVertical: SPACING.md,
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: SPACING.touchTarget,
    },
    primaryButtonText: {
      fontFamily: TYPOGRAPHY.fontFamily.bold,
      fontSize: TYPOGRAPHY.size.lg,
      color: '#fff',
    },
    buttonDisabled: { opacity: 0.5 },
    domainRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    domainName: {
      fontFamily: TYPOGRAPHY.fontFamily.bold,
      fontSize: TYPOGRAPHY.size.xl,
      color: colors.text,
    },
    badge: {
      paddingHorizontal: SPACING.sm,
      paddingVertical: SPACING.xs,
      borderRadius: RADIUS.full,
    },
    badgeText: {
      fontFamily: TYPOGRAPHY.fontFamily.semiBold,
      fontSize: TYPOGRAPHY.size.xs,
    },
    helper: {
      fontFamily: TYPOGRAPHY.fontFamily.regular,
      fontSize: TYPOGRAPHY.size.sm,
      color: colors.textSecondary,
      lineHeight: 18,
    },
    record: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: RADIUS.md,
      padding: SPACING.md,
      gap: SPACING.xs,
    },
    recordType: {
      fontFamily: TYPOGRAPHY.fontFamily.bold,
      fontSize: TYPOGRAPHY.size.xs,
      color: colors.textMuted,
    },
    recordHost: {
      fontFamily: TYPOGRAPHY.fontFamily.medium,
      fontSize: TYPOGRAPHY.size.sm,
      color: colors.text,
    },
    recordValueRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: SPACING.sm,
    },
    recordValue: {
      flex: 1,
      fontFamily: TYPOGRAPHY.fontFamily.regular,
      fontSize: TYPOGRAPHY.size.xs,
      color: colors.textSecondary,
    },
    toggleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
  });
}
