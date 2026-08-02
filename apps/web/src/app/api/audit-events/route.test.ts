import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  createClientMock,
  getMerchantForApiRequestMock,
  noStoreMock,
  rpcMock,
  getUserMock,
} = vi.hoisted(() => ({
  createClientMock: vi.fn(),
  getMerchantForApiRequestMock: vi.fn(),
  getUserMock: vi.fn(),
  noStoreMock: vi.fn(),
  rpcMock: vi.fn(),
}));

vi.mock('next/cache', () => ({
  unstable_noStore: noStoreMock,
}));

vi.mock('@/lib/get-merchant-for-api-request', () => ({
  getMerchantForApiRequest: getMerchantForApiRequestMock,
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: createClientMock,
}));

import { GET } from './route';
import { createAuditEvent } from './route.test-support';

const MERCHANT_ID = '550e8400-e29b-41d4-a716-446655440000';
const OTHER_MERCHANT_ID = '4d1d1d1d-1111-4222-8333-444444444444';

function request(query: string) {
  return new NextRequest(`http://localhost/api/audit-events?${query}`);
}

function expectNoStore(response: Response) {
  expect(response.headers.get('cache-control')).toBe(
    'private, no-store, no-cache, max-age=0, must-revalidate'
  );
  expect(response.headers.get('vercel-cdn-cache-control')).toBe('no-store');
  expect(response.headers.get('cdn-cache-control')).toBe('no-store');
}

function ownerContext(merchantId = MERCHANT_ID) {
  return {
    merchantId,
    staffAccess: {
      isOwner: true,
      isStaff: false,
      permissions: { full_access: { all: true } },
      role: null,
    },
  };
}

