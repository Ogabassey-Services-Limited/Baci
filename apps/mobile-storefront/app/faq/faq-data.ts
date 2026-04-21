export interface FaqItem {
  id: string;
  question: string;
  answer: string;
}

export interface StoreHour {
  id: string;
  label: string;
}

export const faqItems = [
  {
    id: '1',
    question: 'How do I track my order?',
    answer:
      'You can track your order by going to "Orders" in the menu. Each order has a status indicator and tracking information when available. You\'ll also receive SMS and email updates as your order progresses.',
  },
  {
    id: '2',
    question: 'What payment methods do you accept?',
    answer:
      'We accept multiple payment methods including card payments via Paystack, bank transfers, and Pay on Delivery. We also offer Buy Now Pay Later options through CredPal and Credit Direct for eligible orders.',
  },
  {
    id: '3',
    question: 'How long does delivery take?',
    answer:
      'Delivery times vary based on your location. Lagos deliveries typically take 1-2 business days, while other states take 2-5 business days. Same-day delivery is available for select areas within Lagos.',
  },
  {
    id: '4',
    question: 'Can I return or exchange an item?',
    answer:
      'Yes! We offer a 7-day return policy for most items. The product must be in its original condition with all accessories. Contact our support team to initiate a return or exchange.',
  },
  {
    id: '5',
    question: "How do I verify a phone's IMEI?",
    answer:
      "Use our IMEI Checker feature in the app. Enter the 15-digit IMEI number to check if the device is blacklisted, iCloud locked, or has any other issues. This helps ensure you're buying a legitimate device.",
  },
  {
    id: '6',
    question: 'What is the Swap/Trade-in program?',
    answer:
      'Our trade-in program lets you exchange your old device for credit towards a new purchase. Simply upload a video of your device, and our AI will provide an instant valuation. Contact us via WhatsApp to complete the swap.',
  },
  {
    id: '7',
    question: 'Are your products genuine?',
    answer:
      'Yes, all our products are 100% authentic. We source directly from authorized distributors and offer warranty on all new devices. Pre-owned devices are thoroughly tested and verified.',
  },
] as const satisfies readonly FaqItem[];

export const storeHours = [
  {
    id: 'weekdays',
    label: 'Monday - Saturday: 9:00 AM - 7:00 PM',
  },
  {
    id: 'sunday',
    label: 'Sunday: 12:00 PM - 5:00 PM',
  },
] as const satisfies readonly StoreHour[];

export const storeAddress = 'Computer Village, Ikeja, Lagos';
