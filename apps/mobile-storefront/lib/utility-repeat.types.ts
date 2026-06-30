export type UtilityRouteType = 'airtime' | 'data' | 'tv' | 'power' | 'gaming';

export interface UtilityRepeatRouteParams {
  repeatAmount?: string;
  repeatBillerName?: string;
  repeatBillItemIdentifier?: string;
  repeatCustomerIdentifier?: string;
  repeatCustomerName?: string;
  repeatCustomerAddress?: string;
  repeatDataPlanCode?: string;
  repeatNetworkProvider?: string;
  repeatPhoneNumber?: string;
  repeatVerified?: '1';
  type: UtilityRouteType;
}

export interface UtilityRepeatDefaults {
  amount?: string;
  billerName?: string;
  billItemIdentifier?: string;
  customerIdentifier?: string;
  customerName?: string;
  address?: string;
  dataPlanCode?: string;
  isVerified?: boolean;
  networkProvider?: string;
  phoneNumber?: string;
}

export interface UtilityRepeatRecipient {
  id: string;
  title: string;
  identifierLabel: string;
  identifier: string;
  meta: string;
  defaults: UtilityRepeatDefaults;
}
