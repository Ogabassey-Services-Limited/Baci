import { Expo } from 'expo-server-sdk';

export function createExpoClient() {
  if (!process.env.EXPO_ACCESS_TOKEN) {
    throw new Error('EXPO_ACCESS_TOKEN is required to create Expo client');
  }

  return new Expo({ accessToken: process.env.EXPO_ACCESS_TOKEN });
}

function readNotificationType(data) {
  return typeof data?.type === 'string' ? data.type : null;
}

function derivePushAttemptStatus(tokenCount, result) {
  if (tokenCount === 0) return 'skipped_no_tokens';
  if (result.sent > 0 && result.failed === 0 && result.errors.length === 0) {
    return 'sent';
  }
  if (result.sent > 0) return 'partial_failure';
  return 'failed';
}

async function recordPushAttempt(supabase, context) {
  const result = context.result;
  const { error } = await supabase.from('push_notification_attempts').insert({
    merchant_id: context.merchantId ?? null,
    user_id: context.userId ?? null,
    app_type: context.appType ?? 'admin',
    channel: context.channel ?? null,
    notification_type:
      context.notificationType ?? readNotificationType(context.payload),
    title: context.title,
    body: context.body,
    payload: context.payload ?? {},
    token_count: context.tokenCount,
    sent_count: result.sent,
    failed_count: result.failed,
    status: derivePushAttemptStatus(context.tokenCount, result),
    errors: result.errors,
  });

  if (error) {
    console.error('[push] Failed to store push attempt:', error);
  }
}

async function sendChunkIndividually(expo, chunk) {
  const tickets = [];

  for (const message of chunk) {
    try {
      const [ticket] = await expo.sendPushNotificationsAsync([message]);
      tickets.push(ticket);
    } catch (error) {
      tickets.push({
        status: 'error',
        message: error instanceof Error ? error.message : 'Unknown error',
        details: { error: 'ExpoError' },
      });
    }
  }

  return tickets;
}

function isMixedProjectPushError(error) {
  const message = error instanceof Error ? error.message : String(error ?? '');
  return message.includes('same request must be for the same project');
}

async function sendPushNotifications(expo, messages) {
  if (messages.length === 0) return [];

  const validMessages = [];
  const resultMap = [];

  for (let index = 0; index < messages.length; index++) {
    const message = messages[index];
    const tokens = Array.isArray(message.to) ? message.to : [message.to];
    const invalidToken = tokens.find((token) => !Expo.isExpoPushToken(token));
    if (invalidToken) {
      resultMap.push({
        index,
        ticket: {
          status: 'error',
          message: `Invalid Expo push token: ${invalidToken}`,
          details: { error: 'DeviceNotRegistered' },
        },
      });
      continue;
    }

    resultMap.push({ index });
    validMessages.push(message);
  }

  if (validMessages.length === 0) {
    return resultMap.map((entry) => entry.ticket);
  }

  const sdkTickets = [];
  for (const chunk of expo.chunkPushNotifications(validMessages)) {
    try {
      sdkTickets.push(...(await expo.sendPushNotificationsAsync(chunk)));
    } catch (error) {
      if (isMixedProjectPushError(error)) {
        sdkTickets.push(...(await sendChunkIndividually(expo, chunk)));
        continue;
      }

      for (const _message of chunk) {
        sdkTickets.push({
          status: 'error',
          message: error instanceof Error ? error.message : 'Unknown error',
          details: { error: 'ExpoError' },
        });
      }
    }
  }

  let sdkIndex = 0;
  return resultMap.map((entry) => {
    if (entry.ticket) return entry.ticket;
    const ticket = sdkTickets[sdkIndex];
    if (ticket) {
      sdkIndex++;
      return ticket;
    }

    return {
      status: 'error',
      message: `Missing Expo push ticket for message index ${entry.index}`,
      details: { error: 'ExpoTicketMissing' },
    };
  });
}

