import Ionicons from '@react-native-vector-icons/ionicons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { FeatureGateScreen } from '@/components/billing/FeatureGateScreen';
import { connectStyles as styles } from '@/components/domains/connect.styles';
import {
  API_URL,
  DomainUpgradeRequiredError,
  isUpgradeRequiredResponse,
} from '@/components/domains/domain-api-helpers';
import { AppFormScreen } from '@/components/ui/AppFormScreen';
import { SPACING } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';
import { supabase } from '@/lib/supabase';

// Basic Regex Validation
const DOMAIN_REGEX =
  /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*\.[a-z]{2,}$/i;
const DOMAIN_CONNECT_TIMEOUT_MS = 10_000;

interface DomainVerificationInfo {
  domain: string;
  token: string;
}

async function readResponseJson(response: Response): Promise<unknown> {
  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) {
    return null;
  }

  return await response.json().catch(() => null);
}

async function readResponseError(
  response: Response,
  fallback: string,
  payload: unknown
): Promise<string> {
  if (
    payload &&
    typeof payload === 'object' &&
    'error' in payload &&
    typeof payload.error === 'string' &&
    payload.error.trim()
  ) {
    return payload.error;
  }

  const text = await response.text().catch(() => '');
  return text.trim() || `${fallback} (${response.status})`;
}

function isDomainConnectionResponse(value: unknown): value is {
  domain: { domain: string };
  verification: { value: string };
} {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const record = value as Record<string, unknown>;
  const domain = record.domain;
  const verification = record.verification;
  return (
    !!domain &&
    typeof domain === 'object' &&
    typeof (domain as { domain?: unknown }).domain === 'string' &&
    !!verification &&
    typeof verification === 'object' &&
    typeof (verification as { value?: unknown }).value === 'string'
  );
}

// Module-scope helpers keep try/finally, throw-inside-try, and dynamic
// import() out of the component body so React Compiler can memoize it.
async function requestDomainConnection(
  cleanDomain: string
): Promise<DomainVerificationInfo> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');

  const controller = new AbortController();
  const timeoutId = setTimeout(
    () => controller.abort(),
    DOMAIN_CONNECT_TIMEOUT_MS
  );
  let response: Response;
  try {
    response = await fetch(`${API_URL}/domains`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ domain: cleanDomain }),
      signal: controller.signal,
    });
  } catch (error) {
    if (controller.signal.aborted) {
      throw new Error(
        'Request timed out. Check your connection and try again.',
        { cause: error }
      );
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }

  const result = await readResponseJson(response);

  if (!response.ok) {
    const code =
      result &&
      typeof result === 'object' &&
      'code' in result &&
      typeof (result as { code?: unknown }).code === 'string'
        ? (result as { code: string }).code
        : undefined;
    const message = await readResponseError(
      response,
      'Failed to add domain',
      result
    );
    if (isUpgradeRequiredResponse(response.status, code)) {
      throw new DomainUpgradeRequiredError(message);
    }
    throw new Error(message);
  }

  if (!isDomainConnectionResponse(result)) {
    throw new Error('Unexpected server response');
  }

  return {
    domain: result.domain.domain,
    token: result.verification.value,
  };
}

async function copyToClipboard(text: string) {
  try {
    const clipboard = await import('expo-clipboard');
    await clipboard.setStringAsync(text);
    Alert.alert('Copied', 'Text copied to clipboard');
  } catch {
    Alert.alert('Error', 'Failed to copy to clipboard');
  }
}

