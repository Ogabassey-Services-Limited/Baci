const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;

if (!PAYSTACK_SECRET_KEY && process.env.NODE_ENV === 'production') {
  console.warn('PAYSTACK_SECRET_KEY is not set');
}

export interface PaystackCustomer {
  email: string;
  first_name: string;
  last_name: string;
  phone: string;
}

export interface DVAResponse {
  account_number: string;
  account_name: string;
  bank_name: string;
  currency: string;
  assigned: boolean;
}

async function paystackRequest(
  endpoint: string,
  method: string,
  body?: unknown
) {
  // Build-time safety: If key is missing during build, don't crash, but fail at runtime
  const secretKey = PAYSTACK_SECRET_KEY || 'sk_test_placeholder';

  const res = await fetch(`https://api.paystack.co${endpoint}`, {
    method,
    headers: {
      Authorization: `Bearer ${secretKey}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const errorBody = await res.text();
    throw new Error(`Paystack API Error ${res.status}: ${errorBody}`);
  }

  return res.json();
}

export async function getOrCreatePaystackCustomer(
  customer: PaystackCustomer
): Promise<string> {
  try {
    // 1. Try to create customer
    const createRes = await fetch('https://api.paystack.co/customer', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET_KEY || 'sk_test_placeholder'}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(customer),
    });

    const createData = await createRes.json();

    if (createData.status) {
      return createData.data.customer_code;
    }

    // If failed, likely exists. Try to fetch by email.
    if (
      createData.message?.toLowerCase().includes('duplicate') ||
      createData.status === false
    ) {
      // Only fetch if it failed.
      // Note: Paystack unfortunately doesn't always return the code in error.
      // We must query.
      const secretKey = PAYSTACK_SECRET_KEY || 'sk_test_placeholder';
      const getRes = await fetch(
        `https://api.paystack.co/customer/${customer.email}`,
        {
          method: 'GET',
          headers: { Authorization: `Bearer ${secretKey}` },
        }
      );
      const getData = await getRes.json();
      if (getData.status) {
        return getData.data.customer_code;
      }
    }

    throw new Error(
      `Could not create or retrieve customer: ${createData.message}`
    );
  } catch (error) {
    console.error('Paystack Customer Error', error);
    throw error;
  }
}

export async function createDedicatedVirtualAccount(
  customer: PaystackCustomer
): Promise<DVAResponse> {
  const secretKey = PAYSTACK_SECRET_KEY;
  if (!secretKey) {
    // Mock for build/dev without keys
    return {
      account_number: '0000000000',
      account_name: 'Mock Agentic Account (Dev)',
      bank_name: 'Mock Bank',
      currency: 'NGN',
      assigned: true,
    };
  }

  const customerCode = await getOrCreatePaystackCustomer(customer);

  // Create DVA
  const res = await paystackRequest('/dedicated_account', 'POST', {
    customer: customerCode,
    preferred_bank: 'wema-bank',
  });

  if (!res.status) {
    throw new Error(`Failed to assign DVA: ${res.message}`);
  }

  return {
    account_number: res.data.account_number,
    account_name: res.data.account_name,
    bank_name: res.data.bank.name,
    currency: res.data.currency || 'NGN',
    assigned: true,
  };
}
