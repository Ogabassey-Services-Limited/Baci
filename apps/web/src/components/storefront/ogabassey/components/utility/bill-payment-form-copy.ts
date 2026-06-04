export const BILL_PAYMENT_COPY = {
  billItemLabels: {
    tv: 'Package',
    power: 'Meter Type',
    betting: 'Service Type',
  },
  identifierLabels: {
    tv: 'Smart Card Number',
    power: 'Meter Number',
    betting: 'Account ID',
  },
  identifierPlaceholders: {
    tv: 'Enter smart card number',
    power: 'Enter meter number',
    betting: 'Enter betting account ID',
  },
  tabToBillType: {
    tv: 'cable_tv',
    power: 'electricity',
    betting: 'betting',
  },
  typeLabels: {
    tv: 'TV Subscription',
    power: 'Electricity',
    betting: 'Betting Top-up',
  },
} as const;
