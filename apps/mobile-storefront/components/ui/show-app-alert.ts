import { Alert } from 'react-native';
import { type HapticType, triggerHaptic } from '@/hooks/use-haptics';

type AppAlertVariant = 'error' | 'info' | 'success' | 'warning';

type ShowAppAlertOptions = {
  message: string;
  title: string;
  variant?: AppAlertVariant;
};

const HAPTIC_BY_VARIANT: Record<AppAlertVariant, HapticType | null> = {
  error: 'error',
  info: null,
  success: 'success',
  warning: 'warning',
};

export function showAppAlert({
  message,
  title,
  variant = 'info',
}: ShowAppAlertOptions) {
  const hapticType = HAPTIC_BY_VARIANT[variant];
  if (hapticType) {
    triggerHaptic(hapticType);
  }
  Alert.alert(title, message);
}
