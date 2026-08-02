import Ionicons, {
  type IoniconsIconName,
} from '@react-native-vector-icons/ionicons';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { useTheme } from '@/hooks/useTheme';
import { getMerchantSetupStyles } from './merchant-setup.styles';

interface MerchantSetupActionButtonProps {
  accessibilityLabel?: string;
  icon: IoniconsIconName;
  isLoading?: boolean;
  label: string;
  loadingLabel?: string;
  onPress: () => void;
}

export function MerchantSetupActionButton({
  accessibilityLabel,
  icon,
  isLoading = false,
  label,
  loadingLabel = label,
  onPress,
}: MerchantSetupActionButtonProps) {
  const { colors } = useTheme();
  const styles = getMerchantSetupStyles(colors);

  return (
    <View
      style={[styles.actionSurface, isLoading && styles.actionSurfaceDisabled]}
    >
      <Pressable
        accessibilityLabel={
          isLoading ? loadingLabel : (accessibilityLabel ?? label)
        }
        accessibilityRole="button"
        accessibilityState={{ busy: isLoading, disabled: isLoading }}
        disabled={isLoading}
        onPress={onPress}
        style={styles.actionPressable}
      >
        {isLoading ? (
          <ActivityIndicator color={colors.textOnPrimary} />
        ) : (
          <>
            <Text style={styles.actionText}>{label}</Text>
            <View style={styles.actionIcon}>
              <Ionicons color={colors.textOnPrimary} name={icon} size={18} />
            </View>
          </>
        )}
      </Pressable>
    </View>
  );
}
