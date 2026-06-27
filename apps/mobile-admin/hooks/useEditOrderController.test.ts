import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { OrderItem } from '@/components/orders/new-order.types';

const alertMock = vi.hoisted(() => vi.fn());
const replaceMock = vi.hoisted(() => vi.fn());
const useNewOrderControllerMock = vi.hoisted(() => vi.fn());
const useOrderMock = vi.hoisted(() => vi.fn());
const useUpdateOrderMock = vi.hoisted(() => vi.fn());

vi.mock('react-native', () => ({
  Alert: { alert: alertMock },
}));

vi.mock('expo-router', () => ({
  router: { replace: replaceMock },
  useLocalSearchParams: () => ({ id: 'order-1' }),
}));

vi.mock('./useNewOrderController', () => ({
  useNewOrderController: useNewOrderControllerMock,
}));

vi.mock('./useOrders', () => ({
  useOrder: useOrderMock,
}));

vi.mock('./orders/useUpdateOrder', () => ({
  useUpdateOrder: useUpdateOrderMock,
}));

import { useEditOrderController } from './useEditOrderController';

type BaseController = ReturnType<
  typeof import('./useNewOrderController').useNewOrderController
>;

const orderItems: OrderItem[] = [
  {
    id: 'line-1',
    is_custom: false,
    name: 'Phone',
    price: 1000,
    product_id: 'product-1',
    quantity: 2,
    variant_attributes: { color: 'Blue', storage: '512GB' },
    variant_id: 'variant-1',
    variant_name: 'Blue / 512GB',
  },
];

function createBaseController(
  overrides: Partial<BaseController> = {}
): BaseController {
  return {
    customer: {
      address: '1 Baci Road',
      email: 'ada@example.com',
      id: 'customer-1',
      name: 'Ada Buyer',
      phone: '08030000000',
    },
    deliveryInfo: {
      address: '',
      city: '',
      name: '',
      phone: '',
      state: '',
    },
    discount: 0,
    notes: '',
    orderItems,
    sameAsCustomer: true,
    selectedBranchId: 'branch-1',
    selectedChannel: 'physical',
    setCustomer: vi.fn(),
    setDeliveryInfo: vi.fn(),
    setDiscount: vi.fn(),
    setNotes: vi.fn(),
    setOrderItems: vi.fn(),
    setSelectedBranchId: vi.fn(),
    setSelectedChannel: vi.fn(),
    setShippingFee: vi.fn(),
    setShowSuccessModal: vi.fn(),
    setTaxes: vi.fn(),
    setSameAsCustomer: vi.fn(),
    shippingFee: 0,
    taxesToUse: 0,
    ...overrides,
  } as unknown as BaseController;
}

describe('useEditOrderController', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useOrderMock.mockReturnValue({ data: undefined, isLoading: false });
  });

  it('prefills the new-order controller from loaded order details', async () => {
    const baseController = createBaseController();
    useNewOrderControllerMock.mockReturnValue(baseController);
    useUpdateOrderMock.mockReturnValue({
      isPending: false,
      mutateAsync: vi.fn(),
    });
    useOrderMock.mockReturnValue({
      data: {
        branch_id: 'branch-2',
        customer_email: 'buyer@example.com',
        customer_id: 'customer-2',
        customer_name: 'Buyer',
        customer_phone: '08039999999',
        discount_amount: 100,
        id: 'order-1',
        items: [
          {
            id: 'line-1',
            item_description: 'Open box',
            name: 'Phone',
            price: 2000,
            product_id: 'product-1',
            quantity: 1,
            variant_attributes: { color: 'Black' },
            variant_id: 'variant-1',
            variant_name: 'Black',
          },
        ],
        notes: 'Handle gently',
        shipping_address: {
          address: '12 Allen Avenue',
          city: 'Ikeja',
          name: 'Receiver',
          phone: '08030000000',
          state: 'Lagos',
        },
        shipping_fee: 500,
        source: 'website',
        tax_amount: 75,
      },
      isLoading: false,
    });

    renderHook(() => useEditOrderController());

    await waitFor(() => {
      expect(baseController.setCustomer).toHaveBeenCalledWith({
        address: '12 Allen Avenue',
        email: 'buyer@example.com',
        id: 'customer-2',
        name: 'Buyer',
        phone: '08039999999',
      });
    });
    expect(baseController.setSelectedBranchId).toHaveBeenCalledWith('branch-2');
    expect(baseController.setOrderItems).toHaveBeenCalledWith([
      expect.objectContaining({
        details: 'Open box',
        product_id: 'product-1',
        variant_id: 'variant-1',
      }),
    ]);
    expect(baseController.setNotes).toHaveBeenCalledWith('Handle gently');
    expect(baseController.setShippingFee).toHaveBeenCalledWith(500);
    expect(baseController.setSameAsCustomer).toHaveBeenCalledWith(false);
    expect(baseController.setDeliveryInfo).toHaveBeenCalledWith({
      address: '12 Allen Avenue',
      city: 'Ikeja',
      name: 'Receiver',
      phone: '08030000000',
      state: 'Lagos',
    });
  });

  it('falls back to customer contact when shipping contact is missing', async () => {
    const baseController = createBaseController();
    useNewOrderControllerMock.mockReturnValue(baseController);
    useUpdateOrderMock.mockReturnValue({ isPending: false, mutateAsync: vi.fn() });
    useOrderMock.mockReturnValue({
      data: {
        customer_name: 'Buyer',
        customer_phone: '08039999999',
        id: 'order-1',
        shipping_address: { address: '12 Allen Avenue' },
      },
      isLoading: false,
    });

    renderHook(() => useEditOrderController());

    expect(baseController.setSameAsCustomer).toHaveBeenCalledWith(true);
    expect(baseController.setDeliveryInfo).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Buyer', phone: '08039999999' })
    );
  });

});
