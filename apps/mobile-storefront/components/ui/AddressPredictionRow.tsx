import Ionicons from '@react-native-vector-icons/ionicons';
import { Pressable, Text, View } from 'react-native';
import type Colors from '@/constants/Colors';
import { BRAND } from '@/constants/Colors';
import { addressAutocompleteStyles as styles } from './AddressAutocomplete.styles';
import type { PlacePrediction } from './AddressAutocomplete.types';

type ColorsScheme = (typeof Colors)['light'];

interface AddressPredictionRowProps {
  colors: ColorsScheme;
  isDark: boolean;
  onSelect: (prediction: PlacePrediction) => void;
  prediction: PlacePrediction;
}

export function AddressPredictionRow({
  colors,
  isDark,
  onSelect,
  prediction,
}: AddressPredictionRowProps) {
  return (
    <Pressable
      style={({ pressed }: { pressed: boolean }) => [
        styles.predictionItem,
        {
          borderBottomColor: isDark ? 'rgba(255,255,255,0.05)' : colors.border,
        },
        pressed && {
          backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : colors.muted,
        },
      ]}
      onPress={() => onSelect(prediction)}
      accessibilityRole="button"
      accessibilityLabel={`${prediction.mainText}, ${prediction.secondaryText}`}
    >
      <View style={styles.predictionRow}>
        <View
          style={[
            styles.predictionPinRail,
            {
              backgroundColor: isDark
                ? 'rgba(217, 59, 48, 0.14)'
                : `${BRAND.primary}12`,
            },
          ]}
        >
          <Ionicons
            name="location"
            size={18}
            color={BRAND.primary}
            style={styles.predictionPin}
          />
        </View>
        <View style={styles.predictionText}>
          <Text
            style={[styles.predictionMain, { color: colors.text }]}
            numberOfLines={1}
          >
            {prediction.mainText}
          </Text>
          <Text
            style={[
              styles.predictionSecondary,
              { color: colors.textSecondary },
            ]}
            numberOfLines={1}
          >
            {prediction.secondaryText}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}
