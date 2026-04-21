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
      'Go to the Orders section in the app to view your latest order status, delivery progress, and any tracking details shared by the merchant.',
  },
  {
    id: '2',
    question: 'What payment methods do you accept?',
    answer:
      'Available payment methods are shown at checkout and may vary by merchant, order value, or delivery location.',
  },
  {
    id: '3',
    question: 'How long does delivery take?',
    answer:
      'Delivery timelines depend on the merchant, your location, and the shipping option selected at checkout. Review the order summary or contact support for the latest estimate.',
  },
  {
    id: '4',
    question: 'Can I return or exchange an item?',
    answer:
      "Return and exchange eligibility depends on the merchant's policy and the condition of the item. Contact support if you need help starting a return request.",
  },
  {
    id: '5',
    question: 'How do I contact the merchant?',
    answer:
      'Use the WhatsApp, call, or email options on this page to reach the merchant directly for order updates, product questions, or after-sales support.',
  },
  {
    id: '6',
    question: 'When will I receive a refund?',
    answer:
      "Approved refunds are usually sent back through the original payment method, but timing can vary by payment provider and the merchant's review process.",
  },
  {
    id: '7',
    question: 'Why is an item no longer available?',
    answer:
      'Product availability can change quickly when stock is low or a merchant updates their catalog. If an item disappears from the app, contact support for the latest availability.',
  },
] as const satisfies readonly FaqItem[];

// TODO(storefront): Replace these generic fallback hours with merchant-managed
// business hours once the storefront API exposes them.
export const fallbackStoreHours = [
  {
    id: 'hours-vary',
    label: 'Opening hours vary by merchant and location.',
  },
  {
    id: 'contact-support',
    label: 'Use the support options above for the latest availability.',
  },
] as const satisfies readonly StoreHour[];