describe('GET /api/audit-events', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createClientMock.mockResolvedValue({
      auth: { getUser: getUserMock },
      rpc: rpcMock,
    });
    getUserMock.mockResolvedValue({ data: { user: { id: 'owner-1' } } });
    getMerchantForApiRequestMock.mockResolvedValue(ownerContext());
    rpcMock.mockResolvedValue({ data: [], error: null });
  });

  it('returns 401 before merchant or RPC work when no user is authenticated', async () => {
    // Arrange
    getUserMock.mockResolvedValue({ data: { user: null } });
    // Act
    const response = await GET(request(`merchantId=${MERCHANT_ID}`));
    // Assert
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: 'Unauthorized' });
    expect(getMerchantForApiRequestMock).not.toHaveBeenCalled();
    expect(rpcMock).not.toHaveBeenCalled();
    expectNoStore(response);
  });
  it('returns 403 to staff even with settings permissions', async () => {
    // Arrange
    getMerchantForApiRequestMock.mockResolvedValue({
      merchantId: MERCHANT_ID,
      staffAccess: {
        isOwner: false,
        isStaff: true,
        permissions: { settings: { edit: true, view: true } },
        role: 'admin',
      },
    });
    // Act
    const response = await GET(request(`merchantId=${MERCHANT_ID}`));
    // Assert
    expect(response.status).toBe(403);
    expect(rpcMock).not.toHaveBeenCalled();
    expectNoStore(response);
  });
  it('returns 403 when an owner selects a different merchant', async () => {
    // Arrange
    getMerchantForApiRequestMock.mockResolvedValue(
      ownerContext(OTHER_MERCHANT_ID)
    );
    // Act
    const response = await GET(request(`merchantId=${MERCHANT_ID}`));
    // Assert
    expect(response.status).toBe(403);
    expect(getMerchantForApiRequestMock).toHaveBeenCalledWith(
      expect.anything(),
      'owner-1',
      { requestedMerchantId: MERCHANT_ID }
    );
    expect(rpcMock).not.toHaveBeenCalled();
    expectNoStore(response);
  });
  it('accepts an uppercase UUID for the selected owner merchant', async () => {
    // Arrange
    const uppercaseMerchantId = MERCHANT_ID.toUpperCase();
    getMerchantForApiRequestMock.mockResolvedValue(ownerContext(MERCHANT_ID));
    // Act
    const response = await GET(request(`merchantId=${uppercaseMerchantId}`));
    // Assert
    expect(response.status).toBe(200);
    expect(rpcMock).toHaveBeenCalledWith('list_merchant_audit_events_v1', {
      p_action: undefined,
      p_before_id: undefined,
      p_before_occurred_at: undefined,
      p_limit: 51,
      p_merchant_id: uppercaseMerchantId,
      p_resource_type: undefined,
    });
    expectNoStore(response);
  });
  it('returns 400 for a duplicate query parameter without querying data', async () => {
    // Act
    const response = await GET(
      request(`merchantId=${MERCHANT_ID}&merchantId=${MERCHANT_ID}`)
    );
    // Assert
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      code: 'invalid_audit_event_query',
      error: 'Invalid audit event query',
    });
    expect(getMerchantForApiRequestMock).not.toHaveBeenCalled();
    expect(rpcMock).not.toHaveBeenCalled();
    expectNoStore(response);
  });
  it('reads the selected owner merchant through the typed RPC projection', async () => {
    // Arrange
    const event = createAuditEvent(1);
    rpcMock.mockResolvedValue({ data: [event], error: null });
    // Act
    const response = await GET(
      request(
        `merchantId=${MERCHANT_ID}&limit=50&resourceType=merchant_feature_settings&action=merchant.feature.update`
      )
    );
    // Assert
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      events: [
        {
          action: event.action,
          actorLabel: event.actor_label,
          actorType: event.actor_type,
          actorUserId: event.actor_user_id,
          afterValues: event.after_values,
          beforeValues: event.before_values,
          changedFields: event.changed_fields,
          correlationId: event.correlation_id,
          databaseTransactionId: event.database_transaction_id,
          id: event.id,
          merchantId: event.merchant_id,
          merchantLabel: event.merchant_label,
          metadata: event.metadata,
          occurredAt: event.occurred_at,
          requestId: event.request_id,
          resourceId: event.resource_id,
          resourceType: event.resource_type,
          schemaVersion: event.schema_version,
          source: event.source,
        },
      ],
      nextCursor: null,
    });
    expect(rpcMock).toHaveBeenCalledWith('list_merchant_audit_events_v1', {
      p_action: 'merchant.feature.update',
      p_before_id: undefined,
      p_before_occurred_at: undefined,
      p_limit: 51,
      p_merchant_id: MERCHANT_ID,
      p_resource_type: 'merchant_feature_settings',
    });
    expectNoStore(response);
  });
  it('returns an empty page and a partial final page without a cursor', async () => {
    // Arrange
    const firstResponse = { data: [], error: null };
    const partialResponse = {
      data: [createAuditEvent(1), createAuditEvent(2)],
      error: null,
    };
    rpcMock
      .mockResolvedValueOnce(firstResponse)
      .mockResolvedValueOnce(partialResponse);
    // Act
    const emptyPage = await GET(request(`merchantId=${MERCHANT_ID}&limit=3`));
    const partialPage = await GET(request(`merchantId=${MERCHANT_ID}&limit=3`));
    // Assert
    await expect(emptyPage.json()).resolves.toEqual({
      events: [],
      nextCursor: null,
    });
    await expect(partialPage.json()).resolves.toMatchObject({
      events: [{ id: createAuditEvent(1).id }, { id: createAuditEvent(2).id }],
      nextCursor: null,
    });
    expectNoStore(emptyPage);
    expectNoStore(partialPage);
  });
  it('uses the last returned row as the deterministic cursor when one extra row exists', async () => {
    // Arrange
    const first = createAuditEvent(1);
    const second = createAuditEvent(10);
    const extra = createAuditEvent(3);
    rpcMock.mockResolvedValue({ data: [first, second, extra], error: null });
    // Act
    const response = await GET(request(`merchantId=${MERCHANT_ID}&limit=2`));
    // Assert
    await expect(response.json()).resolves.toMatchObject({
      events: [{ id: first.id }, { id: second.id }],
      nextCursor: {
        cursorId: second.id,
        cursorOccurredAt: '2026-07-29T12:00:10.000Z',
      },
    });
    expect(rpcMock).toHaveBeenCalledWith('list_merchant_audit_events_v1', {
      p_action: undefined,
      p_before_id: undefined,
      p_before_occurred_at: undefined,
      p_limit: 3,
      p_merchant_id: MERCHANT_ID,
      p_resource_type: undefined,
    });
    expectNoStore(response);
  });
  it('does not return email-like actor or merchant labels', async () => {
    // Arrange
    rpcMock.mockResolvedValue({
      data: [
        createAuditEvent(1, {
          actor_label: 'person@example.com',
          merchant_label: 'shop@example.com',
        }),
      ],
      error: null,
    });
    // Act
    const response = await GET(request(`merchantId=${MERCHANT_ID}`));
    // Assert
    await expect(response.json()).resolves.toMatchObject({
      events: [{ actorLabel: null, merchantLabel: null }],
    });
    expectNoStore(response);
  });
  it('returns a sanitized 500 response for a database failure', async () => {
    // Arrange
    rpcMock.mockResolvedValue({
      data: null,
      error: { code: 'PGRST001', message: 'provider-token-must-not-leak' },
    });
    // Act
    const response = await GET(request(`merchantId=${MERCHANT_ID}`));
    const responseBody = response.clone();
    // Assert
    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      code: 'audit_events_unavailable',
      error: 'Unable to load audit events',
    });
    expect(await responseBody.text()).not.toContain(
      'provider-token-must-not-leak'
    );
    expectNoStore(response);
  });
});
