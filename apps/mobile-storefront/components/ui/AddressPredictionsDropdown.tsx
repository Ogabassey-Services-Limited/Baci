import Ionicons from '@react-native-vector-icons/ionicons';
import { Pressable, ScrollView, Text, View } from 'react-native';
import type Colors from '@/constants/Colors';
import { BRAND } from '@/constants/Colors';
import { addressAutocompleteStyles as styles } from './AddressAutocomplete.styles';
import type { PlacePrediction } from './AddressAutocomplete.types';

type ColorsScheme = (typeof Colors)['light'];

interface AddressPredictionsDropdownProps {
  colors: ColorsScheme;
  isDark: boolean;
  onInteractEnd?: () => void;
  onInteractStart?: () => void;
  onSelectPrediction: (prediction: PlacePrediction) => void;
  predictions: PlacePrediction[];
}

export function AddressPredictionsDropdown({
  colors,
  isDark,
  onInteractEnd,
  onInteractStart,
  onSelectPrediction,
  predictions,
}: AddressPredictionsDropdownProps) {
  return (
    <View
      style={[
        styles.dropdown,
        {
          backgroundColor: colors.card,
          borderColor: isDark ? 'rgba(255,255,255,0.08)' : colors.border,
        },
      ]}
      accessibilityLabel="Address suggestions"
      accessibilityRole="list"
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        nestedScrollEnabled
        onMomentumScrollEnd={onInteractEnd}
        onScrollEndDrag={onInteractEnd}
        onTouchCancel={onInteractEnd}
        onTouchEnd={onInteractEnd}
        onTouchStart={onInteractStart}
        showsVerticalScrollIndicator={false}
      >
        {predictions.map((item) => (
          <Pressable
            key={item.placeId}
            style={({ pressed }: { pressed: boolean }) => [
              styles.predictionItem,
              {
                borderBottomColor: isDark
                  ? 'rgba(255,255,255,0.05)'
                  : colors.border,
              },
              pressed && {
                backgroundColor: isDark
                  ? 'rgba(255,255,255,0.04)'
                  : colors.muted,
              },
            ]}
            onPress={() => onSelectPrediction(item)}
            accessibilityRole="button"
            accessibilityLabel={`${item.mainText}, ${item.secondaryText}`}
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
                  {item.mainText}
                </Text>
                <Text
                  style={[
                    styles.predictionSecondary,
                    { color: colors.textSecondary },
                  ]}
                  numberOfLines={1}
                >
                  {item.secondaryText}
                </Text>
              </View>
            </View>
          </Pressable>
        ))}
        <View
          style={[
            styles.footer,
            {
              backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : colors.muted,
            },
          ]}
        >
          <Text style={[styles.footerText, { color: colors.textSecondary }]}>
            Powered by{' '}
          </Text>
          <Text style={[styles.footerText, { color: '#4285F4' }]}>G</Text>
          <Text style={[styles.footerText, { color: '#EA4335' }]}>o</Text>
          <Text style={[styles.footerText, { color: '#FBBC05' }]}>o</Text>
          <Text style={[styles.footerText, { color: '#4285F4' }]}>g</Text>
          <Text style={[styles.footerText, { color: '#34A853' }]}>l</Text>
          <Text style={[styles.footerText, { color: '#EA4335' }]}>e</Text>
        </View>
      </ScrollView>
    </View>
  );
}
