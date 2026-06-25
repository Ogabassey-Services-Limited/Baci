const fs = require('fs');

let code = fs.readFileSync('apps/web/src/app/api/marketplace/jumia/orders/route.ts', 'utf-8');

// Apply the PREFETCH optimization
code = code.replace(
  /for \(const order of jumiaOrders\) \{\n\s*const customerName = getCustomerName\(order.shippingAddress\);\n\n\s*const \{ data: existingOrder, error: existingOrderError \} = await supabase\n\s*\.from\('jumia_orders'\)\n\s*\.select\('id, notification_sent'\)\n\s*\.eq\('jumia_order_id', order.id\)\n\s*\.eq\('merchant_id', merchantId\)\n\s*\.maybeSingle\(\);\n\n\s*if \(existingOrderError\) \{\n\s*logger\.error\(\{\n\s*message: 'Failed to look up existing Jumia order',\n\s*orderId: order\.id,\n\s*error: existingOrderError,\n\s*\}\);\n\s*continue;\n\s*\}/,
  `// PREFETCH: Collapse N+1 SELECTs into a single .in() query
    const jumiaOrderIds = jumiaOrders.map((o) => o.id);
    let existingOrdersMap = new Map<
      string,
      { id: string; notification_sent: boolean }
    >();

    if (jumiaOrderIds.length > 0) {
      const { data: existingOrders, error: existingOrdersError } =
        await supabase
          .from('jumia_orders')
          .select('id, jumia_order_id, notification_sent')
          .eq('merchant_id', merchantId)
          .in('jumia_order_id', jumiaOrderIds);

      if (existingOrdersError) {
        logger.error({
          message: 'Failed to prefetch existing Jumia orders',
          error: existingOrdersError,
        });
        return NextResponse.json(
          { error: 'Failed to process orders' },
          { status: 500 }
        );
      }

      if (existingOrders) {
        existingOrdersMap = new Map(
          existingOrders.map((o) => [o.jumia_order_id, o])
        );
      }
    }

    for (const order of jumiaOrders) {
      const customerName = getCustomerName(order.shippingAddress);

      const existingOrder = existingOrdersMap.get(order.id);`
);

// Apply the upsert/update optimization
code = code.replace(
  /const \{ error: upsertError \} = await supabase\n\s*\.from\('jumia_orders'\)\n\s*\.upsert\(upsertPayload, \{ onConflict: 'jumia_order_id' \}\);/,
  `let upsertError: { message: string } | null = null;
      if (!isNewOrder && existingOrder) {
        const { error } = await supabase
          .from('jumia_orders')
          .update(upsertPayload)
          .eq('jumia_order_id', order.id)
          .eq('merchant_id', merchantId);
        upsertError = error;
      } else {
        const { error } = await supabase
          .from('jumia_orders')
          .upsert(upsertPayload, { onConflict: 'jumia_order_id' });
        upsertError = error;
      }`
);

fs.writeFileSync('apps/web/src/app/api/marketplace/jumia/orders/route.ts', code);
