import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { fireEvent, render, screen } from "@testing-library/react-native";
import type { ReactNode } from "react";
import Colors from "@/constants/Colors";
import { BankTransferView } from "./BankTransferView";

jest.mock("react-native-safe-area-context", () => ({
  SafeAreaView: ({ children }: { children?: ReactNode }) => {
    const { View } =
      jest.requireActual<typeof import("react-native")>("react-native");
    return <View>{children}</View>;
  },
}));

describe("BankTransferView", () => {
  const props = {
    accountName: "Baci Store",
    accountNumber: "1234567890",
    amount: "250000",
    bankName: "Test Bank",
    colors: Colors.light,
    copiedField: null,
    error: null,
    isSubmitting: false,
    isValid: true,
    onBack: jest.fn(),
    onConfirmTransfer: jest.fn(),
    onCopyAccountName: jest.fn(),
    onCopyAccountNumber: jest.fn(),
    onCopyBankName: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders account details and exposes copy and confirmation actions", () => {
    render(<BankTransferView {...props} />);

    expect(screen.getByText("Test Bank")).toBeTruthy();
    expect(screen.getByText("1234567890")).toBeTruthy();
    expect(screen.getByText("Baci Store")).toBeTruthy();

    fireEvent.press(screen.getByRole("button", { name: "Copy bank" }));
    fireEvent.press(
      screen.getByRole("button", { name: "Copy account number" }),
    );
    fireEvent.press(
      screen.getByRole("button", { name: "Confirm I've sent the money" }),
    );

    expect(props.onCopyBankName).toHaveBeenCalledTimes(1);
    expect(props.onCopyAccountNumber).toHaveBeenCalledTimes(1);
    expect(props.onConfirmTransfer).toHaveBeenCalledTimes(1);
  });

  it("uses reusable wallet DVA copy and status polling action for wallet-funded orders", () => {
    render(
      <BankTransferView
        {...props}
        mode="wallet_funded"
        walletFundingStatus="pending"
      />,
    );

    expect(
      screen.getByText(
        "We will fund your wallet and pay this order automatically.",
      ),
    ).toBeTruthy();
    expect(screen.queryByText(/one-time account/i)).toBeNull();

    fireEvent.press(
      screen.getByRole("button", { name: "Check payment status" }),
    );

    expect(props.onConfirmTransfer).toHaveBeenCalledTimes(1);
  });

  it("shows wallet-funded underfunded, review, and expired states", () => {
    const { rerender } = render(
      <BankTransferView
        {...props}
        mode="wallet_funded"
        remainingAmount={50000}
        walletFundingStatus="underfunded"
      />,
    );

    expect(screen.getByText("Transfer remaining amount")).toBeTruthy();
    expect(screen.getByText("₦50,000 still needed")).toBeTruthy();

    rerender(
      <BankTransferView
        {...props}
        mode="wallet_funded"
        orderNumber="ORD-123"
        walletFundingStatus="review_required"
      />,
    );
    expect(screen.getByText("Transfer under review")).toBeTruthy();
    expect(
      screen.getByText("Support is reviewing payment for order ORD-123."),
    ).toBeTruthy();

    rerender(
      <BankTransferView
        {...props}
        mode="wallet_funded"
        walletFundingStatus="expired"
      />,
    );
    expect(screen.getByText("Payment window expired")).toBeTruthy();
  });

  it("shows a recovery message when wallet-funded auto-check stops", () => {
    render(
      <BankTransferView
        {...props}
        mode="wallet_funded"
        pollingTimedOut
        walletFundingStatus="pending"
      />,
    );

    expect(screen.getByText("Auto-check stopped")).toBeTruthy();
    expect(
      screen.getByText(
        "Tap check payment status to refresh, or contact support.",
      ),
    ).toBeTruthy();
  });

  it("shows completed status ahead of a stale timeout flag", () => {
    render(
      <BankTransferView
        {...props}
        mode="wallet_funded"
        pollingTimedOut
        walletFundingStatus="completed"
      />,
    );

    expect(screen.getByText("Payment confirmed")).toBeTruthy();
    expect(screen.queryByText("Auto-check stopped")).toBeNull();
  });

  it("shows invalid transfer recovery and invokes its back action", () => {
    render(
      <BankTransferView
        {...props}
        error="Account number is required"
        isValid={false}
      />,
    );

    expect(screen.getByText("Invalid Transfer Details")).toBeTruthy();

    fireEvent.press(screen.getByRole("button", { name: "Go Back" }));

    expect(props.onBack).toHaveBeenCalledTimes(1);
  });

  it("does not expose a NaN transfer amount for invalid input", () => {
    render(<BankTransferView {...props} amount="not-a-number" />);

    expect(screen.queryByText(/\u20A6NaN/)).toBeNull();
  });
});
