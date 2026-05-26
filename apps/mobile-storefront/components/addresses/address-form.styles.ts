import { StyleSheet } from 'react-native';
import { RADIUS, SPACING } from '@/constants/Colors';

const CONTENT_BOTTOM_PADDING = 100;
const FORM_SECTION_MARGIN_BOTTOM = 20;
const INPUT_HORIZONTAL_PADDING = 14;
const INPUT_VERTICAL_PADDING = 12;
const TEXT_AREA_HEIGHT = 80;
const STATE_CHIP_HORIZONTAL_PADDING = 14;
const STATE_CHIP_RADIUS = 20;

export const addressFormStyles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    padding: SPACING.md,
    paddingBottom: CONTENT_BOTTOM_PADDING,
  },
  section: {
    marginBottom: FORM_SECTION_MARGIN_BOTTOM,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: SPACING.sm,
  },
  labelOptions: {
    flexDirection: 'row',
    gap: SPACING.sm + SPACING.xs,
  },
  labelOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm - 2,
    paddingVertical: INPUT_VERTICAL_PADDING,
    borderRadius: RADIUS.md,
    borderWidth: 1,
  },
  labelOptionText: {
    fontSize: 14,
    fontWeight: '500',
  },
  input: {
    borderWidth: 1,
    borderRadius: RADIUS.md,
    paddingHorizontal: INPUT_HORIZONTAL_PADDING,
    paddingVertical: INPUT_VERTICAL_PADDING,
    fontSize: 15,
  },
  textArea: {
    height: TEXT_AREA_HEIGHT,
    textAlignVertical: 'top',
  },
  errorText: {
    fontSize: 12,
    marginTop: SPACING.xs,
  },
  statesContainer: {
    gap: SPACING.sm,
    paddingVertical: SPACING.xs,
  },
  stateChip: {
    paddingHorizontal: STATE_CHIP_HORIZONTAL_PADDING,
    paddingVertical: SPACING.sm,
    borderRadius: STATE_CHIP_RADIUS,
    borderWidth: 1,
    marginRight: SPACING.sm,
  },
  stateChipText: {
    fontSize: 13,
    fontWeight: '500',
  },
  defaultToggle: {
    borderRadius: RADIUS.xl,
    padding: SPACING.md,
    marginTop: SPACING.sm,
  },
  defaultToggleContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm + SPACING.xs,
  },
  defaultToggleText: {
    fontSize: 15,
    fontWeight: '500',
  },
  defaultToggleHint: {
    fontSize: 13,
    marginTop: 2,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: SPACING.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  saveButton: {
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
