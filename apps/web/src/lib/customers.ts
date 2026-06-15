// In a real app, this data would come from your database.
// We are defining it here to be shared across the app.

export interface Customer {
  id: string;
  name: string;
  email: string;
  totalOrders: number;
  totalSpent: number;
}

export const customers: Customer[] = [
  {
    id: 'cust_1',
    name: 'Arinze Ihemedu',
    email: 'arinze@example.com',
    totalOrders: 5,
    totalSpent: 138000,
  },
  {
    id: 'cust_2',
    name: 'Awolesi Aderemi',
    email: 'awolesi@example.com',
    totalOrders: 3,
    totalSpent: 482000,
  },
  {
    id: 'cust_3',
    name: 'Wema Bank PLC',
    email: 'accounts@wemabank.com',
    totalOrders: 1,
    totalSpent: 368000,
  },
  {
    id: 'cust_4',
    name: 'Jane Emmanuel Idaka',
    email: 'jane.idaka@example.com',
    totalOrders: 8,
    totalSpent: 356500,
  },
  {
    id: 'cust_5',
    name: 'Mbarihaus Ltd',
    email: 'contact@mbarihaus.com',
    totalOrders: 2,
    totalSpent: 930000,
  },
  {
    id: 'cust_6',
    name: 'Ezekiel Oyesiji',
    email: 'ezekiel.oyesiji@example.com',
    totalOrders: 12,
    totalSpent: 730000,
  },
];
