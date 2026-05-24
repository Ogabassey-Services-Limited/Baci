import Ionicons from "@react-native-vector-icons/ionicons/static";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import SafeImage from '@/components/ui/SafeImage';
import type { ThemeColors } from '@/constants/theme';

interface ProductImageCardProps {
  colors: ThemeColors;
  imageUrl?: string;
  isUploading: boolean;
  onPress: () => void;
}

export function ProductImageCard({
  colors,
  imageUrl,
  isUploading,
  onPress,
}: ProductImageCardProps) {
  return (
    <Pressable
      style={[
        styles.container,
        { backgroundColor: colors.card, borderColor: colors.border },
      ]}
      onPress={onPress}
      disabled={isUploading}
      accessibilityRole="button"
      accessibilityLabel="Product image"
      accessibilityHint="Double tap to upload or change product image"
    >
      {isUploading ? (
        <View style={[styles.placeholder, { backgroundColor: colors.inputBg }]}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : imageUrl ? (
        <View>
          <SafeImage
            source={{ uri: imageUrl }}
            style={styles.image}
            contentFit="cover"
            transition={200}
          />
          <View style={styles.overlay}>
            <Ionicons name="camera" size={24} color={colors.textOnPrimary} />
            <Text style={[styles.overlayText, { color: colors.textOnPrimary }]}>
              Change Image
            </Text>
          </View>
        </View>
      ) : (
        <View style={[styles.placeholder, { backgroundColor: colors.inputBg }]}>
          <Ionicons
            name="image-outline"
            size={48}
            color={colors.textSecondary}
          />
          <Text
            style={[styles.placeholderText, { color: colors.textSecondary }]}
          >
            Tap to upload image
          </Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  image: {
    height: 200,
    width: '100%',
  },
  overlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
    gap: 8,
    justifyContent: 'center',
  },
  overlayText: {
    fontSize: 14,
    fontWeight: '600',
  },
  placeholder: {
    alignItems: 'center',
    gap: 8,
    height: 200,
    justifyContent: 'center',
  },
  placeholderText: {
    fontSize: 14,
    fontWeight: '500',
  },
});
