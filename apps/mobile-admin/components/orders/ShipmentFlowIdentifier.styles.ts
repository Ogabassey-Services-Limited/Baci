import { StyleSheet } from 'react-native';
import { COLORS, RADIUS, SPACING, TYPOGRAPHY } from '@/constants/theme';

const INPUT_HEIGHT = 56;
const SCANNER_FRAME_SIZE = 240;

export const identifierStyles = StyleSheet.create({
  inputRow: {
    alignItems: 'center',
    flexDirection: 'row',
    minHeight: INPUT_HEIGHT,
  },
  input: {
    flex: 1,
    fontSize: TYPOGRAPHY.size.md,
    minHeight: INPUT_HEIGHT,
    minWidth: 0,
    paddingHorizontal: SPACING.md,
  },
  scanButton: {
    alignItems: 'center',
    borderRadius: RADIUS.md,
    borderWidth: 1,
    gap: 1,
    height: 44,
    justifyContent: 'center',
    marginRight: 8,
    width: 44,
  },
  scanButtonText: {
    fontSize: 9,
    fontWeight: '700',
    lineHeight: 10,
  },
  scannerOverlay: {
    ...StyleSheet.absoluteFill,
    zIndex: 30,
  },
  scannerCamera: {
    flex: 1,
  },
  scannerShade: {
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.45)',
    flex: 1,
    justifyContent: 'center',
    padding: SPACING.lg,
  },
  scannerFrame: {
    borderColor: COLORS.primary,
    borderRadius: RADIUS.xl,
    borderWidth: 3,
    height: SCANNER_FRAME_SIZE,
    width: SCANNER_FRAME_SIZE,
  },
  scannerText: {
    color: COLORS.textOnPrimary,
    fontSize: TYPOGRAPHY.size.md,
    fontWeight: '700',
    marginTop: SPACING.lg,
  },
  scannerFallback: {
    alignItems: 'center',
    flex: 1,
    gap: SPACING.md,
    justifyContent: 'center',
    padding: SPACING.xl,
  },
  scannerMessage: {
    fontSize: TYPOGRAPHY.size.md,
    fontWeight: '600',
    textAlign: 'center',
  },
  scannerClose: {
    alignItems: 'center',
    borderRadius: RADIUS.full,
    height: 48,
    justifyContent: 'center',
    position: 'absolute',
    right: SPACING.lg,
    top: SPACING.xl,
    width: 48,
  },
});
