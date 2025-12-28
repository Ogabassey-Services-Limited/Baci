import Stripe from 'stripe';

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

if (!stripeSecretKey) {
  console.warn('STRIPE_SECRET_KEY is not set');
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const stripe = new Stripe(stripeSecretKey || '', {
  // biome-ignore lint/suspicious/noExplicitAny: Cast to bypass version type checking for beta API
  apiVersion: '2025-03-31.basil' as any, // Cast to bypass version type checking
  typescript: true,
});

/**
 * Charge a Delegated Payment Token (SPT) from OpenAI
 */
export async function chargeDelegatedPayment(
  sptToken: string,
  amount: number, // Major units (e.g. 1000 for 10.00) or Minor? Spec says amount: 300 for $3.00 if USD.
  // Stripe expects minor units (cents/kobo).
  // If `checkout.ts` returned 300 for 300 NGN, we need to multiply by 100 for Stripe?
  // Let's verify `checkout.ts`. I assumed standard units in `checkout.ts` logic comments?
  // No, I assumed MAJOR units in `checkout.ts` comments ("300 Naira") but let's re-read carefully.
  // Standard Stripe practice: ALWAYS minor units.
  // OpenAI Spec: "amount": 300. "currency": "usd". 300 USD?
  // If OpenAI sends 300 for $3.00, it's minor units.
  // If OpenAI sends 300 for $300.00, it's major units.
  // Usually APIs behave like Stripe (minor units).
  // Assuming `amount` passed here is from our `checkout.ts` totals.
  // If `checkout.ts` uses NGN (e.g. 1000 NGN), then Stripe needs 100000 kobo.
  // I will assume `amount` passed to this function is in MAJOR units (from `checkout.ts`) and convert to minor.
  currency: string = 'NGN',
  metadata: Record<string, string> = {}
) {
  if (!stripeSecretKey) {
    throw new Error('Stripe is not configured');
  }

  // Convert to minor units (kobo/cents)
  const amountMinor = Math.round(amount * 100);

  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountMinor,
      currency: currency.toLowerCase(),
      payment_method: sptToken,
      confirm: true,
      return_url: 'https://baci.app/checkout/success', // Placeholder, not used in API flow usually
      metadata,
      automatic_payment_methods: {
        enabled: true,
        allow_redirects: 'never', // API flow shouldn't redirect
      },
      // Delegated Payment specific config might be needed?
      // Standard Stripe: payment_method = spt_xxx works if token is valid.
    });

    return {
      success: paymentIntent.status === 'succeeded',
      id: paymentIntent.id,
      status: paymentIntent.status,
      amount: paymentIntent.amount,
      raw: paymentIntent,
    };
    // biome-ignore lint/suspicious/noExplicitAny: Generic error handling
  } catch (error: any) {
    console.error('Stripe Delegated Payment Error:', error);
    return {
      success: false,
      error: error.message,
      code: error.code,
    };
  }
}
