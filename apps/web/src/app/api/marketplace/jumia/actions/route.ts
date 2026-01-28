import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import z from 'zod';
import { JumiaClient } from '@/lib/jumia/client';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

const ActionSchema = z.object({
  action: z.enum(['pack', 'ready_to_ship', 'print_label', 'cancel']),
  orderId: z.string(), // Jumia Order ID (UUID)
  shippingProvider: z.string().default('Jumia Services'),
  deliveryType: z.string().default('dropshipping'),
  itemIds: z.array(z.string()).optional(), // If not provided, fetches ALL items for order
});

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    // 1. Auth check
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: merchant } = await supabase
      .from('merchants')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (!merchant)
      return NextResponse.json(
        { error: 'Merchant not found' },
        { status: 403 }
      );

    // 2. Parse Body
    const body = await request.json();
    const {
      action,
      orderId,
      shippingProvider,
      deliveryType,
      itemIds: providedItemIds,
    } = ActionSchema.parse(body);

    // 3. Initialize Jumia Client
    const jumiaClient = await JumiaClient.forMerchant(merchant.id);
    if (!jumiaClient) {
      return NextResponse.json(
        { error: 'Jumia integration not found' },
        { status: 404 }
      );
    }

    // 4. Get Item IDs (if not provided)
    let targetItemIds = providedItemIds;
    if (!targetItemIds || targetItemIds.length === 0) {
      const items = await jumiaClient.getOrderItems(orderId);
      targetItemIds = items.map((i) => i.id);
    }

    if (targetItemIds.length === 0) {
      return NextResponse.json(
        { error: 'No items found for this order' },
        { status: 400 }
      );
    }

    // 5. Execute Action
    // biome-ignore lint/suspicious/noExplicitAny: Dynamic result
    let result: any = { success: true };

    switch (action) {
      case 'pack':
        await jumiaClient.packOrder(targetItemIds);
        result.message = 'Order packing status updated';
        break;

      case 'ready_to_ship':
        await jumiaClient.readyToShip(
          targetItemIds,
          deliveryType,
          shippingProvider
        );
        result.message = 'Order marked as ready to ship';
        break;

      case 'print_label': {
        const pdfBase64 = await jumiaClient.printLabel(targetItemIds);
        result = { success: true, pdf: pdfBase64 };
        break;
      }

      case 'cancel':
        // Hardcoded reason for now, UI should technically provide this
        await jumiaClient.cancelItems(
          targetItemIds,
          54,
          'Cancelled by Merchant via Baci'
        );
        result.message = 'Order items cancelled';
        break;
    }

    // 6. Update local DB status (Optimistic)
    // We update the main order status string, although item-level statuses might vary.
    // Ideally we sync immediately to get exact status, but a simple status update is good feedback.
    const adminSupabase = createAdminClient();
    if (action === 'pack') {
      await adminSupabase
        .from('jumia_orders')
        .update({ status: 'Packed' })
        .eq('jumia_order_id', orderId);
    } else if (action === 'ready_to_ship') {
      await adminSupabase
        .from('jumia_orders')
        .update({ status: 'ReadyToShip' })
        .eq('jumia_order_id', orderId);
    }

    return NextResponse.json(result);
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : 'Action failed';
    const status = (error as { status?: number })?.status || 500;

    return NextResponse.json(
      {
        error: errorMessage,
        details: error instanceof z.ZodError ? error.issues : undefined,
      },
      { status }
    );
  }
}
