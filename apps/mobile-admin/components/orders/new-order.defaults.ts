import type {
  CustomerInfo,
  CustomItemDraft,
  DeliveryInfo,
  NewCustomerDraft,
} from './new-order.types';

export function createEmptyCustomerInfo(): CustomerInfo {
  return {
    address: '',
    email: '',
    id: null,
    name: '',
    phone: '',
  };
}

export function createEmptyCustomItemDraft(): CustomItemDraft {
  return {
    name: '',
    price: '',
  };
}

export function createEmptyDeliveryInfo(): DeliveryInfo {
  return {
    address: '',
    city: '',
    name: '',
    phone: '',
    state: '',
  };
}

export function createEmptyNewCustomerDraft(): NewCustomerDraft {
  return {
    address: '',
    email: '',
    firstName: '',
    lastName: '',
    phone: '',
  };
}
