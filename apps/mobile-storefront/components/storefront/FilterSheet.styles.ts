import { StyleSheet } from 'react-native';
import {
  BRAND,
  palette,
  RADIUS,
  SPACING,
  TYPOGRAPHY,
} from '@/constants/Colors';

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'transparent',
    justifyContent: 'flex-end',
  },
  keyboardAvoidingView: {
    width: '100%',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: 'transparent',
    borderTopLeftRadius: RADIUS['2xl'],
    borderTopRightRadius: RADIUS['2xl'],
    paddingTop: SPACING.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    marginBottom: SPACING.lg,
  },
  title: {
    fontSize: TYPOGRAPHY.size.xl,
    fontFamily: 'Inter_700Bold',
    color: 'transparent',
  },
  closeButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: RADIUS.full,
    backgroundColor: 'transparent',
  },
  content: {
    paddingHorizontal: SPACING.lg,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: SPACING.sm,
    marginBottom: SPACING.lg,
  },
  inputContainer: {
    flex: 1,
  },
  label: {
    fontSize: TYPOGRAPHY.size.sm,
    fontFamily: 'Inter_600SemiBold',
    color: 'transparent',
    marginBottom: SPACING.xs,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'transparent',
    borderRadius: RADIUS.lg,
    paddingHorizontal: SPACING.md,
    height: 50,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  currency: {
    fontSize: TYPOGRAPHY.size.base,
    fontFamily: 'Inter_600SemiBold',
    color: 'transparent',
    marginRight: SPACING.xs,
  },
  input: {
    flex: 1,
    fontSize: TYPOGRAPHY.size.base,
    fontFamily: 'Inter_600SemiBold',
    color: 'transparent',
  },
  separator: {
    fontSize: TYPOGRAPHY.size.lg,
    color: 'transparent',
    marginBottom: 12,
  },
  presets: {
    marginBottom: SPACING.lg,
  },
  presetsLabel: {
    fontSize: TYPOGRAPHY.size.sm,
    fontFamily: 'Inter_600SemiBold',
    color: 'transparent',
    marginBottom: SPACING.sm,
  },
  presetButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  presetButton: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    minHeight: 44,
    justifyContent: 'center',
    backgroundColor: 'transparent',
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  presetText: {
    fontSize: TYPOGRAPHY.size.xs,
    fontFamily: 'Inter_600SemiBold',
    color: 'transparent',
  },
  actions: {
    flexDirection: 'row',
    gap: SPACING.md,
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.lg,
  },
  resetButton: {
    flex: 1,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: RADIUS.lg,
    borderWidth: 1.5,
    borderColor: BRAND.primary,
  },
  resetText: {
    fontSize: TYPOGRAPHY.size.base,
    fontFamily: 'Inter_700Bold',
    color: BRAND.primary,
  },
  applyButton: {
    flex: 1,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: RADIUS.lg,
    backgroundColor: BRAND.primary,
  },
  applyText: {
    fontSize: TYPOGRAPHY.size.base,
    fontFamily: 'Inter_700Bold',
    color: palette.white,
  },
});

export default styles;
