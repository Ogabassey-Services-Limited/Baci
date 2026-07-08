import { StyleSheet } from 'react-native';
import { RADIUS, SPACING } from '@/constants/Colors';

export const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  backBtn: {
    padding: SPACING.sm,
  },
  scrollView: {
    flex: 1,
  },
  formContainer: {
    padding: SPACING.md,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 20,
  },
  inputGroup: {
    marginBottom: SPACING.md,
  },
  label: {
    fontSize: 13,
    fontWeight: '500',
    marginBottom: SPACING.sm,
  },
  input: {
    borderWidth: 1,
    borderRadius: RADIUS.xl,
    paddingHorizontal: SPACING.md,
    paddingVertical: 14,
    fontSize: 15,
  },
  errorText: {
    fontSize: 12,
    marginTop: SPACING.xs,
  },
  emailLabel: {
    fontSize: 13,
    fontWeight: '500',
    marginBottom: SPACING.sm,
    marginTop: SPACING.sm,
  },
  emailContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: RADIUS.xl,
    paddingHorizontal: SPACING.md,
    paddingVertical: 14,
  },
  emailText: {
    fontSize: 15,
  },
  emailHint: {
    fontSize: 12,
    marginTop: SPACING.xs,
  },
  usernamePromptSpacing: {
    marginTop: SPACING.md,
  },
  bottomAction: {
    padding: SPACING.md,
    borderTopWidth: 1,
  },
  saveButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.xl,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '700',
  },
});
