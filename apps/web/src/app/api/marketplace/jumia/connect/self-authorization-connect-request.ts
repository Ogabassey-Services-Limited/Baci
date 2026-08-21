import crypto from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import type { z } from 'zod';
import { jumiaAuthorizationCrypto } from '@/lib/jumia/authorization-crypto';
import { JumiaApiError } from '@/lib/jumia/jumia-api-error';
import { buildExistingJumiaShopIds } from '@/lib/jumia/jumia-shop-connection-identity';
import { validateJumiaSelfAuthorization } from '@/lib/jumia/self-authorization';
import {
  consumeJumiaSelfAuthorizationDiscovery,
  createJumiaSelfAuthorizationDiscovery,
  loadJumiaSelfAuthorizationDiscovery,
} from '@/lib/jumia/self-authorization-discovery-store';
import { logger } from '@/lib/logger';
import type {
  jumiaSelfAuthorizationDiscoverySchema,
  jumiaSelfAuthorizationSelectionSchema,
} from '@/schemas/jumia/self-authorization';
import { jumiaSelfAuthorizationHandler } from './self-authorization-handler';

type DiscoveryBody = z.infer<typeof jumiaSelfAuthorizationDiscoverySchema>;
type SelectionBody = z.infer<typeof jumiaSelfAuthorizationSelectionSchema> & {
  connectionType: 'self_authorization';
};

async function loadExistingJumiaShopIds(
  supabase: SupabaseClient,
  merchantId: string
): Promise<Set<string>> {
  const { data: existing, error: existingError } = await supabase
    .from('marketplace_integrations')
    .select('shop_id, country_code, marketplace_key, connection_method')
    .eq('merchant_id', merchantId)
    .eq('platform', 'jumia')
    .eq('is_active', true);
  if (existingError) {
    throw new Error('Failed to load existing Jumia shops');
  }
  return buildExistingJumiaShopIds(existing ?? []);
}

export async function handleJumiaSelfAuthorizationConnectRequest(args: {
  body: DiscoveryBody | SelectionBody;
  encryptionKey: string;
  merchantId: string;
  supabase: SupabaseClient;
}): Promise<NextResponse> {
  const { body, encryptionKey, merchantId, supabase } = args;

  try {
    if ('operation' in body && body.operation === 'discover') {
      let existingShopIds: Set<string>;
      try {
        existingShopIds = await loadExistingJumiaShopIds(supabase, merchantId);
      } catch (error) {
        console.error('[Jumia Connect] Failed to load existing shops:', error);
        return NextResponse.json(
          { error: 'Failed to load existing Jumia shops' },
          { status: 503 }
        );
      }
      const validated = await validateJumiaSelfAuthorization({
        clientId: body.clientId,
        refreshToken: body.refreshToken,
      });
      const clientKeyHash = crypto
        .createHash('sha256')
        .update(body.clientId)
        .digest('hex');
      const discoveryId = await createJumiaSelfAuthorizationDiscovery(
        supabase,
        {
          merchantId,
          clientKeyHash,
          credentialCiphertext: jumiaAuthorizationCrypto.encrypt(
            validated.credentials,
            encryptionKey,
            jumiaAuthorizationCrypto.buildAuthorizationContext(
              merchantId,
              clientKeyHash
            )
          ),
        }
      );
      return jumiaSelfAuthorizationHandler.discover({
        credentials: {
          clientId: body.clientId,
          refreshToken: body.refreshToken,
        },
        discoveryId,
        existingShopIds,
        validate: async () => validated,
      });
    }

    if (!('discoveryId' in body)) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
    }

    let existingShopIds: Set<string>;
    try {
      existingShopIds = await loadExistingJumiaShopIds(supabase, merchantId);
    } catch (error) {
      console.error('[Jumia Connect] Failed to load existing shops:', error);
      return NextResponse.json(
        { error: 'Failed to load existing Jumia shops' },
        { status: 503 }
      );
    }

    const clientKeyHash = crypto
      .createHash('sha256')
      .update(body.clientId)
      .digest('hex');
    const credentialCiphertext = await loadJumiaSelfAuthorizationDiscovery(
      supabase,
      {
        discoveryId: body.discoveryId,
        merchantId,
        clientKeyHash,
      }
    );
    if (!credentialCiphertext) {
      return NextResponse.json(
        { error: 'Jumia shop discovery expired or is no longer valid' },
        { status: 400 }
      );
    }
    const storedCredentials = jumiaAuthorizationCrypto.decrypt(
      credentialCiphertext,
      encryptionKey,
      jumiaAuthorizationCrypto.buildAuthorizationContext(
        merchantId,
        clientKeyHash
      )
    );
    const response = await jumiaSelfAuthorizationHandler.connect({
      credentials: {
        clientId: storedCredentials.clientId,
        refreshToken: storedCredentials.refreshToken,
      },
      encryptionKey,
      merchantId,
      existingShopIds,
      rpc: async (name, rpcArgs) => supabase.rpc(name, rpcArgs),
      selectedShopIds: body.selectedShopIds,
      validate: validateJumiaSelfAuthorization,
      encrypt: jumiaAuthorizationCrypto.encrypt,
    });
    if (response.ok) {
      try {
        await consumeJumiaSelfAuthorizationDiscovery(supabase, {
          discoveryId: body.discoveryId,
          merchantId,
          clientKeyHash,
        });
      } catch (cleanupError) {
        logger.warn({
          message:
            'Jumia self-authorization connect succeeded but discovery cleanup failed',
          error: cleanupError,
          discovery_id: body.discoveryId,
          merchant_id: merchantId,
        });
      }
    }
    return response;
  } catch (error) {
    if (error instanceof JumiaApiError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }
    throw error;
  }
}
