import { NewOrderScreenContent } from '@/components/orders/NewOrderScreenContent';
import { useNewOrderController } from '@/hooks/useNewOrderController';

export default function NewOrderScreen() {
  const controller = useNewOrderController();
  return <NewOrderScreenContent controller={controller} />;
}