export default function ConnectDomainScreen() {
  const { colors, shadows } = useTheme();
  const router = useRouter();
  const [domain, setDomain] = useState('');
  const [loading, setLoading] = useState(false);
  const [verificationInfo, setVerificationInfo] =
    useState<DomainVerificationInfo | null>(null);

  const handleConnect = () => {
    const cleanDomain = domain.trim().toLowerCase();

    if (!DOMAIN_REGEX.test(cleanDomain)) {
      Alert.alert(
        'Invalid Domain',
        'Please enter a valid domain (e.g. example.com)'
      );
      return;
    }

    setLoading(true);
    requestDomainConnection(cleanDomain)
      .then((info) => {
        // Success - Show verification info
        setVerificationInfo(info);
      })
      .catch((error: unknown) => {
        if (error instanceof DomainUpgradeRequiredError) {
          Alert.alert('Upgrade required', error.message, [
            { text: 'Not now', style: 'cancel' },
            {
              text: 'Upgrade',
              onPress: () => router.push('/(admin)/subscribe'),
            },
          ]);
          return;
        }
        Alert.alert(
          'Error',
          error instanceof Error ? error.message : 'Failed to add domain'
        );
      })
      .finally(() => {
        setLoading(false);
      });
  };

  const handleDone = () => {
    router.dismissAll();
    router.push('/domains');
  };

  // Render Verification Step
  if (verificationInfo) {
    return (
      <FeatureGateScreen
        description="Connect branded domains when Baci Pro is active."
        feature="custom_domain"
        serverEntitlementRequired
        title="Custom domains are a Baci Pro feature"
      >
        <ScrollView
          style={[styles.container, { backgroundColor: colors.background }]}
          contentContainerStyle={styles.content}
        >
          <View
            style={[
              styles.successHeader,
              { backgroundColor: `${colors.success}15` },
            ]}
          >
            <Ionicons
              name="checkmark-circle"
              size={48}
              color={colors.success}
            />
            <Text style={[styles.title, { color: colors.text }]}>
              Domain Added!
            </Text>
            <Text
              style={[
                styles.subtitle,
                { color: colors.textSecondary, textAlign: 'center' },
              ]}
            >
              To verify ownership of {verificationInfo.domain}, please add the
              following TXT record to your DNS settings.
            </Text>
          </View>

          <View
            style={[
              styles.recordCard,
              { backgroundColor: colors.card, borderColor: colors.border },
              shadows.sm,
            ]}
          >
            <View style={styles.recordRow}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>
                Type
              </Text>
              <Text style={[styles.value, { color: colors.text }]}>TXT</Text>
            </View>
            <View
              style={[styles.divider, { backgroundColor: colors.border }]}
            />

            <View style={styles.recordRow}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>
                Host
              </Text>
              <Text style={[styles.value, { color: colors.text }]}>@</Text>
            </View>
            <View
              style={[styles.divider, { backgroundColor: colors.border }]}
            />

            <View style={styles.recordRow}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>
                Value
              </Text>
              <Pressable
                style={[
                  styles.copyValue,
                  { backgroundColor: colors.background },
                ]}
                onPress={() => copyToClipboard(verificationInfo.token)}
              >
                <Text
                  style={[styles.tokenText, { color: colors.text }]}
                  numberOfLines={1}
                  ellipsizeMode="middle"
                >
                  {verificationInfo.token}
                </Text>
                <Ionicons
                  name="copy-outline"
                  size={16}
                  color={colors.primary}
                />
              </Pressable>
            </View>
          </View>

          <View
            style={[
              styles.noteContainer,
              { backgroundColor: `${colors.primary}10` },
            ]}
          >
            <Ionicons name="time-outline" size={20} color={colors.primary} />
            <Text style={[styles.noteText, { color: colors.text }]}>
              DNS changes can take up to 24 hours to propagate.
            </Text>
          </View>

          <Pressable
            style={[
              styles.button,
              { backgroundColor: colors.primary, marginTop: SPACING.xl },
            ]}
            onPress={handleDone}
          >
            <Text style={[styles.buttonText, { color: colors.textOnPrimary }]}>
              I've Added the Record
            </Text>
          </Pressable>
        </ScrollView>
      </FeatureGateScreen>
    );
  }

  // Render Input Step
  return (
    <FeatureGateScreen
      description="Connect branded domains when Baci Pro is active."
      feature="custom_domain"
      serverEntitlementRequired
      title="Custom domains are a Baci Pro feature"
    >
      <AppFormScreen
        style={[styles.container, { backgroundColor: colors.background }]}
        contentContainerStyle={styles.content}
        keyboardOffsetPreset="compactHeader"
      >
        <Text style={[styles.title, { color: colors.text }]}>
          Connect Existing Domain
        </Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          Enter the domain name you own (e.g. example.com) to connect it to your
          store.
        </Text>

        <View style={{ marginTop: SPACING.xl }}>
          <Text style={[styles.inputLabel, { color: colors.text }]}>
            Domain Name
          </Text>
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
                color: colors.text,
              },
            ]}
            placeholder="example.com"
            placeholderTextColor={colors.textSecondary}
            value={domain}
            onChangeText={setDomain}
            autoCapitalize="none"
            autoCorrect={false}
            editable={!loading}
          />
        </View>

        <Pressable
          style={[
            styles.button,
            { backgroundColor: colors.primary, opacity: loading ? 0.7 : 1 },
          ]}
          onPress={handleConnect}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color={colors.textOnPrimary} />
          ) : (
            <Text style={[styles.buttonText, { color: colors.textOnPrimary }]}>
              Connect Domain
            </Text>
          )}
        </Pressable>
      </AppFormScreen>
    </FeatureGateScreen>
  );
}
