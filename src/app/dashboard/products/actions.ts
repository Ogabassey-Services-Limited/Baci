'use server';

import { generateObject } from 'ai';
import { z } from 'zod';
import { geminiFlash, sanitizePromptInput, withRetry } from '@/ai/provider';
import type { Product } from '@/lib/products';

// Zod schema for the AI response
const ChangeDetailsSchema = z.object({
  name: z.string(),
  price: z.number(),
  sku: z.string().optional(),
  description: z.string().optional(),
  stock: z.number().optional(),
  brand: z.string().optional(),
});

const ChangeSchema = z.object({
  type: z.enum(['update', 'new', 'remove']),
  productId: z
    .string()
    .optional()
    .describe('SKU or ID of the product to update or remove'),
  newPrice: z
    .number()
    .optional()
    .describe('The new price for a product update'),
  details: ChangeDetailsSchema,
  reason: z
    .string()
    .optional()
    .describe('Reasoning for the change, especially for removals'),
});

const ClarificationRequestSchema = z
  .object({
    question: z.string(),
    options: z.array(z.string()),
  })
  .optional();

const MissingParameterRequestSchema = z
  .object({
    productName: z.string(),
    missingFields: z.array(z.string()),
  })
  .optional();

const AIResponseSchema = z.object({
  changes: z.array(ChangeSchema),
  summary: z.string().describe('A human-readable summary of all changes'),
  clarificationRequest: ClarificationRequestSchema,
  missingParameterRequest: MissingParameterRequestSchema,
});

export interface Change {
  type: 'update' | 'new' | 'remove';
  productId?: string;
  newPrice?: number;
  details: {
    name: string;
    price: number;
    sku?: string;
    description?: string;
    stock?: number;
    brand?: string;
  };
  reason?: string;
}

export interface AIResponse {
  changes: Change[];
  summary: string;
  clarificationRequest?: {
    question: string;
    options: string[];
  };
  missingParameterRequest?: {
    productName: string;
    missingFields: string[];
  };
}

export async function processPriceList(
  currentProducts: Product[],
  priceListData: string,
  vendor: string,
  fileType: string
): Promise<AIResponse> {
  performance.mark('processPriceList-start');
  // Sanitize user-provided inputs
  const safeVendor = sanitizePromptInput(vendor, 100).value;
  const safeFileType = sanitizePromptInput(fileType, 50).value;

  const prompt = `
You are an AI assistant for an e-commerce platform. Your task is to analyze a new price list and compare it to the current product catalog.
Return a structured JSON object that details all suggested changes.

Current Product Catalog (JSON):
${JSON.stringify(currentProducts)}

New Price List from Vendor "${safeVendor}" (Format: ${safeFileType}):
---
${priceListData}
---

Instructions:
1.  Analyze the new price list and identify all differences from the current catalog.
2.  For existing products, identify price changes. Use the SKU/ID to match products.
3.  Identify any completely new products in the price list.
4.  Identify products in the current catalog that are NOT in the new price list; suggest them for removal.
5.  Populate the 'changes' array with objects representing these findings.
6.  If a required field for a new product like "Condition" is missing, use the 'missingParameterRequest' field to ask for it.
7.  If you are uncertain about a change (e.g., two products have similar names), use 'clarificationRequest' to ask the user.
8.  Provide a concise 'summary' of all the changes you found.
`;

  try {
    const { object } = await withRetry(async () => {
      return await generateObject({
        model: geminiFlash,
        schema: AIResponseSchema,
        prompt,
      });
    });

    const result = object as AIResponse;
    performance.mark('processPriceList-end');
    performance.measure(
      'processPriceList',
      'processPriceList-start',
      'processPriceList-end'
    );
    return result;
  } catch (error) {
    console.error('Error processing price list with AI:', error);
    // Return a structured error response
    return {
      changes: [],
      summary:
        'An error occurred while processing the price list. The AI model could not return a valid response. Please check the file format or try again.',
    };
  }
}

export async function fetchGoogleSheet(url: string): Promise<string> {
  performance.mark('fetchGoogleSheet-start');
  try {
    // Validate URL format first
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
    } catch {
      throw new Error(
        'Invalid URL format. Please provide a valid Google Sheets URL.'
      );
    }

    // SSRF Protection: Only allow Google Sheets domains
    const allowedHosts = ['docs.google.com', 'sheets.google.com'];
    if (!allowedHosts.includes(parsedUrl.hostname)) {
      throw new Error('Invalid URL. Only Google Sheets URLs are allowed.');
    }

    // Ensure HTTPS protocol
    if (parsedUrl.protocol !== 'https:') {
      throw new Error('Invalid URL. Only HTTPS URLs are allowed.');
    }

    // Extract Spreadsheet ID and construct export URL
    // Regex to capture the ID between /d/ and /
    const match = url.match(/\/d\/([a-zA-Z0-9-_]+)/);

    if (!match || !match[1]) {
      throw new Error(
        'Invalid Google Sheets URL. Could not extract spreadsheet ID.'
      );
    }

    const spreadsheetId = match[1];

    // Validate spreadsheet ID format (alphanumeric, hyphens, underscores only)
    if (!/^[a-zA-Z0-9-_]+$/.test(spreadsheetId)) {
      throw new Error('Invalid spreadsheet ID format.');
    }

    // Always construct the export URL from the validated spreadsheet ID
    // Never use the user-provided URL directly for the fetch request
    const exportUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv`;

    const response = await fetch(exportUrl);

    if (!response.ok) {
      throw new Error(`Failed to fetch Google Sheet: ${response.statusText}`);
    }

    const text = await response.text();
    performance.mark('fetchGoogleSheet-end');
    performance.measure(
      'fetchGoogleSheet',
      'fetchGoogleSheet-start',
      'fetchGoogleSheet-end'
    );
    return text;
  } catch (error) {
    console.error('Error fetching Google Sheet:', error);
    if (error instanceof Error) {
      throw error;
    }
    throw new Error(
      'Failed to fetch Google Sheet content. Please ensure the sheet is published to the web or the link is correct.'
    );
  }
}
