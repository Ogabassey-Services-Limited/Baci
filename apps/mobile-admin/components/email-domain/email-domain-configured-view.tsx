import Ionicons from '@react-native-vector-icons/ionicons';
import { ActivityIndicator, Pressable, Switch, Text, View } from 'react-native';
import type {
  EmailDomainConfig,
  EmailDomainDnsRecord,
} from '@/lib/email-domain-api';
import type { EmailDomainColors } from './email-domain-settings.styles';
import { makeEmailDomainSettingsStyles } from './email-domain-settings.styles';

interface EmailDomainConfiguredViewProps {
  colors: EmailDomainColors;
  config: EmailDomainConfig;
  onCopy: (value: string) => void;
  onVerify: () => void;
  verifying: boolean;
  onToggle: (enabled: boolean) => void;
  toggling: boolean;
}

function getStatusPresentation(
  status: EmailDomainConfig['status'],
  colors: EmailDomainColors
) {
  if (status === 'verified') {
    return {
      label: 'Verified',
      backgroundColor: colors.successLight,
      color: colors.success,
      helper: null,
    };
  }
  if (status === 'failed') {
    return {
      label: 'Verification failed',
      backgroundColor: colors.errorLight,
      color: colors.error,
      helper:
        'Verification failed. Check that the DKIM TXT and bounce CNAME records exactly match, then tap Verify again.',
    };
  }
  return {
    label: 'Pending DNS',
    backgroundColor: colors.infoLight,
    color: colors.info,
    helper:
      "Add these records to your domain's DNS, then tap Verify. It can take a few minutes to propagate.",
  };
}

export function EmailDomainConfiguredView({
  colors,
  config,
  onCopy,
  onVerify,
  verifying,
  onToggle,
  toggling,
}: EmailDomainConfiguredViewProps) {
  const styles = makeEmailDomainSettingsStyles(colors);
  const verified = config.status === 'verified';
  const status = getStatusPresentation(config.status, colors);

  return (
    <View style={styles.card}>
      <View style={styles.domainRow}>
        <Text style={styles.domainName}>{config.domain}</Text>
        <View style={[styles.badge, { backgroundColor: status.backgroundColor }]}>
          <Text style={[styles.badgeText, { color: status.color }]}>
            {status.label}
          </Text>
        </View>
      </View>

      {status.helper ? <Text style={styles.helper}>{status.helper}</Text> : null}

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
            <Text style={styles.primaryButtonText}>I've added these — Verify</Text>
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
  colors: EmailDomainColors;
  record: EmailDomainDnsRecord;
  onCopy: (value: string) => void;
}) {
  const styles = makeEmailDomainSettingsStyles(colors);
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
