import { Ionicons } from '@expo/vector-icons';
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { RADIUS, SPACING, TYPOGRAPHY } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';

interface CacUploadStepProps {
  imageUri: string | null;
  onPickImage: () => void;
  onVerify: () => void;
  isUploading: boolean;
}

export default function CacUploadStep({
  imageUri,
  onPickImage,
  onVerify,
  isUploading,
}: CacUploadStepProps) {
  const { colors } = useTheme();

  return (
    <>
      {imageUri ? (
        <View style={styles.previewContainer}>
          <Image
            source={{ uri: imageUri }}
            style={styles.previewImage}
            resizeMode="contain"
            accessibilityLabel="Preview of selected CAC certificate"
          />
          <Pressable
            onPress={onPickImage}
            accessibilityRole="button"
            accessibilityLabel="Change uploaded CAC document"
          >
            <Text style={[styles.changeText, { color: colors.primary }]}>
              Change
            </Text>
          </Pressable>
        </View>
      ) : (
        <Pressable
          style={[styles.pickButton, { borderColor: colors.border }]}
          onPress={onPickImage}
          accessibilityRole="button"
          accessibilityLabel="Select CAC certificate image"
        >
          <Ionicons
            name="image-outline"
            size={24}
            color={colors.textSecondary}
          />
          <Text style={[styles.pickText, { color: colors.textSecondary }]}>
            Select Certificate Image
          </Text>
        </Pressable>
      )}
      <Pressable
        style={[
          styles.button,
          {
            backgroundColor: colors.primary,
            opacity: imageUri && !isUploading ? 1 : 0.5,
          },
        ]}
        onPress={onVerify}
        disabled={!imageUri || isUploading}
        accessibilityRole="button"
        accessibilityState={{ disabled: !imageUri || isUploading }}
        accessibilityLabel={
          isUploading ? 'Verifying certificate' : 'Verify Certificate'
        }
      >
        {isUploading ? (
          <ActivityIndicator size="small" color={colors.textOnPrimary} />
        ) : (
          <Text style={[styles.buttonText, { color: colors.textOnPrimary }]}>
            Verify Certificate
          </Text>
        )}
      </Pressable>
    </>
  );
}

const styles = StyleSheet.create({
  pickButton: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: RADIUS.sm,
    paddingVertical: SPACING['2xl'],
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
  },
  pickText: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.size.md,
  },
  previewContainer: { alignItems: 'center', gap: SPACING.sm },
  previewImage: {
    width: '100%',
    height: 200,
    borderRadius: RADIUS.sm,
  },
  changeText: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.size.md,
  },
  button: {
    borderRadius: RADIUS.sm,
    paddingVertical: SPACING.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    fontFamily: TYPOGRAPHY.fontFamily.semiBold,
    fontSize: TYPOGRAPHY.size.md,
  },
});
