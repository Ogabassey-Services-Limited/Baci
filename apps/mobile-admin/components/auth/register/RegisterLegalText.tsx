import { Linking, Text } from 'react-native';
import { registerStyles as styles } from './register.styles';

interface RegisterLegalTextProps {
  linkColor?: string;
  prefixText: string;
  textColor?: string;
}

export function RegisterLegalText({
  linkColor,
  prefixText,
  textColor,
}: RegisterLegalTextProps) {
  return (
    <Text style={[styles.termsText, textColor ? { color: textColor } : null]}>
      {prefixText}{' '}
      <Text
        style={[styles.termsLink, linkColor ? { color: linkColor } : null]}
        onPress={() => Linking.openURL('https://usebaci.com/terms')}
      >
        Terms of Service
      </Text>{' '}
      and{' '}
      <Text
        style={[styles.termsLink, linkColor ? { color: linkColor } : null]}
        onPress={() => Linking.openURL('https://usebaci.com/privacy')}
      >
        Privacy Policy
      </Text>
    </Text>
  );
}
