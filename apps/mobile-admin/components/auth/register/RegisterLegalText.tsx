import { Linking, Text } from 'react-native';
import { registerStyles as styles } from './register.styles';

interface RegisterLegalTextProps {
  prefixText: string;
}

export function RegisterLegalText({ prefixText }: RegisterLegalTextProps) {
  return (
    <Text style={styles.termsText}>
      {prefixText}{' '}
      <Text
        style={styles.termsLink}
        onPress={() => Linking.openURL('https://usebaci.com/terms')}
      >
        Terms of Service
      </Text>{' '}
      and{' '}
      <Text
        style={styles.termsLink}
        onPress={() => Linking.openURL('https://usebaci.com/privacy')}
      >
        Privacy Policy
      </Text>
    </Text>
  );
}
