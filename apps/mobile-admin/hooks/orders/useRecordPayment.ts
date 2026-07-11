import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRef } from 'react';
import { BASE_URL } from '@/lib/api-client';
import { asyncStorage as AsyncStorage } from '@/lib/storage';
import { safeParseJSON } from '@/lib/validators/storage';
import {
  type ManualPaymentRetry,
  manualPaymentRetrySchema,
} from '@/schemas/manual-payment-retry';
import { generateUUID } from '@/utils/uuid';
import { useMerchant } from '../useMerchant';
import { createAuthenticatedFetch } from './authenticated-fetch';
import { parseResponsePayload } from './response-utils';

const RECORD_PAYMENT_TIMEOUT_MS = 15_000;
const RECORD_PAYMENT_RETRY_KEY_PREFIX = 'manual-payment-retry:';
const RECORD_PAYMENT_RETRY_LEASE_MS = 5 * 60 * 1000;

interface PendingIdempotencyKey {
  createdAt: number;
  idempotencyKey: string;
}

export function useRecordPayment() {
  const queryClient = useQueryClient();
  const { merchant } = useMerchant();
  const pendingIdempotencyKeys = useRef(
    new Map<string, PendingIdempotencyKey>()
  );

  return useMutation({
    mutationFn: async ({
      orderId,
      amount,
      paymentMethod,
      reference,
      notes,
    }: {
      amount: number;
      notes?: string;
      orderId: string;
      paymentMethod: string;
      reference?: string;
    }) => {
      const requestFingerprint = JSON.stringify({
        amount,
        orderId,
        reference: reference?.trim() || null,
      });
      const storageKey = `${RECORD_PAYMENT_RETRY_KEY_PREFIX}${orderId}:${encodeURIComponent(requestFingerprint)}`;
      let storedRetry: ManualPaymentRetry | null = null;
      try {
        storedRetry = safeParseJSON(
          await AsyncStorage.getItem(storageKey),
          manualPaymentRetrySchema.nullable(),
          null
        );
      } catch (error) {
        console.error('Failed to read manual payment retry key', error);
      }
      const now = Date.now();
      const memoryRetry = pendingIdempotencyKeys.current.get(requestFingerprint);
      const isFresh = (createdAt: number) => {
        const age = now - createdAt;
        return createdAt > 0 && age >= 0 && age < RECORD_PAYMENT_RETRY_LEASE_MS;
      };
      const reusableRetry =
        memoryRetry && isFresh(memoryRetry.createdAt)
          ? memoryRetry
          : storedRetry?.fingerprint === requestFingerprint &&
              storedRetry.status === 'pending' &&
              isFresh(storedRetry.createdAt)
            ? storedRetry
            : null;
      const idempotencyKey = reusableRetry?.idempotencyKey ?? generateUUID();
      const createdAt = reusableRetry?.createdAt ?? now;
      pendingIdempotencyKeys.current.set(requestFingerprint, {
        createdAt,
        idempotencyKey,
      });
      try {
        await AsyncStorage.setItem(
          storageKey,
          JSON.stringify({
            createdAt,
            fingerprint: requestFingerprint,
            idempotencyKey,
            status: 'pending',
          })
        );
      } catch (error) {
        console.error('Failed to persist manual payment retry key', error);
      }

      const response = await createAuthenticatedFetch(
        `${BASE_URL}/api/orders/${orderId}/record-payment`,
        {
          body: JSON.stringify({
            amount,
            idempotency_key: idempotencyKey,
            notes: notes?.trim() || undefined,
            payment_method: paymentMethod,
            reference: reference?.trim() || undefined,
          }),
          headers: {
            'Content-Type': 'application/json',
          },
          method: 'POST',
        },
        RECORD_PAYMENT_TIMEOUT_MS
      );

      if (!response.ok) {
        const responseText = await response.text();
        const payload = parseResponsePayload(responseText);
        const errorMessage =
          payload &&
          typeof payload === 'object' &&
          typeof payload.error === 'string'
            ? payload.error
            : responseText ||
              `Request failed: ${response.status} ${response.statusText}`;
        throw new Error(errorMessage);
      }

      const result = await response.json();
      pendingIdempotencyKeys.current.delete(requestFingerprint);
      try {
        await AsyncStorage.setItem(
          storageKey,
          JSON.stringify({
            createdAt,
            fingerprint: requestFingerprint,
            idempotencyKey,
            status: 'completed',
          })
        );
      } catch (error) {
        console.error(
          'Failed to mark manual payment retry key completed',
          error
        );
      }
      try {
        await AsyncStorage.removeItem(storageKey);
      } catch (error) {
        console.error('Failed to clear manual payment retry key', error);
      }
      return result;
    },
    mutationKey: ['recordPayment'],
    onSuccess: (_data, { orderId }) => {
      queryClient.invalidateQueries({ queryKey: ['order', orderId] });
      queryClient.invalidateQueries({ queryKey: ['orders', merchant?.id] });
      queryClient.invalidateQueries({
        queryKey: ['order-counts', merchant?.id],
      });
      queryClient.invalidateQueries({
        queryKey: ['dashboard-stats', merchant?.id],
      });
    },
  });
}
