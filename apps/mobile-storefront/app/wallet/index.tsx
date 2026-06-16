import { useLocalSearchParams } from 'expo-router';
import { WalletScreen } from '@/components/wallet/WalletScreen';

interface WalletRouteProps {
  presentation?: 'stack' | 'tab';
}

export default function WalletRoute({
  presentation = 'stack',
}: WalletRouteProps = {}) {
  // Read the route params at the route boundary so this component re-renders
  // (and produces a fresh WalletScreen element) whenever the URL changes.
  // React Compiler memoizes the returned element by its inputs, so passing the
  // params down as props is what propagates post-mount param changes into
  // WalletScreen's render-phase sync. Reading them only inside WalletScreen
  // would let this memoized boundary bail out and swallow the update.
  const { action, requiredAmount, returnTo } = useLocalSearchParams<{
    action?: string;
    requiredAmount?: string;
    returnTo?: string;
  }>();

  return (
    <WalletScreen
      action={action}
      presentation={presentation}
      requiredAmount={requiredAmount}
      returnTo={returnTo}
    />
  );
}
