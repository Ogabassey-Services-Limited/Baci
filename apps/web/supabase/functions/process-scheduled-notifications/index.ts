// Supabase Edge Function: Process Scheduled Notifications
// This function runs on a cron schedule (every minute) to process scheduled notifications
// and send them to the targeted merchants.

import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';

interface Notification {
  id: string;
  title: string;
  message: string;
  notification_type: string;
  priority: string;
  target_type: string;
  target_merchant_ids: string[];
  target_segment: string | null;
  channels: string[];
  action_url: string | null;
  action_label: string | null;
  scheduled_for: string;
  created_at: string;
}

interface Merchant {
  id: string;
}

Deno.serve(async (req: Request) => {
  try {
    // Verify this is being called by Supabase's cron or has proper auth
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Create Supabase client with service role for admin operations
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase environment variables');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Find notifications that are scheduled and ready to send
    const now = new Date().toISOString();
    const { data: scheduledNotifications, error: fetchError } = await supabase
      .from('notifications')
      .select('*')
      .is('sent_at', null)
      .not('scheduled_for', 'is', null)
      .lte('scheduled_for', now)
      .order('scheduled_for', { ascending: true })
      .limit(10); // Process up to 10 notifications per run

    if (fetchError) {
      throw new Error(
        `Failed to fetch scheduled notifications: ${fetchError.message}`
      );
    }

    if (!scheduledNotifications || scheduledNotifications.length === 0) {
      return new Response(
        JSON.stringify({
          message: 'No scheduled notifications to process',
          processed: 0,
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    const results = [];

    for (const notification of scheduledNotifications as Notification[]) {
      try {
        // Get merchant IDs based on target type
        let merchantIds: string[] = [];

        if (notification.target_type === 'all') {
          const { data: merchants } = await supabase
            .from('merchants')
            .select('id')
            .not('user_id', 'is', null);

          merchantIds = (merchants || []).map((m: Merchant) => m.id);
        } else if (notification.target_type === 'specific') {
          merchantIds = notification.target_merchant_ids || [];
        } else if (notification.target_type === 'segment') {
          merchantIds = await getSegmentMerchantIds(
            supabase,
            notification.target_segment
          );
        }

        if (merchantIds.length === 0) {
          // No merchants to notify, mark as sent anyway
          await supabase
            .from('notifications')
            .update({ sent_at: now })
            .eq('id', notification.id);

          results.push({
            id: notification.id,
            status: 'sent',
            merchants: 0,
            message: 'No merchants matched the target criteria',
          });
          continue;
        }

        // Create merchant_notifications records
        const merchantNotifications = merchantIds.map((merchantId: string) => ({
          notification_id: notification.id,
          merchant_id: merchantId,
        }));

        const { error: insertError } = await supabase
          .from('merchant_notifications')
          .insert(merchantNotifications)
          .select();

        if (insertError) {
          console.error('Error inserting merchant notifications', {
            error: insertError.message,
          });
          // Continue anyway - some might have been inserted
        }

        // Update notification as sent
        await supabase
          .from('notifications')
          .update({ sent_at: now })
          .eq('id', notification.id);

        // Broadcast to connected merchants via Realtime
        const channel = supabase.channel('notifications:global');

        await channel.send({
          type: 'broadcast',
          event: 'new_notification',
          payload: {
            event: 'new_notification',
            notification: {
              id: notification.id,
              title: notification.title,
              message: notification.message,
              notification_type: notification.notification_type,
              priority: notification.priority,
              channels: notification.channels,
              action_url: notification.action_url,
              action_label: notification.action_label,
            },
            target_merchant_ids: merchantIds,
            created_at: notification.created_at,
          },
        });

        await supabase.removeChannel(channel);

        results.push({
          id: notification.id,
          status: 'sent',
          merchants: merchantIds.length,
        });
      } catch (notificationError) {
        console.error('Error processing notification', {
          notificationId: notification.id,
          error:
            notificationError instanceof Error
              ? notificationError.message
              : notificationError,
        });
        results.push({
          id: notification.id,
          status: 'error',
          error:
            notificationError instanceof Error
              ? notificationError.message
              : 'Unknown error',
        });
      }
    }

    return new Response(
      JSON.stringify({
        message: `Processed ${results.length} scheduled notifications`,
        processed: results.length,
        results,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in process-scheduled-notifications:', error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
});

/**
 * Get merchant IDs for a specific segment
 */
async function getSegmentMerchantIds(
  supabase: ReturnType<typeof createClient>,
  segment: string | null
): Promise<string[]> {
  if (!segment) return [];

  let query = supabase
    .from('merchants')
    .select('id')
    .not('user_id', 'is', null);

  switch (segment) {
    case 'new': {
      // Merchants created in the last 30 days
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      query = query.gte('created_at', thirtyDaysAgo.toISOString());
      break;
    }
    case 'active':
      // All active merchants (have user_id)
      // In production, you'd join with orders to find actually active ones
      break;
    case 'at_risk':
      // In production, this would use analytics to identify at-risk merchants
      // For now, return all merchants
      break;
  }

  const { data } = await query;
  return (data || []).map((m: Merchant) => m.id);
}
