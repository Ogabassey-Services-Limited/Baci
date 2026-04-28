import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import airtelImage from '@/assets/images/airtel.png';
import gloImage from '@/assets/images/glo.jpg';
import mtnImage from '@/assets/images/mtn.jpeg';
import t2Image from '@/assets/images/t2.png';
import { useColorScheme } from '@/components/useColorScheme';
import Colors, { BRAND } from '@/constants/Colors';

const PROVIDERS = [
  { id: 'mtn', name: 'MTN', color: '#FFCC00', image: mtnImage },
  { id: 'airtel', name: 'Airtel', color: '#FF0000', image: airtelImage },
  { id: 'glo', name: 'Glo', color: '#00FF00', image: gloImage },
  { id: 't2', name: 'T2 (9mobile)', color: '#006400', image: t2Image },
];

interface ProviderGridProps {
  selectedProvider: string | null;
  onSelect: (id: string) => void;
}

export function ProviderGrid({
  selectedProvider,
  onSelect,
}: ProviderGridProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  return (
    <View style={styles.grid}>
      {PROVIDERS.map((provider) => (
        <Pressable
          key={provider.id}
          style={[
            styles.card,
            {
              backgroundColor: colors.card,
              borderColor:
                selectedProvider === provider.id
                  ? BRAND.primary
                  : colors.border,
              borderWidth: selectedProvider === provider.id ? 2 : 1,
            },
          ]}
          onPress={() => onSelect(provider.id)}
        >
          <Image
            source={provider.image}
            style={styles.logo}
            resizeMode="contain"
          />
          <Text style={[styles.name, { color: colors.text }]}>
            {provider.name}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  card: {
    width: '48%',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  logo: {
    width: 60,
    height: 40,
    marginBottom: 8,
  },
  name: {
    fontWeight: '500',
  },
});
