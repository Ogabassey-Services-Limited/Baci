import { Ionicons } from '@expo/vector-icons';
import { Alert, Pressable, Text, View } from 'react-native';
import Colors, { BRAND } from '@/constants/Colors';
import { setClipboardString } from '@/lib/clipboard';
import { styles } from './purchase-success.styles';

interface PurchaseVoucherCardProps {
  colors: typeof Colors.light;
  voucherPin: string;
}

export default function PurchaseVoucherCard({
  colors,
  voucherPin,
}: PurchaseVoucherCardProps) {
  const handleCopyVoucher = async () => {
    try {
      const copied = await setClipboardString(voucherPin);
      Alert.alert(
        copied ? 'Copied' : 'Copy Failed',
        copied ? 'Token copied to clipboard.' : 'Could not copy this token.'
      );
    } catch (copyError) {
      console.error('Failed to copy utility voucher token:', copyError);
      Alert.alert('Copy Failed', 'Could not copy this token.');
    }
  };

  return (
    <View
      style={[
        styles.voucherCard,
        { backgroundColor: colors.card, borderColor: colors.border },
      ]}
    >
      <Text style={[styles.voucherLabel, { color: colors.textSecondary }]}>
        Voucher / Token
      </Text>
      <Text selectable style={[styles.voucherCode, { color: colors.text }]}>
        {voucherPin}
      </Text>
      <Pressable
        style={[styles.tokenButton, { borderColor: colors.border }]}
        onPress={handleCopyVoucher}
        accessibilityRole="button"
        accessibilityLabel="Copy voucher token"
      >
        <Ionicons name="copy-outline" size={17} color={BRAND.primary} />
        <Text style={styles.tokenButtonText}>Copy token</Text>
      </Pressable>
    </View>
  );
}
