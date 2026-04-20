/**
 * VPS worker: push-receipts
 * Replaces /api/cron/push-receipts running on Vercel.
 * Runs directly against Supabase + Expo — no Vercel Fluid Compute charge.
 *
 * Required env vars (set in /home/bassey/baci-workers/.env):
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   EXPO_ACCESS_TOKEN  (optional but recommended)
 *
 * Crontab: 0,30 * * * * /usr/bin/node /home/bassey/baci-workers/jobs/push-receipts.mjs >> /home/bassey/baci-workers/logs/push-receipts.log 2>&1
 */

import { Expo } from 'expo-server-sdk';
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

config({ path: new URL('../.env', import.meta.url).pathname });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('[push-receipts] Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false },
});

const expo = new Expo({ accessToken: process.env.EXPO_ACCESS_TOKEN });

// Fetch pending tickets older than 15 minutes
const { data: pendingTickets, error: fetchError } = await supabase
  .from('push_notification_tickets')
  .select('id, ticket_id, push_token')
  .eq('status', 'pending')
  .lt('created_at', new Date(Date.now() - 15 * 60 * 1000).toISOString())
  .limit(1000);

if (fetchError) {
  console.error('[push-receipts] Failed to fetch pending tickets:', fetchError);
  process.exit(1);
}

if (!pendingTickets || pendingTickets.length === 0) {
  const { error: cleanupError } = await supabase.rpc('cleanup_old_push_tickets');
  if (cleanupError) console.error('[push-receipts] Cleanup RPC failed:', cleanupError);
  console.log('[push-receipts] No pending tickets — cleaned up.');
  process.exit(0);
}

const ticketMap = new Map(pendingTickets.map((t) => [t.ticket_id, t]));
const receiptIds = pendingTickets.map((t) => t.ticket_id);
const chunks = expo.chunkPushNotificationReceiptIds(receiptIds);

const deliveredIds = [];
const failedTickets = [];
const tokensToDeactivate = [];
let chunkFailures = 0;

for (const chunk of chunks) {
  try {
    const receipts = await expo.getPushNotificationReceiptsAsync(chunk);
    for (const [receiptId, receipt] of Object.entries(receipts)) {
      const ticket = ticketMap.get(receiptId);
      if (!ticket) continue;

      if (receipt.status === 'ok') {
        deliveredIds.push(ticket.id);
      } else {
        failedTickets.push({
          id: ticket.id,
          error_type: receipt.details?.error ?? null,
          error_message: receipt.message ?? null,
        });
        if (receipt.details?.error === 'DeviceNotRegistered' && ticket.push_token) {
          tokensToDeactivate.push(ticket.push_token);
        }
      }
    }
  } catch (err) {
    chunkFailures++;
    console.error('[push-receipts] Receipt chunk failed:', err, 'chunkSize:', chunk.length);
  }
}

if (chunkFailures === chunks.length && chunks.length > 0) {
  console.error('[push-receipts] All receipt chunks failed — aborting without marking tickets');
  process.exit(1);
}

if (deliveredIds.length > 0) {
  const { error } = await supabase
    .from('push_notification_tickets')
    .update({ status: 'delivered', checked_at: new Date().toISOString() })
    .in('id', deliveredIds);
  if (error) console.error('[push-receipts] Failed to batch-update delivered tickets:', error);
}

// Batch failed-ticket updates in parallel (50 at a time) to avoid O(N) sequential round-trips
const BATCH_SIZE = 50;
const checkedAt = new Date().toISOString();
for (let i = 0; i < failedTickets.length; i += BATCH_SIZE) {
  const batch = failedTickets.slice(i, i + BATCH_SIZE);
  await Promise.all(
    batch.map(async (ft) => {
      const { error } = await supabase
        .from('push_notification_tickets')
        .update({ status: 'failed', error_type: ft.error_type, error_message: ft.error_message, checked_at: checkedAt })
        .eq('id', ft.id);
      if (error) console.error('[push-receipts] Failed to mark ticket failed:', ft.id, error);
    }),
  );
}

if (tokensToDeactivate.length > 0) {
  const { error } = await supabase
    .from('push_tokens')
    .update({ is_active: false })
    .in('token', tokensToDeactivate);
  if (error) console.error('[push-receipts] Failed to deactivate tokens:', error);
}

const { error: cleanupError } = await supabase.rpc('cleanup_old_push_tickets');
if (cleanupError) console.error('[push-receipts] Cleanup RPC failed:', cleanupError);

console.log(`[push-receipts] Done — checked=${pendingTickets.length}, delivered=${deliveredIds.length}, failed=${failedTickets.length}, chunkFailures=${chunkFailures}`);
