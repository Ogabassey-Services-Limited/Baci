'use server';

import { generateObject } from 'ai';
import z from 'zod';
import {
  gemini25FlashImage,
  geminiFlash,
  sanitizePromptInput,
  withRetry,
} from '@/ai/provider';
import type { Product } from '@/lib/products';

// Zod schema for the AI response
const ChangeDetailsSchema = z.object({
  name: z.string(),
  price: z.number(),
  sku: z.string().optional(),
  description: z.string().optional(),
  stock: z.number().optional(),
  brand: z.string().optional(),
  image: z.string().optional().describe('URL of the product image'),
  category: z.string().optional().describe('The product category'),
  attributes: z
    .record(z.string(), z.string())
    .optional()
    .describe('Key-value pairs of product attributes (e.g., RAM, Storage)'),
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
    image?: string;
    category?: string;
    attributes?: Record<string, string>;
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
1.  Analyze the new price list. verify header rows vs data rows.
    - **Header Row Detection**: The first few rows might be titles/decorative (e.g., "Premium Used..."). Look for the actual header row containing "Product Name", "Price", etc.
    - **Currency Cleaning**: Prices may contain symbols like "₦" or ",". Strip these out to get raw numbers (e.g., "₦320,000.00" -> 320000).
    - **Category Extraction**: Try to infer the 'category' from the sheet constraints (e.g. if the sheet is "Samsung Phones", category is "Phones"). Or if there is a column for "Type" or "Category".
2.  **Matching Logic**:
    - First, try to match by SKU if available.
    - If no SKU (or SKU not found), **match by Product Name** (case-insensitive).
    - If a match is found, check for price or stock changes.
3.  **New Products**:
    - If a row has a Name and Price but no match in the catalog, mark it as a 'new' product.
    - It is OK if new products only have Name and Price (defaults will be used).
    - **Skip empty rows** or rows with just a description but no Name/Price.
4.  **Removals**:
    - Identify products in the current catalog that are NOT in the new price list; suggest them for removal.
    - BE CAREFUL: Only suggest removal if the price list appears to be a *full update*. If it looks like a partial list (few items), assume others are unchanged.
5.  Populate the 'changes' array.
6.  If a critical field is unclear, use 'clarificationRequest'.
7.  Provide a concise 'summary' of changes.
`;

  const isImage = fileType.startsWith('image/');

  try {
    const { object } = await withRetry(async () => {
      // For images, we must use the multimodal model and messages format
      if (isImage) {
        return await generateObject({
          model: gemini25FlashImage,
          schema: AIResponseSchema,
          messages: [
            {
              role: 'user',
              content: [
                { type: 'text', text: prompt },
                { type: 'image', image: priceListData }, // priceListData is base64 string
              ],
            },
          ],
        });
      }

      // For text/CSV/PDF, standard text-only model
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
    return {
      changes: [],
      summary: `Error: ${error instanceof Error ? error.message : 'AI processing failed. Please try again.'}`,
    };
  }
}

/**
 * Direct CSV Parser for Large Catalogs (1000+ products)
 * Parses CSV programmatically without AI, matches against existing products by name.
 * Much faster and handles unlimited rows.
 */
// biome-ignore lint/suspicious/useAwait: Server Actions must be async functions
export async function parseCSVDirectly(
  currentProducts: Product[],
  csvData: string
): Promise<AIResponse> {
  const lines = csvData.split('\n').filter((line) => line.trim());
  if (lines.length < 2) {
    return {
      changes: [],
      summary:
        'No data rows found in CSV. Please ensure the file is not empty.',
    };
  }

  // Scan first 10 rows to find the header row
  let headerRowIdx = -1;
  let nameIdx = -1;
  let priceIdx = -1;
  let skuIdx = -1;
  let stockIdx = -1;
  let categoryIdx = -1; // Added category index
  let imageIdx = -1; // Added image index

  for (let i = 0; i < Math.min(lines.length, 10); i++) {
    const row = parseCSVRow(lines[i].toLowerCase());

    const nIdx = row.findIndex(
      (h) =>
        h.includes('name') ||
        h.includes('prod') ||
        h.includes('item') ||
        h.includes('title') ||
        h.includes('model')
    );
    const pIdx = row.findIndex(
      (h) =>
        h.includes('price') ||
        h.includes('cost') ||
        h.includes('amount') ||
        h.includes('naira') ||
        h.includes('ngn')
    );

    if (nIdx !== -1 && pIdx !== -1) {
      headerRowIdx = i;
      nameIdx = nIdx;
      priceIdx = pIdx;

      // Look for other optional columns in this valid header row
      skuIdx = row.findIndex(
        (h) =>
          h.includes('sku') ||
          h.includes('code') ||
          h.includes('id') ||
          h.includes('ref')
      );
      stockIdx = row.findIndex(
        (h) =>
          h.includes('stock') ||
          h.includes('qty') ||
          h.includes('quantity') ||
          h.includes('count')
      );
      categoryIdx = row.findIndex(
        (h) =>
          h.includes('category') ||
          h.includes('cat') ||
          h.includes('group') ||
          h.includes('type')
      );
      imageIdx = row.findIndex(
        (h) =>
          h.includes('image') ||
          h.includes('photo') ||
          h.includes('url') ||
          h.includes('img')
      ); // Find image index

      break;
    }
  }

  if (headerRowIdx === -1) {
    return {
      changes: [],
      summary:
        'Could not find "Name" and "Price" columns in the first 10 rows. Please add headers to your sheet (e.g., "Product Name", "Price").',
    };
  }

  // Build lookup map of existing products (by normalized name)
  const existingByName = new Map<string, Product>();
  const existingBySku = new Map<string, Product>();
  for (const p of currentProducts) {
    existingByName.set(normalizeName(p.name), p);
    if (p.sku) existingBySku.set(p.sku.toLowerCase().trim(), p);
  }

  const changes: Change[] = [];
  const processedNames = new Set<string>();
  let skippedCount = 0;

  // Process data rows (start after header row)
  for (let i = headerRowIdx + 1; i < lines.length; i++) {
    const row = parseCSVRow(lines[i]);
    if (row.length <= Math.max(nameIdx, priceIdx)) {
      skippedCount++;
      continue;
    }

    const rawName = row[nameIdx]?.trim() || '';
    const rawPrice = row[priceIdx]?.trim() || '';
    const rawSku = skuIdx !== -1 ? row[skuIdx]?.trim() : undefined;
    const rawStock = stockIdx !== -1 ? row[stockIdx]?.trim() : undefined;
    const rawCategory =
      categoryIdx !== -1 ? row[categoryIdx]?.trim() : undefined;
    const rawImage = imageIdx !== -1 ? row[imageIdx]?.trim() : undefined; // Extract raw image

    if (!rawName || !rawPrice) {
      skippedCount++;
      continue;
    }

    const normalizedName = normalizeName(rawName);
    const price = parsePrice(rawPrice);
    const stock = rawStock
      ? Number.parseInt(rawStock.replace(/[^0-9]/g, ''), 10)
      : undefined;

    if (Number.isNaN(price)) {
      skippedCount++;
      continue;
    }

    processedNames.add(normalizedName);

    // Try to match by SKU first, then by name
    let existingProduct = rawSku
      ? existingBySku.get(rawSku.toLowerCase())
      : undefined;
    if (!existingProduct) {
      existingProduct = existingByName.get(normalizedName);
    }

    if (existingProduct) {
      // Check if price changed
      if (Math.abs(existingProduct.price - price) > 0.01) {
        changes.push({
          type: 'update',
          productId: existingProduct.id,
          newPrice: price,
          details: {
            name: rawName,
            price: existingProduct.price,
            sku: rawSku || existingProduct.sku,
            stock: stock ?? existingProduct.stock,
            category: rawCategory, // Include category in update if new one provided
            image: rawImage, // Include image in update
          },
          reason: `Price changed from ${existingProduct.price} to ${price}`,
        });
      }
      // Could add stock change detection here if needed
    } else {
      // New product
      changes.push({
        type: 'new',
        details: {
          name: rawName,
          price,
          sku: rawSku,
          stock: stock ?? 0,
          category: rawCategory || 'General', // Default to General for new products if missing
          image: rawImage, // Include image for new product
        },
      });
    }
  }

  // Check for removals (products in catalog but not in CSV)
  // Only suggest removals if CSV has substantial data (avoid false positives)
  const csvProductCount = processedNames.size;
  const catalogCount = currentProducts.length;

  // Only suggest removals if CSV has at least 50% of catalog size (likely a full update)
  if (csvProductCount >= catalogCount * 0.5) {
    for (const product of currentProducts) {
      if (!processedNames.has(normalizeName(product.name))) {
        changes.push({
          type: 'remove',
          productId: product.id,
          details: {
            name: product.name,
            price: product.price,
            sku: product.sku,
          },
          reason: 'Not found in updated price list',
        });
      }
    }
  }

  const newCount = changes.filter((c) => c.type === 'new').length;
  const updateCount = changes.filter((c) => c.type === 'update').length;

  return {
    changes,
    summary: `Parsed ${csvProductCount} products from CSV. Found ${newCount} new, ${updateCount} updates. Skipped ${skippedCount} rows (empty or invalid).`,
  };
}

// Helper: Parse a single CSV row (handles quoted fields)
function parseCSVRow(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

// Helper: Normalize product name for matching
function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '') // Remove special chars
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim();
}

// Helper: Parse price string (handles currency symbols, commas)
function parsePrice(priceStr: string): number {
  const cleaned = priceStr
    .replace(/[₦$€£¥,\s]/g, '') // Remove currency symbols and commas
    .replace(/\.(?=.*\.)/g, ''); // Keep only last decimal point
  return Number.parseFloat(cleaned) || 0;
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

    // SSRF Protection: Only allow allowed Google domains
    const allowedHosts = ['docs.google.com', 'sheets.google.com'];
    if (!allowedHosts.includes(parsedUrl.hostname)) {
      throw new Error('Invalid URL. Only Google Sheets domains are allowed.');
    }

    // Ensure HTTPS protocol
    if (parsedUrl.protocol !== 'https:') {
      throw new Error('Invalid URL. Only HTTPS URLs are allowed.');
    }

    // SSRF Protection: Build export URL completely from scratch using only validated components
    // Never use string manipulation on raw user input - only use parsed URL properties

    // Case 1: "Published to Web" URL (e.g. /d/e/.../pubhtml)
    if (parsedUrl.pathname.includes('/d/e/')) {
      // Extract the published sheet ID using regex from validated pathname
      const publishedMatch = parsedUrl.pathname.match(
        /\/d\/e\/([a-zA-Z0-9-_]+)/
      );

      if (!publishedMatch?.[1]) {
        throw new Error(
          'Invalid Google Sheets URL. Could not extract published spreadsheet ID.'
        );
      }

      const publishedId = publishedMatch[1];

      // Build URL completely from scratch - no tainted user input
      const exportUrlObj = new URL('https://docs.google.com');
      exportUrlObj.pathname = `/spreadsheets/d/e/${publishedId}/pub`;
      exportUrlObj.searchParams.set('output', 'csv');

      // Final hostname validation
      if (exportUrlObj.hostname !== 'docs.google.com') {
        throw new Error('Safety Check Failed: Invalid Hostname');
      }

      const response = await fetch(exportUrlObj.toString(), {
        method: 'GET',
        headers: { Accept: 'text/csv' },
      });

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
    }

    // Case 2: Standard Sheet URL (e.g. /d/{ID}/edit)
    // Extract spreadsheet ID using regex from validated pathname
    const match = parsedUrl.pathname.match(/\/d\/([a-zA-Z0-9-_]+)/);

    if (!match?.[1]) {
      throw new Error(
        'Invalid Google Sheets URL. Could not extract spreadsheet ID.'
      );
    }

    const spreadsheetId = match[1];

    // Build URL completely from scratch - no tainted user input
    const exportUrlObj = new URL('https://docs.google.com');
    exportUrlObj.pathname = `/spreadsheets/d/${spreadsheetId}/export`;
    exportUrlObj.searchParams.set('format', 'csv');

    // Final hostname validation
    if (exportUrlObj.hostname !== 'docs.google.com') {
      throw new Error('Safety Check Failed: Invalid Hostname');
    }

    const response = await fetch(exportUrlObj.toString(), {
      method: 'GET',
      headers: { Accept: 'text/csv' },
    });

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
