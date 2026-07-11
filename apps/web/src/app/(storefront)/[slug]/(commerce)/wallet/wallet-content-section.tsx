import { OgabasseyV2Wallet } from '@/components/storefront/ogabassey/pages/wallet';

interface WalletContentSectionProps {
  initialShowFunding?: boolean;
  initialShowUsdtFunding?: boolean;
  initialUsdtAmount?: number;
}

export function WalletContentSection({
  initialShowFunding = false,
  initialShowUsdtFunding = false,
  initialUsdtAmount,
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
      />
    </section>
  );
}
