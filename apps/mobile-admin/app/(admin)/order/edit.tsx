import { EditOrderScreenContent } from '@/components/orders/EditOrderScreenContent';
import { InvalidRouteScreen } from '@/components/ui/InvalidRouteScreen';
import { useEditOrderController } from '@/hooks/useEditOrderController';

export default function EditOrderScreen() {
  const controller = useEditOrderController();

  if (!controller.orderId) {
    return (
      <InvalidRouteScreen
        message="The order ID is missing. Please open edit from an order details page."
        title="Invalid Order"
      />
    );
  }

  return <EditOrderScreenContent controller={controller} />;
}
