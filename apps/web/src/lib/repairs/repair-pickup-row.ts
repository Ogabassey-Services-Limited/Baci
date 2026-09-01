export interface RepairPickupRow {
  id: string;
  merchant_id: string;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  device_type: string | null;
  device_model: string | null;
  pickup_address: string | null;
  shipment_id: string | null;
  quoted_price: number | string | null;
  status: string | null;
}
