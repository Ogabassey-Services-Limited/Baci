import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, Text } from 'react-native';
import type { ThemeColors } from '@/constants/theme';
import { paywallStyles } from './paywall.styles';

interface PaywallHeaderProps {
  closeButtonTop: number;
  colors: ThemeColors;
  headerPaddingTop: number;
  onClose?: () => void;
}

export default function PaywallHeader({
  closeButtonTop,
  colors,
  headerPaddingTop,
  onClose,
}: PaywallHeaderProps) {
  return (
    <LinearGradient
      colors={[colors.primary, '#8B0000']}
      style={[paywallStyles.header, { paddingTop: headerPaddingTop }]}
    >
      <Pressable
        style={[paywallStyles.closeButton, { top: closeButtonTop }]}
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel="Close paywall"
      >
        <Ionicons name="close" size={24} color="#FFF" />
      </Pressable>

      <Ionicons
        name="diamond"
        size={48}
        color="#FFF"
        style={paywallStyles.headerIcon}
      />
      <Text style={paywallStyles.headerTitle}>Baci Pro</Text>
      <Text style={paywallStyles.headerSubtitle}>
        The ultimate toolkit for modern merchants
      </Text>
    </LinearGradient>
  );
}
