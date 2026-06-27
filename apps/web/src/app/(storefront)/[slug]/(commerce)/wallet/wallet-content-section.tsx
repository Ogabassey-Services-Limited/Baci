import { OgabasseyV2Wallet } from '@/components/storefront/ogabassey/pages/wallet';

export function WalletContentSection() {
  return (
    <section aria-labelledby="wallet-page-title">
      <h1 id="wallet-page-title" className="sr-only">
        Wallet Balance
      </h1>
      <OgabasseyV2Wallet />
    </section>
  );
}
