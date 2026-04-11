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
import type { CacCompany, SelectedCacDocument } from './cac-types';

interface CacUploadStepProps {
  company: CacCompany;
  document: SelectedCacDocument | null;
  onBack: () => void;
  onPickDocument: () => void;
  onVerify: () => void;
  isUploading: boolean;
}

export default function CacUploadStep({
  company,
  document,
  onBack,
  onPickDocument,
  onVerify,
  isUploading,
}: CacUploadStepProps) {
  const { colors } = useTheme();
  const isPdf = document?.mimeType === 'application/pdf';

  return (
    <>
      <View style={[styles.summaryCard, { backgroundColor: colors.inputBg }]}>
        <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>
          Company Name
        </Text>
        <Text style={[styles.summaryValue, { color: colors.text }]}>
          {company.approvedName}
        </Text>

        <Text
          style={[
            styles.summaryLabel,
            { color: colors.textSecondary, marginTop: SPACING.sm },
          ]}
        >
          Registration Status
        </Text>
        <Text style={[styles.summaryValue, { color: colors.text }]}>
          {company.status}
        </Text>
      </View>

      {document ? (
        <View style={styles.previewContainer}>
          {isPdf ? (
            <View
              style={[
                styles.fileCard,
                {
                  backgroundColor: colors.inputBg,
                  borderColor: colors.border,
                },
              ]}
            >
              <Ionicons
                name="document-text-outline"
                size={32}
                color={colors.primary}
              />
              <Text style={[styles.fileName, { color: colors.text }]}>
                {document.name}
              </Text>
              <Text style={[styles.fileMeta, { color: colors.textSecondary }]}>
                PDF selected and ready for upload
              </Text>
            </View>
          ) : (
            <Image
              source={{ uri: document.uri }}
              style={styles.previewImage}
              resizeMode="contain"
              accessibilityLabel="Preview of selected CAC certificate"
            />
          )}
          <Pressable
            style={styles.changeButton}
            onPress={onPickDocument}
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
          onPress={onPickDocument}
          accessibilityRole="button"
          accessibilityLabel="Select CAC certificate file"
        >
          <Ionicons
            name="document-attach-outline"
            size={24}
            color={colors.textSecondary}
          />
          <Text style={[styles.pickText, { color: colors.textSecondary }]}>
            Choose Certificate Source
          </Text>
          <Text style={[styles.pickHint, { color: colors.textMuted }]}>
            Pick from your gallery or choose an image/PDF file for{' '}
            {company.approvedName}.
          </Text>
        </Pressable>
      )}
      <View style={styles.buttonRow}>
        <Pressable
          style={({ pressed }) => [
            styles.secondaryButton,
            { borderColor: colors.border },
            pressed && styles.pressed,
          ]}
          onPress={onBack}
          accessibilityRole="button"
          accessibilityLabel="Go back to CAC search"
        >
          <Text style={[styles.secondaryButtonText, { color: colors.text }]}>
            Back
          </Text>
        </Pressable>
        <Pressable
          style={[
            styles.button,
            {
              backgroundColor: colors.primary,
              opacity: document && !isUploading ? 1 : 0.5,
            },
          ]}
          onPress={onVerify}
          disabled={!document || isUploading}
          accessibilityRole="button"
          accessibilityState={{ disabled: !document || isUploading }}
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
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  summaryCard: {
    borderRadius: RADIUS.sm,
    padding: SPACING.md,
    marginBottom: SPACING.md,
  },
  summaryLabel: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.size.sm,
  },
  summaryValue: {
    fontFamily: TYPOGRAPHY.fontFamily.semiBold,
    fontSize: TYPOGRAPHY.size.md,
    marginTop: SPACING.xs,
  },
  pickButton: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: RADIUS.sm,
    paddingVertical: SPACING['2xl'],
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    minHeight: 44,
  },
  pickText: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.size.md,
  },
  pickHint: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.size.sm,
    textAlign: 'center',
    paddingHorizontal: SPACING.md,
  },
  previewContainer: { alignItems: 'center', gap: SPACING.sm },
  previewImage: {
    width: '100%',
    height: 200,
    borderRadius: RADIUS.sm,
  },
  fileCard: {
    width: '100%',
    borderWidth: 1,
    borderRadius: RADIUS.sm,
    padding: SPACING.lg,
    alignItems: 'center',
    gap: SPACING.sm,
  },
  fileName: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.size.md,
    textAlign: 'center',
  },
  fileMeta: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.size.sm,
    textAlign: 'center',
  },
  changeButton: {
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  changeText: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.size.md,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.md,
  },
  secondaryButton: {
    borderWidth: 1,
    borderRadius: RADIUS.sm,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.size.md,
  },
  button: {
    flex: 1,
    borderRadius: RADIUS.sm,
    paddingVertical: SPACING.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    fontFamily: TYPOGRAPHY.fontFamily.semiBold,
    fontSize: TYPOGRAPHY.size.md,
  },
  pressed: {
    opacity: 0.7,
  },
});
