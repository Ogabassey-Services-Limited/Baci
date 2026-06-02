/**
 * AI Chat Tools for Agentic Commerce
 *
 * Provides Zod schemas and descriptions for function-calling with Gemini.
 * These tools enable the chatbot to:
 * - Search and retrieve products
 * - Generate virtual bank accounts for payment
 * - Check payment status
 * - Get upsell/cross-sell recommendations
 */

import z from 'zod';

// ============================================
// TOOL SCHEMAS (Zod)
// ============================================

export const searchProductsSchema = z.object({
  query: z
    .string()
    .describe('Search query for products (e.g., "iPhone 15", "gaming laptop")'),
  category: z.string().optional().describe('Optional category filter'),
  maxPrice: z.number().optional().describe('Maximum price in Naira'),
  minPrice: z.number().optional().describe('Minimum price in Naira'),
});

export const getProductDetailsSchema = z.object({
  productId: z.string().describe('The unique ID of the product'),
});

export const createVirtualAccountSchema = z.object({
  amount: z.number().describe('Total amount to pay in Naira'),
  customerEmail: z.email().describe('Customer email address'),
  customerName: z.string().describe('Customer full name'),
  customerPhone: z.string().optional().describe('Customer phone number'),
  items: z
    .array(
      z.object({
        productId: z.string(),
        name: z.string(),
        price: z.number(),
        quantity: z.number(),
      })
    )
    .describe('Items being purchased'),
});

export const checkPaymentStatusSchema = z
  .object({
    orderId: z
      .string()
      .optional()
      .describe('The chat order ID to check payment status for'),
    customerEmail: z
      .string()
      .email()
      .optional()
      .describe('Customer email to look up their most recent payment'),
  })
  .refine((data) => data.orderId || data.customerEmail, {
    message: 'Either orderId or customerEmail is required',
  });

export const getRecommendationsSchema = z.object({
  productId: z.string().describe('Product ID to get recommendations for'),
  type: z
    .enum(['upsell', 'cross_sell', 'accessories'])
    .describe(
      'Type of recommendation: upsell (better version), cross_sell (complementary products), accessories'
    ),
});

export const addToCartSchema = z.object({
  productId: z.string().describe('Product ID to add to cart'),
  quantity: z.number().default(1).describe('Quantity to add'),
});

// ============================================
// TOOL DESCRIPTIONS
// ============================================

export const TOOL_DESCRIPTIONS = {
  searchProducts:
    'Search for products matching a query. Use this when the user asks about products, availability, or prices.',
  getProductDetails:
    'Get full details for a specific product including description, specifications, stock, and images.',
  createVirtualAccount:
    'Generate a bank account number for the customer to pay via bank transfer. Use this when the customer is ready to pay.',
  checkPaymentStatus:
    'Check if payment has been received for a pending order. Use this when customer says they have paid.',
  getRecommendations:
    'Get related product recommendations. Use "upsell" for better alternatives, "cross_sell" for complementary products, "accessories" for add-ons.',
  addToCart:
    "Add a product to the customer's cart. Use this when the customer wants to buy a specific product.",
} as const;

// ============================================
// TYPE EXPORTS
// ============================================

export type SearchProductsParams = z.infer<typeof searchProductsSchema>;
export type GetProductDetailsParams = z.infer<typeof getProductDetailsSchema>;
export type CreateVirtualAccountParams = z.infer<
  typeof createVirtualAccountSchema
>;
export type CheckPaymentStatusParams = z.infer<typeof checkPaymentStatusSchema>;
export type GetRecommendationsParams = z.infer<typeof getRecommendationsSchema>;
export type AddToCartParams = z.infer<typeof addToCartSchema>;
