import Ionicons from "@react-native-vector-icons/ionicons/static";
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
import { AppFormScreen } from '@/components/ui/AppFormScreen';
import { connectStyles as styles } from '@/components/domains/connect.styles';
import { SPACING } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';
import { supabase } from '@/lib/supabase';

// Use Environment Variable or Fallback
const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://baci.app/api';

export default function ConnectDomainScreen() {
  const { colors, shadows } = useTheme();
  const router = useRouter();
  const [domain, setDomain] = useState('');
  const [loading, setLoading] = useState(false);
  const [verificationInfo, setVerificationInfo] = useState<{
    domain: string;
    token: string;
  } | null>(null);

  const handleConnect = async () => {
    const cleanDomain = domain.trim().toLowerCase();
    // Basic Regex Validation
    const domainRegex =
      /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*\.[a-z]{2,}$/i;

    if (!domainRegex.test(cleanDomain)) {
      Alert.alert(
        'Invalid Domain',
        'Please enter a valid domain (e.g. example.com)'
      );
      return;
    }

    setLoading(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await fetch(`${API_URL}/domains`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ domain: cleanDomain }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to add domain');
      }

      // Success - Show verification info
      setVerificationInfo({
        domain: result.domain.domain,
        token: result.verification.value,
      });
    } catch (error: unknown) {
      Alert.alert('Error', (error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      const clipboard = await import('expo-clipboard');
      await clipboard.setStringAsync(text);
      Alert.alert('Copied', 'Text copied to clipboard');
    } catch {
      Alert.alert('Error', 'Failed to copy to clipboard');
    }
  };

  const handleDone = () => {
    router.dismissAll();
    router.push('/domains');
  };

  // Render Verification Step
  if (verificationInfo) {
    return (
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
          <Ionicons name="checkmark-circle" size={48} color={colors.success} />
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
          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          <View style={styles.recordRow}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>
              Host
            </Text>
            <Text style={[styles.value, { color: colors.text }]}>@</Text>
          </View>
          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          <View style={styles.recordRow}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>
              Value
            </Text>
            <Pressable
              style={[styles.copyValue, { backgroundColor: colors.background }]}
              onPress={() => copyToClipboard(verificationInfo.token)}
            >
              <Text
                style={[styles.tokenText, { color: colors.text }]}
                numberOfLines={1}
                ellipsizeMode="middle"
              >
                {verificationInfo.token}
              </Text>
              <Ionicons name="copy-outline" size={16} color={colors.primary} />
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
          <Text style={styles.buttonText}>I've Added the Record</Text>
        </Pressable>
      </ScrollView>
    );
  }

  // Render Input Step
  return (
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
              color: colors.text,
              borderColor: colors.border,
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
          <ActivityIndicator color="white" />
        ) : (
          <Text style={styles.buttonText}>Connect Domain</Text>
        )}
      </Pressable>
    </AppFormScreen>
  );
}
