import Ionicons from "@react-native-vector-icons/ionicons/static";
import React from 'react';
import { Text, View } from 'react-native';
import { palette } from '@/constants/Colors';
import { styles } from '../styles';

export function SecurityFooter() {
  return (
    <View
      style={styles.footer}
      accessible={true}
      accessibilityRole="text"
      accessibilityLabel="Security notice: Your security is our priority. All transactions are encrypted."
    >
      <Ionicons
        name="lock-closed"
        size={12}
        color={palette.gray[400]}
        accessibilityElementsHidden={true}
        importantForAccessibility="no"
      />
      <Text style={styles.footerText}>
        Your security is our priority. All transactions are encrypted.
      </Text>
    </View>
  );
}
