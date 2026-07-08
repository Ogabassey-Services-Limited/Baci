import { useEffect, useState } from 'react';

interface UseWalletFundPanelAutoCreateArgs {
  canCreateFundingAccount: boolean;
  fundAmount: string;
  hasFundingAccount: boolean;
  isCreatingFundingAccount: boolean;
  // Returns a boolean success flag when awaited (false = creation failed);
  // typed as unknown so a plain `() => void` handler is still accepted.
  onCreateFundingAccount: () => unknown;
}

/**
 * Owns the Add Money panel's DVA auto-provisioning side effect.
 *
 * Opening the panel with NO prefilled amount is a bank-transfer funding
 * intent, so it doubles as consent: the account number is provisioned once,
 * automatically. Panels opened WITH a prefilled amount (savings top-up,
 * checkout returnTo) are explicit card/gateway intents for their whole
 * lifetime — `openedWithPrefill` latches that at mount so clearing the
 * amount input can never flip the panel into silently provisioning a DVA.
 */
export function useWalletFundPanelAutoCreate({
  canCreateFundingAccount,
  fundAmount,
  hasFundingAccount,
  isCreatingFundingAccount,
  onCreateFundingAccount,
}: UseWalletFundPanelAutoCreateArgs) {
  // Latches the moment a prefilled amount is EVER seen — at mount, or later
  // if a route action (`action=fund&requiredAmount=...`) sets it in place
  // while the panel stays mounted. Once latched it never resets, so clearing
  // the amount afterward can't flip a card intent back into auto-creating a
  // DVA. React "adjusting state during render" pattern.
  const [openedWithPrefill, setOpenedWithPrefill] = useState(fundAmount !== '');
  if (fundAmount !== '' && !openedWithPrefill) {
    setOpenedWithPrefill(true);
  }
  const [autoCreateAttempted, setAutoCreateAttempted] = useState(false);
  const [autoCreateFailed, setAutoCreateFailed] = useState(false);

  useEffect(() => {
    if (
      openedWithPrefill ||
      autoCreateAttempted ||
      hasFundingAccount ||
      !canCreateFundingAccount ||
      isCreatingFundingAccount ||
      fundAmount !== ''
    ) {
      return;
    }
    setAutoCreateAttempted(true);
    void (async () => {
      try {
        const created = await onCreateFundingAccount();
        // A false result means creation failed (DVA conflict, transient
        // error) — fall back to card entry instead of an endless spinner.
        if (created === false) {
          setAutoCreateFailed(true);
        }
      } catch {
        // A rejection (rather than a false result) must also fall back,
        // never leave the "Setting up..." spinner running forever.
        setAutoCreateFailed(true);
      }
    })();
  }, [
    autoCreateAttempted,
    canCreateFundingAccount,
    fundAmount,
    hasFundingAccount,
    isCreatingFundingAccount,
    onCreateFundingAccount,
    openedWithPrefill,
  ]);

  return { autoCreateFailed, openedWithPrefill };
}
