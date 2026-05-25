import { StyleSheet } from 'react-native';
import {
  palette,
  RADIUS,
  SHADOWS,
  SPACING,
  withAlpha,
} from '@/constants/Colors';

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: withAlpha(palette.black, 0.5),
    justifyContent: 'center',
    padding: SPACING.md,
  },
  sheet: {
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
    ...SHADOWS.medium,
  },
  header: {
    padding: SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  headerTitle: {
    color: palette.white,
    fontSize: 18,
    fontWeight: '600',
  },
  closeBtn: {
    padding: 4,
  },
  content: {
    padding: SPACING.lg,
  },
  sectionLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: SPACING.sm,
  },
  optionsRow: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  optionCard: {
    flex: 1,
    borderWidth: 1.5,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
  },
  optionSubtitle: {
    fontSize: 12,
  },
  networkContainer: {
    position: 'relative',
  },
  networkScroll: {
    gap: SPACING.sm,
    paddingRight: SPACING.lg,
  },
  networkCard: {
    width: 100,
    borderWidth: 1.5,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  networkTime: {
    fontSize: 10,
    marginTop: 2,
  },
  scrollHint: {
    pointerEvents: 'none',
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: 28,
    justifyContent: 'center',
    alignItems: 'center',
    opacity: 0.7,
  },
  infoBox: {
    marginTop: SPACING.lg,
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    gap: SPACING.sm,
  },
  infoTextContainer: {
    flex: 1,
  },
  infoTitle: {
    fontWeight: '600',
    fontSize: 14,
  },
  infoSubtitle: {
    fontSize: 12,
  },
  confirmBtn: {
    marginTop: SPACING.xl,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmBtnText: {
    color: palette.white,
    fontSize: 16,
    fontWeight: '700',
  },
  helperText: {
    marginTop: SPACING.md,
    textAlign: 'center',
    fontSize: 12,
  },
});

export default styles;