async function processTickets(supabase, tickets, tokens, context) {
  let sent = 0;
  let failed = 0;
  const errors = [];
  const tokensToDeactivate = [];
  const ticketsToStore = [];

  for (let index = 0; index < tickets.length; index++) {
    const ticket = tickets[index];
    const token = tokens[index]?.token;
    if (ticket?.status === 'ok') {
      sent++;
      ticketsToStore.push({
        ticket_id: ticket.id,
        push_token: token,
        merchant_id: context.merchantId ?? null,
        user_id: context.userId ?? null,
        app_type: context.appType ?? 'admin',
        channel: context.channel ?? null,
        notification_type: context.notificationType ?? null,
        status: 'pending',
      });
      continue;
    }

    failed++;
    if (ticket?.message) errors.push(ticket.message);
    if (ticket?.details?.error === 'DeviceNotRegistered' && token) {
      tokensToDeactivate.push(token);
    }
  }

  if (tokensToDeactivate.length > 0) {
    let tokenUpdateQuery = supabase
      .from('push_tokens')
      .update({ is_active: false });
    tokenUpdateQuery =
      context.merchantId == null
        ? tokenUpdateQuery.is('merchant_id', null)
        : tokenUpdateQuery.eq('merchant_id', context.merchantId);

    const { error } = await tokenUpdateQuery
      .eq('app_type', context.appType ?? 'admin')
      .in('token', tokensToDeactivate);
    if (error) errors.push(`Token deactivation failed: ${error.message}`);
  }

  if (ticketsToStore.length > 0) {
    const { error } = await supabase
      .from('push_notification_tickets')
      .insert(ticketsToStore);
    if (error) {
      errors.push(
        `Ticket storage failed after Expo accepted ${sent} message(s); sent count reflects Expo delivery only: ${error.message}`
      );
    }
  }

  return { sent, failed, errors };
}

/**
 * Sends an admin push notification and records one push attempt.
 * Returns string errors so callers can distinguish transport failures from the
 * no-token path, which always returns an empty errors array.
 */
export async function notifyMerchant({
  supabase,
  expo,
  merchantId,
  title,
  body,
  data,
  channelId = 'general',
}) {
  const notificationType = readNotificationType(data);
  const { data: tokens, error } = await supabase
    .from('push_tokens')
    .select('token')
    .eq('merchant_id', merchantId)
    .eq('is_active', true)
    .eq('app_type', 'admin');

  if (error) {
    const result = { sent: 0, failed: 0, errors: [error.message] };
    await recordPushAttempt(supabase, {
      merchantId,
      appType: 'admin',
      channel: channelId,
      notificationType,
      title,
      body,
      payload: data,
      tokenCount: 0,
      result,
    });
    return result;
  }

  if (!tokens || tokens.length === 0) {
    const result = { sent: 0, failed: 0, errors: [] };
    await recordPushAttempt(supabase, {
      merchantId,
      appType: 'admin',
      channel: channelId,
      notificationType,
      title,
      body,
      payload: data,
      tokenCount: 0,
      result,
    });
    return result;
  }

  const messages = tokens.map((token) => ({
    to: token.token,
    title,
    body,
    data,
    sound: 'default',
    channelId,
    priority: channelId === 'orders' ? 'high' : 'default',
  }));

  let tickets;
  try {
    tickets = await sendPushNotifications(expo, messages);
  } catch (error) {
    const result = {
      sent: 0,
      failed: tokens.length,
      errors: [
        error instanceof Error ? error.message : 'Unknown push send error',
      ],
    };
    await recordPushAttempt(supabase, {
      merchantId,
      appType: 'admin',
      channel: channelId,
      notificationType,
      title,
      body,
      payload: data,
      tokenCount: tokens.length,
      result,
    });
    return result;
  }

  let result;
  try {
    result = await processTickets(supabase, tickets, tokens, {
      merchantId,
      appType: 'admin',
      channel: channelId,
      notificationType,
    });
  } catch (error) {
    const sentCount = tickets.filter(
      (ticket) => ticket?.status === 'ok'
    ).length;
    result = {
      sent: sentCount,
      failed: tickets.length - sentCount,
      errors: [
        error instanceof Error
          ? error.message
          : 'Unknown push ticket processing error',
      ],
    };
  }

  await recordPushAttempt(supabase, {
    merchantId,
    appType: 'admin',
    channel: channelId,
    notificationType,
    title,
    body,
    payload: data,
    tokenCount: tokens.length,
    result,
  });

  return result;
}
