import { products } from './products';

export const orders = [
    {
      id: "OG-2491-XJ",
      date: "Jan 20, 2024",
      time: "10:23 AM",
      total: "₦1,950,000",
      status: "Processing",
      paymentMethod: "Card Payment",
      shippingAddress: "2 Olaide Tomori St, Ikeja, Lagos",
      items: [products[0]]
    },
    {
      id: "OG-1182-MK",
      date: "Dec 15, 2023",
      time: "2:45 PM",
      total: "₦895,000",
      status: "Delivered",
      paymentMethod: "Bank Transfer",
      shippingAddress: "15 Admiralty Way, Lekki, Lagos",
      items: [products[2], products[6]]
    },
    {
        id: "OG-3321-PL",
        date: "Nov 28, 2023",
        time: "09:12 AM",
        total: "₦45,000",
        status: "Cancelled",
        paymentMethod: "Wallet",
        shippingAddress: "2 Olaide Tomori St, Ikeja, Lagos",
        items: [products[6]]
    }
  ];