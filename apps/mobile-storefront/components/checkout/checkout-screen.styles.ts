import { StyleSheet } from "react-native";
import { BRAND, palette, RADIUS, SHADOWS, SPACING } from "@/constants/Colors";
import { checkoutCryptoPaymentStyles } from "./checkout-crypto-payment.styles";

const checkoutScreenStyles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentShell: {
    flex: 1,
  },
  screenHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: SPACING.md,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  backBtn: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  screenHeaderTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: "700",
    textAlign: "center",
  },
  screenHeaderSpacer: {
    width: 40,
  },
  formContainer: {
    flex: 1,
    paddingHorizontal: SPACING.md,
  },
  formContent: {
    paddingBottom: 116,
  },
  sectionHeader: {
    marginBottom: SPACING.md,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "700",
  },
  sectionSubtitle: {
    fontSize: 13,
    marginTop: 6,
  },
  helperText: {
    fontSize: 12,
  },
  bottomAction: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 80,
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
    ...SHADOWS.lg,
  },
  bottomBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  bottomSummary: {
    minWidth: 120,
  },
  bottomLabel: {
    fontSize: 11,
    color: palette.gray[500],
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  bottomValue: {
    fontSize: 18,
    fontWeight: "800",
    color: palette.gray[900],
  },
  bottomSubtle: {
    fontSize: 12,
    marginTop: 2,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 16,
    borderRadius: RADIUS.xl,
    flex: 1,
  },
  actionButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
  processingContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  pickerOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
  },
  pickerSheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 16,
    maxHeight: "70%",
  },
  pickerHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  pickerTitle: {
    fontSize: 16,
    fontWeight: "700",
  },
  pickerItem: {
    minHeight: 48,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
    borderRadius: 12,
    justifyContent: "center",
  },
  pickerItemContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  pickerItemText: {
    fontSize: 14,
  },
  citySearchContainer: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  citySearchInput: {
    flex: 1,
    fontSize: 14,
  },
  saveDetailsSection: {
    gap: SPACING.sm,
  },
  checkboxRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    paddingVertical: SPACING.xs,
    minHeight: 44,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxChecked: {
    backgroundColor: BRAND.primary,
  },
  checkboxLabel: {
    fontSize: 14,
    fontWeight: "500",
    flex: 1,
  },
  accountInfoBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: SPACING.sm,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
  },
  accountInfoText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
});

export const styles = {
  ...checkoutScreenStyles,
  ...checkoutCryptoPaymentStyles,
};
