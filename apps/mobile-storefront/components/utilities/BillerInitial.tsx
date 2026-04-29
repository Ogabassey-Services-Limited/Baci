import { StyleSheet, Text, View } from 'react-native';

interface BillerInitialProps {
  colors: { border: string; textSecondary: string };
  name: string;
}

export function BillerInitial({ colors, name }: BillerInitialProps) {
  return (
    <View style={[styles.initialsCircle, { backgroundColor: colors.border }]}>
      <Text style={[styles.initialsText, { color: colors.textSecondary }]}>
        {name.charAt(0).toUpperCase()}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  initialsCircle: {
    alignItems: 'center',
    borderRadius: 24,
    height: 48,
    justifyContent: 'center',
    marginBottom: 8,
    width: 48,
  },
  initialsText: {
    fontSize: 20,
    fontWeight: '700',
  },
});
