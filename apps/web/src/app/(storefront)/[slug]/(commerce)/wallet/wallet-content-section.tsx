import { OgabasseyV2Wallet } from '@/components/storefront/ogabassey/pages/wallet';

interface WalletContentSectionProps {
  initialShowFunding?: boolean;
  initialShowUsdtFunding?: boolean;
  initialUsdtAmount?: number;
  initialUsdtReference?: string;
  usdtWalletEnabled?: boolean;
}

export function WalletContentSection({
  initialShowFunding = false,
  initialShowUsdtFunding = false,
  initialUsdtAmount,
  initialUsdtReference,
  usdtWalletEnabled = false,
}: WalletContentSectionProps) {
  return (
    <section aria-labelledby="wallet-page-title">
      <h1 id="wallet-page-title" className="sr-only">
        Wallet Balance
      </h1>
      <OgabasseyV2Wallet
        initialShowFunding={initialShowFunding}
        initialShowUsdtFunding={initialShowUsdtFunding}
        initialUsdtAmount={initialUsdtAmount}
        initialUsdtReference={initialUsdtReference}
        usdtWalletEnabled={usdtWalletEnabled}
      />
    </section>
  );
}
