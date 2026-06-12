const EVENT_TYPE_MAP = {
  PURCHASE: 'purchase',
  START_CHECKOUT: 'begin_checkout',
  ADD_CART: 'add_to_cart',
  ADD_TO_CART: 'add_to_cart',
  VIEW_CONTENT: 'product_view',
  ADD_PAYMENT_INFO: 'add_payment_info',
  ADD_TO_WISHLIST: 'add_to_wishlist',
  ADD_WISHLIST: 'add_to_wishlist',
  SEARCH: 'search',
  SIGN_UP: 'customer_registered',
  COMPLETE_REGISTRATION: 'customer_registered',
  PLACE_AN_ORDER: 'place_order',
  PLACE_ORDER: 'place_order',
  purchase: 'purchase',
  begin_checkout: 'begin_checkout',
  add_to_cart: 'add_to_cart',
  product_view: 'product_view',
  add_payment_info: 'add_payment_info',
  add_to_wishlist: 'add_to_wishlist',
  search: 'search',
  customer_registered: 'customer_registered',
  place_order: 'place_order',
};

const ORIGIN_ONLY_EVENT_TYPES = new Set([
  'purchase',
  'begin_checkout',
  'add_to_cart',
  'product_view',
  'add_payment_info',
  'add_to_wishlist',
  'search',
  'customer_registered',
  'place_order',
]);

function json(body, init = {}) {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  });
}

function normalizeEventType(value) {
  return EVENT_TYPE_MAP[value] || value;
}

function addIfPresent(target, key, value) {
  if (value !== undefined) {
    target[key] = value;
  }
}

function buildEventData(body, eventType) {
  const eventData = {};

  addIfPresent(eventData, 'session_id', body.session_id);
  addIfPresent(eventData, 'user_agent', body.user_agent);
  addIfPresent(eventData, 'referrer', body.referrer);
  addIfPresent(eventData, 'page_url', body.page_url);

  if (eventType === 'page_view') {
    return eventData;
  }

  if (body.custom_data) {
    eventData.custom_data = body.custom_data;
  }

  return eventData;
}

function shouldForwardToOrigin(eventType) {
  return eventType !== 'page_view' || ORIGIN_ONLY_EVENT_TYPES.has(eventType);
}

function getForwardHeaders(request) {
  const headers = new Headers();
  const passthroughHeaders = [
    'content-type',
    'cookie',
    'user-agent',
    'x-forwarded-for',
    'x-real-ip',
    'cf-connecting-ip',
  ];

  for (const header of passthroughHeaders) {
    const value = request.headers.get(header);
    if (value) {
      headers.set(header, value);
    }
  }

  headers.set('x-baci-edge-forwarded', 'cloudflare-event-ingest-worker');
  return headers;
}

function forwardToOrigin(request, env, rawBody) {
  const originUrl = env.ORIGIN_EVENTS_URL || 'https://usebaci.com/api/events';
  return fetch(originUrl, {
    method: 'POST',
    headers: getForwardHeaders(request),
    body: rawBody,
  });
}

async function writeAnalyticsEvent(env, event) {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Supabase bindings are missing');
  }

  const headers = {
    apikey: env.SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
    'Content-Type': 'application/json',
    Prefer: 'return=minimal',
  };
  const baseUrl = env.SUPABASE_URL.replace(/\/+$/, '');
  const path = '/rest/v1/analytics_events';
  const response = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(event),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(
      `Supabase analytics insert failed with HTTP ${response.status}: ${body.slice(0, 200)}`
    );
  }
}

export async function handleEventRequest(request, env) {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204 });
  }

  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed' }, { status: 405 });
  }

  try {
    const rawBody = await request.text();
    const body = JSON.parse(rawBody);
    const inputEventType = body.event_type || body.event_name;

    if (!inputEventType || !body.merchant_id) {
      return json(
        { error: 'Missing required fields: event_type and merchant_id' },
        { status: 400 }
      );
    }

    const eventType = normalizeEventType(inputEventType);

    if (shouldForwardToOrigin(eventType)) {
      return forwardToOrigin(request, env, rawBody);
    }

    await writeAnalyticsEvent(env, {
      merchant_id: body.merchant_id,
      event_type: eventType,
      event_data: buildEventData(body, eventType),
      ...(body.event_id ? { event_id: body.event_id } : {}),
      source: body.source || 'web',
      event_timestamp: body.timestamp || new Date().toISOString(),
    });

    return json({ success: true, event_id: body.event_id });
  } catch (error) {
    console.error('Event ingest worker error:', error);
    return json({ error: 'Internal server error' }, { status: 500 });
  }
}

export default {
  fetch: handleEventRequest,
};
