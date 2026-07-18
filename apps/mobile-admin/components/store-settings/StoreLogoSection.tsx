import { type StyleProp, Text, View, type ViewStyle } from 'react-native';
import { LogoPicker } from '@/components/ui/LogoPicker';
import type { StatusModalState } from '@/components/ui/StatusModal';
import type { ThemeColors } from '@/constants/theme';
import { useCachedImageUri } from '@/hooks/useCachedImageUri';
import { storeSettingsStyles as styles } from './store-settings.styles';

interface StoreLogoSectionProps {
  businessName: string;
  colors: ThemeColors;
  logoUri: string | null | undefined;
  merchantId: string | undefined;
  onStatusChange: (status: StatusModalState) => void;
  onUploadSuccess: () => void;
  shadowStyle: StyleProp<ViewStyle>;
}

export function StoreLogoSection({
  businessName,
  colors,
  logoUri,
  merchantId,
  onStatusChange,
  onUploadSuccess,
  shadowStyle,
}: StoreLogoSectionProps) {
  const { fallbackUri: fallbackLogoUri, uri: cachedLogoUri } =
    useCachedImageUri(logoUri, {
      width: 256,
      height: 256,
      resize: 'contain',
    });

  return (
    <View style={[styles.card, { backgroundColor: colors.card }, shadowStyle]}>
      <Text style={[styles.label, { color: colors.textSecondary }]}>
        Store Logo
      </Text>
      <LogoPicker
        businessName={businessName}
        cachedLogoUri={cachedLogoUri}
        fallbackLogoUri={fallbackLogoUri}
        merchantId={merchantId}
        onStatusChange={onStatusChange}
        onUploadSuccess={onUploadSuccess}
      />
    </View>
  );
}
