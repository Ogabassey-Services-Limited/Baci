import { router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import type Colors from '@/constants/Colors';
import { BRAND } from '@/constants/Colors';
import { trackOrderScreenStyles as styles } from './TrackOrderScreen.styles';

type ColorsScheme = (typeof Colors)['light'];

interface TrackOrderBottomActionProps {
  colors: ColorsScheme;
}

export function TrackOrderBottomAction({ colors }: TrackOrderBottomActionProps) {
  return (
    <View
      style={[
        styles.bottomAction,
        { backgroundColor: colors.card, borderTopColor: colors.border },
      ]}
    >
      <Pressable
        style={({ pressed }) => [
          styles.homeBtn,
          { backgroundColor: BRAND.primary },
          pressed && { opacity: 0.8 },
        ]}
        onPress={() => router.replace('/')}
        accessibilityRole="button"
        accessibilityLabel="Continue shopping"
      >
        <Text style={styles.homeBtnText}>Continue Shopping</Text>
      </Pressable>
    </View>
  );
}
