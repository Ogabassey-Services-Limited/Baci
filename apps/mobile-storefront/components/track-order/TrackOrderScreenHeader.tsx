import Ionicons from '@react-native-vector-icons/ionicons';
import { router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import type Colors from '@/constants/Colors';
import { trackOrderScreenStyles as styles } from './TrackOrderScreen.styles';

type ColorsScheme = (typeof Colors)['light'];

interface TrackOrderScreenHeaderProps {
  colors: ColorsScheme;
}

export function TrackOrderScreenHeader({
  colors,
}: TrackOrderScreenHeaderProps) {
  return (
    <View style={[styles.header, { borderBottomColor: colors.border }]}>
      <Pressable
        onPress={() => router.back()}
        style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.7 }]}
        accessibilityRole="button"
        accessibilityLabel="Go back"
        hitSlop={12}
      >
        <Ionicons name="arrow-back" size={22} color={colors.text} />
      </Pressable>
      <Text style={[styles.headerTitle, { color: colors.text }]}>
        Order Details
      </Text>
      <View style={styles.headerSpacer} />
    </View>
  );
}
