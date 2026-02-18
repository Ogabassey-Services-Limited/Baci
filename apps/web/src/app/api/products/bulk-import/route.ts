import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';
import { hasPermission } from '@/lib/api-auth';
import { revalidateProducts } from '@/lib/cache-revalidation';
import {
  getMerchantForApiRequest,
  toUserAccess,
} from '@/lib/get-merchant-for-api-request';
import { generateProductSlug } from '@/lib/seo-utils';
import { createClient } from '@/lib/supabase/server';

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
 * Parse CSV text into rows
 */
function parseCSV(csvText: string): CSVRow[] {
  const lines = csvText.split('\n').filter((line) => line.trim());
  if (lines.length < 2) return [];

  const headers = lines[0]
    .split(',')
    .map((h) => h.trim().replace(/^"|"$/g, ''));
  const rows: CSVRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values: string[] = [];
    let currentValue = '';
    let insideQuotes = false;

    for (const char of lines[i]) {
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
 * POST /api/products/bulk-import
 * Bulk import products from CSV file
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

    // Get merchant (supports both owners and staff members)
    const merchantContext = await getMerchantForApiRequest(supabase, user.id);
    if (!merchantContext) {
      return NextResponse.json(
        { error: 'Merchant not found' },
        { status: 404 }
      );
    }
    const access = toUserAccess(merchantContext);
    if (!hasPermission(access, 'products', 'create')) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
    }
    const merchantId = merchantContext.merchantId;

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
      return NextResponse.json(
        { error: 'No valid rows found in CSV' },
        { status: 400 }
      );
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

        const price = Number.parseFloat(row.price);
        if (Number.isNaN(price) || price < 0) {
          errors.push(`Row ${i + 2}: Invalid price value`);
          failedCount++;
          continue;
        }

        const stockQuantity = row.stock_quantity
          ? Number.parseInt(row.stock_quantity, 10)
          : null;
        if (
          stockQuantity !== null &&
          (Number.isNaN(stockQuantity) || stockQuantity < 0)
        ) {
          errors.push(`Row ${i + 2}: Invalid stock quantity`);
          failedCount++;
          continue;
        }

        // Create product - use generateProductSlug for consistency with other routes
        const productData = {
          merchant_id: merchantId,
          name: row.name,
          description: row.description || '',
          base_price: price,
          quantity: stockQuantity,
          track_quantity: stockQuantity !== null,
          category: row.category || null,
          sku: row.sku || null,
          status: row.status === 'draft' ? 'draft' : 'active',
          slug: generateProductSlug(row.name),
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

    // Invalidate product caches after bulk import
    if (successCount > 0) {
      revalidateProducts(merchantId);
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
