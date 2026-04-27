import { StyleSheet } from 'react-native';
import { RADIUS, SHADOWS, SPACING } from '@/constants/Colors';

const SETTINGS_ICON_SIZE = 36;
const SETTINGS_ICON_RADIUS = RADIUS.xl;
const SETTINGS_ROW_SUBTITLE_MARGIN_TOP = 2;

export const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scroll: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.xl,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.5,
    marginTop: SPACING.lg,
    marginBottom: SPACING.sm,
    marginLeft: SPACING.xs,
  },
  card: {
    borderRadius: RADIUS['2xl'],
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    ...SHADOWS.sm,
  },
  segmentedControl: {
    flexDirection: 'row',
    padding: SPACING.xs,
    gap: SPACING.xs,
  },
  segmentOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.sm + SPACING.xs,
    borderRadius: RADIUS.xl,
  },
  segmentLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.md,
  },
  rowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowPressed: {
    opacity: 0.7,
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    flex: 1,
  },
  rowLabel: {
    fontSize: 15,
    fontWeight: '500',
  },
  rowSub: {
    fontSize: 12,
    marginTop: SETTINGS_ROW_SUBTITLE_MARGIN_TOP,
  },
  rowValue: {
    fontSize: 14,
    fontWeight: '500',
  },
  iconCircle: {
    width: SETTINGS_ICON_SIZE,
    height: SETTINGS_ICON_SIZE,
    borderRadius: SETTINGS_ICON_RADIUS,
    justifyContent: 'center',
    alignItems: 'center',
  },
  footer: {
    textAlign: 'center',
    fontSize: 10,
    letterSpacing: 2,
    fontWeight: '700',
    opacity: 0.4,
    paddingBottom: SPACING.sm,
  },
});
