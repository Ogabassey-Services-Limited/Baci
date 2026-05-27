import { WalletScreen } from '@/components/wallet/WalletScreen';

interface WalletRouteProps {
  presentation?: 'stack' | 'tab';
}

export default function WalletRoute({
  presentation = 'stack',
}: WalletRouteProps = {}) {
  return <WalletScreen presentation={presentation} />;
}
