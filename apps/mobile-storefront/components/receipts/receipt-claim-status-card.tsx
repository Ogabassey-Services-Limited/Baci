import Ionicons from '@react-native-vector-icons/ionicons';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

export type ClaimStatus = 'loading' | 'claiming' | 'error';

type ClaimCardColors = {
  border: string;
  error: string;
  primaryForeground: string;
  text: string;
  textSecondary: string;
  tint: string;
};

type ReceiptClaimStatusCardProps = {
  colors: ClaimCardColors;
  message: string;
  onRetry?: () => void;
  status: ClaimStatus;
};

export function ReceiptClaimStatusCard({
  colors,
  message,
  onRetry,
  status,
}: ReceiptClaimStatusCardProps) {
  return (
    <View style={[styles.card, { borderColor: colors.border }]}>
      <View
        style={[
          styles.iconWrap,
          {
            backgroundColor: `${colors.tint}18`,
            borderColor: `${colors.tint}33`,
          },
        ]}
      >
        <Ionicons color={colors.tint} name="receipt-outline" size={30} />
      </View>

      <View style={styles.textBlock}>
        <Text style={[styles.eyebrow, { color: colors.tint }]}>
          Receipt ready
        </Text>
        <Text style={[styles.title, { color: colors.text }]}>
          Your receipt is ready.
        </Text>
        <Text style={[styles.body, { color: colors.textSecondary }]}>
          We are linking it to your signed-in account, then your receipts panel
          will open automatically.
        </Text>
      </View>

      <View
        accessibilityLiveRegion="polite"
        accessibilityRole="none"
        style={[
          styles.statusRow,
          {
            backgroundColor:
              status === 'error' ? `${colors.error}14` : `${colors.tint}10`,
            borderColor:
              status === 'error' ? `${colors.error}40` : `${colors.tint}26`,
          },
        ]}
      >
        {status === 'error' ? (
          <Ionicons
            color={colors.error}
            name="alert-circle-outline"
            size={20}
          />
        ) : (
          <ActivityIndicator color={colors.tint} />
        )}
        <Text
          style={[
            styles.statusText,
            { color: status === 'error' ? colors.error : colors.text },
          ]}
        >
          {message}
        </Text>
      </View>

      {status === 'error' && onRetry ? (
        <Pressable
          accessibilityRole="button"
          onPress={onRetry}
          style={[styles.button, { backgroundColor: colors.tint }]}
        >
          <Text
            style={[styles.buttonText, { color: colors.primaryForeground }]}
          >
            Try again
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  body: {
    fontSize: 16,
    lineHeight: 24,
  },
  button: {
    alignItems: 'center',
    borderRadius: 14,
    justifyContent: 'center',
    minHeight: 52,
    paddingHorizontal: 24,
    width: '100%',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '700',
  },
  card: {
    borderRadius: 28,
    borderWidth: 1,
    gap: 22,
    padding: 24,
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0,
    textTransform: 'uppercase',
  },
  iconWrap: {
    alignItems: 'center',
    borderRadius: 28,
    borderWidth: 1,
    height: 56,
    justifyContent: 'center',
    width: 56,
  },
  statusRow: {
    alignItems: 'center',
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    minHeight: 48,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  statusText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 22,
  },
  textBlock: {
    gap: 10,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    lineHeight: 34,
  },
});
