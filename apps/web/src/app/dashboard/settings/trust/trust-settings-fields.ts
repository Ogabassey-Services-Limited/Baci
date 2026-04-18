export type TrustFieldKind = 'input' | 'textarea' | 'select';

export interface TrustFieldConfig {
  name: string;
  label: string;
  kind: TrustFieldKind;
  placeholder?: string;
  type?: 'number';
  options?: Array<{ label: string; value: string }>;
}

export const TRUST_FIELD_CONFIGS: TrustFieldConfig[] = [
  {
    name: 'foundedYear',
    label: 'Founded Year',
    kind: 'input',
    placeholder: '2018',
    type: 'number',
  },
  {
    name: 'whatsappNumber',
    label: 'WhatsApp Support Number',
    kind: 'input',
    placeholder: '+2348111111111',
  },
  {
    name: 'supportHoursSummary',
    label: 'Support Hours Summary',
    kind: 'textarea',
    placeholder: 'Mon-Sat, 8am-6pm',
  },
  {
    name: 'supportTimezone',
    label: 'Support Timezone',
    kind: 'input',
    placeholder: 'Africa/Lagos',
  },
  {
    name: 'supportResponseTimeSummary',
    label: 'Support Response Time Summary',
    kind: 'textarea',
    placeholder: 'Within 2 business hours',
  },
  {
    name: 'returnPolicySummary',
    label: 'Return Policy Summary',
    kind: 'textarea',
    placeholder: 'Returns accepted for defective items.',
  },
  {
    name: 'returnWindowDays',
    label: 'Return Window Days',
    kind: 'input',
    placeholder: '7',
    type: 'number',
  },
  {
    name: 'returnMethod',
    label: 'Return Method',
    kind: 'select',
    options: [
      { value: '', label: 'Select return method' },
      { value: 'mail', label: 'Mail' },
      { value: 'in_store', label: 'In Store' },
      { value: 'carrier_dropoff', label: 'Carrier Dropoff' },
    ],
  },
  {
    name: 'returnFees',
    label: 'Return Fees',
    kind: 'select',
    options: [
      { value: '', label: 'Select return fee policy' },
      { value: 'free', label: 'Free' },
      { value: 'customer_pays', label: 'Customer Pays' },
      {
        value: 'original_shipping_deducted',
        label: 'Original Shipping Deducted',
      },
    ],
  },
  {
    name: 'shippingSummary',
    label: 'Shipping Summary',
    kind: 'textarea',
    placeholder: 'Nationwide delivery available.',
  },
  {
    name: 'shippingRegions',
    label: 'Shipping Regions',
    kind: 'input',
    placeholder: 'NG, GH',
  },
  {
    name: 'handlingDaysMin',
    label: 'Handling Days Minimum',
    kind: 'input',
    placeholder: '0',
    type: 'number',
  },
  {
    name: 'handlingDaysMax',
    label: 'Handling Days Maximum',
    kind: 'input',
    placeholder: '1',
    type: 'number',
  },
  {
    name: 'transitDaysMin',
    label: 'Transit Days Minimum',
    kind: 'input',
    placeholder: '1',
    type: 'number',
  },
  {
    name: 'transitDaysMax',
    label: 'Transit Days Maximum',
    kind: 'input',
    placeholder: '5',
    type: 'number',
  },
  {
    name: 'shippingFeeType',
    label: 'Shipping Fee Type',
    kind: 'select',
    options: [
      { value: '', label: 'Select shipping fee type' },
      { value: 'free', label: 'Free' },
      { value: 'flat_rate', label: 'Flat Rate' },
      { value: 'calculated', label: 'Calculated' },
    ],
  },
  {
    name: 'warrantySummary',
    label: 'Warranty Summary',
    kind: 'textarea',
    placeholder: 'Manufacturer warranty applies.',
  },
];
