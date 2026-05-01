import { Ionicons } from '@expo/vector-icons';
import { Text, View } from 'react-native';
import { useTheme } from '@/hooks/useTheme';
import { getStyles } from './register.styles';

interface ChecklistItemProps {
  isError?: boolean;
  isValid: boolean;
  text: string;
}

export function ChecklistItem({
  isError = false,
  isValid,
  text,
}: ChecklistItemProps) {
  const { colors } = useTheme();
  const styles = getStyles(colors);
  const iconName = isValid
    ? 'checkmark-circle'
    : isError
      ? 'alert-circle-outline'
      : 'ellipse-outline';
  const iconColor = isValid
    ? colors.success
    : isError
      ? colors.error
      : colors.textSecondary;
  const textStyle = isValid
    ? styles.checkTextValid
    : isError
      ? styles.checkTextError
      : styles.checkText;

  return (
    <View style={styles.checkItem}>
      <Ionicons name={iconName} size={14} color={iconColor} />
      <Text style={textStyle}>{text}</Text>
    </View>
  );
}
