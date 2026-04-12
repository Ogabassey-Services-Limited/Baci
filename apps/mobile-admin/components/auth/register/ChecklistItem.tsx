import { Ionicons } from '@expo/vector-icons';
import { Text, View } from 'react-native';
import { registerStyles as styles } from './register.styles';

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
  const iconName = isValid
    ? 'checkmark-circle'
    : isError
      ? 'alert-circle-outline'
      : 'ellipse-outline';
  const iconColor = isValid ? '#10B981' : isError ? '#EF4444' : '#9CA3AF';
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
