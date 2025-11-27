import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';

interface CSVRow {
  name: string;
  description?: string;
  price: string;
  stock_quantity?: string;
  category?: string;
  sku?: string;
  status?: string;
}

/**
 * Parse CSV content into an array of row objects keyed by header names.
 *
 * Handles quoted fields (commas inside quotes are preserved), trims surrounding quotes and whitespace, ignores empty lines, and returns an empty array when no data rows are present.
 *
 * @param csvText - Raw CSV text to parse
 * @returns An array of `CSVRow` objects where each object's keys come from the CSV header row and values are the corresponding cell values
 */
function parseCSV(csvText: string): CSVRow[] {
  const lines = csvText.split('\n').filter(line => line.trim());
  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
  const rows: CSVRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values: string[] = [];
    let currentValue = '';
    let insideQuotes = false;

    for (let char of lines[i]) {
      if (char === '"') {
        insideQuotes = !insideQuotes;
      } else if (char === ',' && !insideQuotes) {
        values.push(currentValue.trim());
        currentValue = '';
      } else {
        currentValue += char;
      }
    }
    values.push(currentValue.trim());

    const row: Record<string, string> = {};
    headers.forEach((header, index) => {
      row[header] = (values[index] || '').replace(/^"|"$/g, '');
    });

    rows.push(row as unknown as CSVRow);
  }

  return rows;
}

/**
 * Create a URL-friendly unique slug for a product name.
 *
 * @param name - The source name to convert into a slug
 * @param index - A numeric suffix used to help ensure uniqueness when generating multiple slugs for the same name
 * @returns A URL-friendly slug string with appended uniqueness components
 */
function generateSlug(name: string, index: number): string {
  const baseSlug = name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();

  return `${baseSlug}-${Date.now()}-${index}`;
}

/**
 * Handle a CSV file upload and bulk-import products for the authenticated user's merchant.
 *
 * Reads a multipart form `file` (CSV), parses rows, validates required fields, creates product
 * records linked to the authenticated merchant, and returns an import summary.
 *
 * Returns JSON with import results and may respond with appropriate HTTP status codes for
 * authentication, missing merchant, missing file, invalid CSV rows, or server errors.
 *
 * @returns An object with `success` (number of inserted products), `failed` (number of rows that failed),
 * and `errors` (array of row-specific error messages). HTTP error responses use standard status codes:
 * 401 for unauthorized, 404 for merchant not found, 400 for bad input (e.g., no file or no valid rows),
 * and 500 for internal server errors.
 */
export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    // Auth check
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get merchant
    const { data: merchant, error: merchantError } = await supabase
      .from('merchants')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (merchantError || !merchant) {
      return NextResponse.json({ error: 'Merchant not found' }, { status: 404 });
    }

    // Parse form data
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Read CSV file
    const csvText = await file.text();
    const rows = parseCSV(csvText);

    if (rows.length === 0) {
      return NextResponse.json({ error: 'No valid rows found in CSV' }, { status: 400 });
    }

    // Import products
    let successCount = 0;
    let failedCount = 0;
    const errors: string[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];

      try {
        // Validate required fields
        if (!row.name || !row.price) {
          errors.push(`Row ${i + 2}: Missing name or price`);
          failedCount++;
          continue;
        }

        const price = parseFloat(row.price);
        if (isNaN(price) || price < 0) {
          errors.push(`Row ${i + 2}: Invalid price value`);
          failedCount++;
          continue;
        }

        const stockQuantity = row.stock_quantity ? parseInt(row.stock_quantity, 10) : null;
        if (stockQuantity !== null && (isNaN(stockQuantity) || stockQuantity < 0)) {
          errors.push(`Row ${i + 2}: Invalid stock quantity`);
          failedCount++;
          continue;
        }

        // Create product
        const productData = {
          merchant_id: merchant.id,
          name: row.name,
          description: row.description || '',
          price,
          stock_quantity: stockQuantity,
          category: row.category || null,
          sku: row.sku || null,
          status: row.status === 'draft' ? 'draft' : 'active',
          slug: generateSlug(row.name, i),
          images: [],
        };

        const { error: insertError } = await supabase
          .from('products')
          .insert(productData);

        if (insertError) {
          errors.push(`Row ${i + 2}: ${insertError.message}`);
          failedCount++;
        } else {
          successCount++;
        }
      } catch (error) {
        errors.push(`Row ${i + 2}: ${(error as Error).message}`);
        failedCount++;
      }
    }

    return NextResponse.json({
      success: successCount,
      failed: failedCount,
      errors,
    });
  } catch (error) {
    console.error('Bulk import error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: (error as Error).message },
      { status: 500 }
    );
  }
}