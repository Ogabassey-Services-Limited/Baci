import Ionicons from "@react-native-vector-icons/ionicons/static";
import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, Text } from 'react-native';
import type { ThemeColors } from '@/constants/theme';
import { paywallStyles } from './paywall.styles';

const HEX_COLOR_PATTERN = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

interface PaywallHeaderProps {
  closeButtonTop: number;
  colors: ThemeColors;
  headerPaddingTop: number;
  onClose?: () => void;
}

function getDarkerGradientStop(color: string): string {
  const hexMatch = HEX_COLOR_PATTERN.exec(color);
  if (!hexMatch) return color;

  const normalizedHex =
    hexMatch[1].length === 3
      ? hexMatch[1]
          .split('')
          .map((channel) => `${channel}${channel}`)
          .join('')
      : hexMatch[1];

  const toChannel = (hex: string) => Number.parseInt(hex, 16);
  const darkenChannel = (value: number) => Math.max(0, Math.round(value * 0.6));
  const toHex = (value: number) => value.toString(16).padStart(2, '0');

  const red = darkenChannel(toChannel(normalizedHex.slice(0, 2)));
  const green = darkenChannel(toChannel(normalizedHex.slice(2, 4)));
  const blue = darkenChannel(toChannel(normalizedHex.slice(4, 6)));

  return `#${toHex(red)}${toHex(green)}${toHex(blue)}`;
}

export default function PaywallHeader({
  closeButtonTop,
  colors,
  headerPaddingTop,
  onClose,
}: PaywallHeaderProps) {
  return (
    <LinearGradient
      colors={[colors.primary, getDarkerGradientStop(colors.primary)]}
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
