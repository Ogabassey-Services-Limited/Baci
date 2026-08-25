import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';
import { parseRequestedMerchantId } from '@/app/api/branches/branch-route-utils';
import { hasPermission } from '@/lib/api-auth';
import {
  getMerchantForApiRequest,
  toUserAccess,
} from '@/lib/get-merchant-for-api-request';
import { getEffectiveStock } from '@/lib/product-stock';
import { createClient } from '@/lib/supabase/server';
import { analyticsDashboardSpecializedSchemas } from '@/schemas/analytics-dashboard-specialized';

/**
 * Inventory Forecasting API
 *
 * GET - Get inventory forecasts for all products or specific products
 *
 * Query params:
 * - productId: string (optional, get forecast for single product)
 * - lowStockOnly: boolean (default false, only show low stock items)
 * - page: number
 * - limit: number
 */

interface ForecastResult {
  productId: string;
  productName: string;
  image: string | null;
  currentStock: number;
  lowStockThreshold: number;
  avgDailySales: number;
  daysOfStock: number;
  predictedStockoutDate: string | null;
  reorderQuantity: number;
  salesTrend: 'increasing' | 'decreasing' | 'stable';
  status: 'healthy' | 'warning' | 'critical' | 'out_of_stock';
}

interface ForecastData {
  current_stock: number;
  avg_daily_sales: number;
  days_of_stock: number;
  predicted_stockout_date: string | null;
  reorder_quantity: number;
  sales_trend: 'increasing' | 'decreasing' | 'stable';
}

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const parsedQuery =
      analyticsDashboardSpecializedSchemas.inventoryForecastQuery.safeParse({
        limit: searchParams.get('limit') ?? undefined,
        lowStockOnly: searchParams.get('lowStockOnly') ?? undefined,
        page: searchParams.get('page') ?? undefined,
        productId: searchParams.get('productId') ?? undefined,
      });
    if (!parsedQuery.success) {
      return NextResponse.json({ error: 'Invalid query' }, { status: 400 });
    }

    const requestedMerchant = parseRequestedMerchantId(request);
    if (requestedMerchant.response) {
      return requestedMerchant.response;
    }

    const merchantContext = await getMerchantForApiRequest(supabase, user.id, {
      requestedMerchantId: requestedMerchant.merchantId,
    });
    if (!merchantContext) {
      return NextResponse.json(
        { error: 'Merchant not found' },
        { status: 404 }
      );
    }
    const merchantId = merchantContext.merchantId;
    if (!hasPermission(toUserAccess(merchantContext), 'products', 'view')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const { limit, lowStockOnly, page, productId } = parsedQuery.data;
    const offset = (page - 1) * limit;

    // If specific product requested
    if (productId) {
      const { data: forecastRaw, error } = await supabase
        .rpc('calculate_inventory_forecast', {
          p_merchant_id: merchantId,
          p_product_id: productId,
          p_variant_id: null,
        })
        .single();

      if (error) {
        console.error('Error calculating forecast:', error);
        return NextResponse.json(
          { error: 'Failed to calculate forecast' },
          { status: 500 }
        );
      }

      const forecast = forecastRaw as ForecastData | null;

      const { data: product } = await supabase
        .from('products')
        .select('id, name, image, low_stock_threshold')
        .eq('id', productId)
        .single();

      return NextResponse.json({
        forecast: {
          productId,
          productName: product?.name || 'Unknown',
          image: product?.image,
          currentStock: forecast?.current_stock || 0,
          lowStockThreshold: product?.low_stock_threshold || 5,
          avgDailySales: forecast?.avg_daily_sales || 0,
          daysOfStock: forecast?.days_of_stock || 0,
          predictedStockoutDate: forecast?.predicted_stockout_date,
          reorderQuantity: forecast?.reorder_quantity || 0,
          salesTrend: forecast?.sales_trend || 'stable',
          status: getStockStatus(
            forecast?.current_stock || 0,
            forecast?.days_of_stock ?? null,
            product?.low_stock_threshold || 5
          ),
        },
      });
    }

    // Get all products with managed stock
    let query = supabase
      .from('products')
      .select('id, name, image, stock, stock_quantity, low_stock_threshold', {
        count: 'exact',
      })
      .eq('merchant_id', merchantId)
      .eq('status', 'active')
      .eq('manage_stock', true)
      .order('stock', { ascending: true })
      .order('id', { ascending: true });

    if (lowStockOnly) {
      query = query.or('stock.lte.10,stock_quantity.lte.10');
    }

    const {
      data: products,
      error: productsError,
      count,
    } = await query.range(offset, offset + limit - 1);

    if (productsError) {
      console.error('Error fetching products:', productsError);
      return NextResponse.json(
        { error: 'Failed to fetch products' },
        { status: 500 }
      );
    }

    // Calculate forecast for each product
    const forecasts: ForecastResult[] = [];
    for (const product of products || []) {
      const { data: forecastRaw } = await supabase
        .rpc('calculate_inventory_forecast', {
          p_merchant_id: merchantId,
          p_product_id: product.id,
          p_variant_id: null,
        })
        .single();

      const forecast = forecastRaw as ForecastData | null;
      const daysOfStock = forecast?.days_of_stock ?? 999;
      const currentStock =
        forecast?.current_stock ??
        getEffectiveStock(
          product as {
            stock?: number | string | null;
            stock_quantity?: number | string | null;
          }
        );
      const status = getStockStatus(
        currentStock,
        daysOfStock,
        product.low_stock_threshold || 5
      );

      // If lowStockOnly, filter out healthy items
      if (lowStockOnly && status === 'healthy') {
        continue;
      }

      forecasts.push({
        productId: product.id,
        productName: product.name,
        image: product.image,
        currentStock,
        lowStockThreshold: product.low_stock_threshold || 5,
        avgDailySales: forecast?.avg_daily_sales || 0,
        daysOfStock: daysOfStock,
        predictedStockoutDate: forecast?.predicted_stockout_date ?? null,
        reorderQuantity: forecast?.reorder_quantity || 0,
        salesTrend: forecast?.sales_trend || 'stable',
        status,
      });
    }

    // Sort by days of stock (most urgent first)
    forecasts.sort((a, b) => a.daysOfStock - b.daysOfStock);

    // Calculate summary stats
    const summary = {
      totalProducts: count || 0,
      outOfStock: forecasts.filter((f) => f.status === 'out_of_stock').length,
      critical: forecasts.filter((f) => f.status === 'critical').length,
      warning: forecasts.filter((f) => f.status === 'warning').length,
      healthy: forecasts.filter((f) => f.status === 'healthy').length,
    };

    return NextResponse.json({
      forecasts,
      summary,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
    });
  } catch (error) {
    console.error('Inventory forecast error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

function getStockStatus(
  stock: number,
  daysOfStock: number | null,
  threshold: number
): 'healthy' | 'warning' | 'critical' | 'out_of_stock' {
  if (stock <= 0) return 'out_of_stock';
  if (stock <= threshold || (daysOfStock !== null && daysOfStock <= 7))
    return 'critical';
  if (daysOfStock !== null && daysOfStock <= 14) return 'warning';
  return 'healthy';
}
