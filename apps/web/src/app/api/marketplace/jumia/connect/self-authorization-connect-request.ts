import crypto from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import type { z } from 'zod';
import { jumiaAuthorizationCrypto } from '@/lib/jumia/authorization-crypto';
import { JumiaApiError } from '@/lib/jumia/jumia-api-error';
import {
  claimJumiaSelfAuthorizationDiscovery,
  consumeJumiaSelfAuthorizationDiscovery,
  createJumiaSelfAuthorizationDiscovery,
  releaseJumiaSelfAuthorizationDiscovery,
  updateClaimedJumiaSelfAuthorizationDiscovery,
} from '@/lib/jumia/self-authorization-discovery-store';
import { logger } from '@/lib/logger';
import type {
  jumiaSelfAuthorizationDiscoverySchema,
  jumiaSelfAuthorizationSelectionSchema,
} from '@/schemas/jumia/self-authorization';
import { claimJumiaDiscoveryCredentials } from './claim-jumia-discovery-credentials';
import { loadExistingJumiaShopIds } from './load-existing-jumia-shop-ids';
import { releaseJumiaDiscoveryClaim } from './release-jumia-discovery-claim';
import { jumiaSelfAuthorizationHandler } from './self-authorization-handler';
import { validateJumiaSelfAuthorizationForConnect } from './validate-jumia-self-authorization-for-connect';

type DiscoveryBody = z.infer<typeof jumiaSelfAuthorizationDiscoverySchema>;
type SelectionBody = z.infer<typeof jumiaSelfAuthorizationSelectionSchema> & {
  connectionType: 'self_authorization';
};
export async function handleJumiaSelfAuthorizationConnectRequest(args: {
  body: DiscoveryBody | SelectionBody;
  encryptionKey: string;
  merchantId: string;
  supabase: SupabaseClient;
}): Promise<NextResponse> {
  const { body, encryptionKey, merchantId, supabase } = args;
  try {
    if ('operation' in body) {
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
      let discoveryId: string | undefined;
      let discoveryClaim:
        | Awaited<ReturnType<typeof claimJumiaDiscoveryCredentials>>
        | undefined;
      let submittedCredentials = body.refreshToken
        ? { clientId: body.clientId, refreshToken: body.refreshToken }
        : undefined;
      if (body.discoveryId) {
        discoveryClaim = await claimJumiaDiscoveryCredentials({
          discoveryId: body.discoveryId,
          merchantId,
          clientKeyHash,
          encryptionKey,
          supabase,
        });
        if (!discoveryClaim) {
          return NextResponse.json(
            { error: 'Jumia shop discovery expired or is no longer valid' },
            { status: 409 }
          );
        }
        submittedCredentials = discoveryClaim.credentials;
        discoveryId = body.discoveryId;
      }
      if (!submittedCredentials) {
        return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
      }
      let validated: Awaited<
        ReturnType<typeof validateJumiaSelfAuthorizationForConnect>
      >;
      try {
        validated = await validateJumiaSelfAuthorizationForConnect({
          clientKeyHash,
          discoveryId: body.discoveryId,
          encryptionKey,
          merchantId,
          onCredentialsRotated: async ({ credentialCiphertext }) => {
            if (discoveryClaim) {
              await updateClaimedJumiaSelfAuthorizationDiscovery(supabase, {
                discoveryId: body.discoveryId ?? '',
                merchantId,
                claimToken: discoveryClaim.claimToken,
                credentialCiphertext,
              });
            } else {
              discoveryId = await createJumiaSelfAuthorizationDiscovery(
                supabase,
                {
                  merchantId,
                  clientKeyHash,
                  credentialCiphertext,
                }
              );
            }
          },
          submittedCredentials,
          supabase,
        });
      } catch (error) {
        if (discoveryId) {
          if (discoveryClaim) {
            await releaseJumiaDiscoveryClaim({
              discoveryId: body.discoveryId ?? discoveryId,
              merchantId,
              claimToken: discoveryClaim.claimToken,
              supabase,
            });
          }
          return NextResponse.json(
            {
              error:
                error instanceof Error
                  ? error.message
                  : 'Jumia shop discovery failed',
              discoveryId,
              retryable: true,
            },
            { status: 502 }
          );
        }
        throw error;
      }
      if (discoveryClaim) {
        await releaseJumiaDiscoveryClaim({
          discoveryId: body.discoveryId ?? discoveryId ?? '',
          merchantId,
          claimToken: discoveryClaim.claimToken,
          supabase,
        });
      }
      if (!discoveryId) {
        discoveryId = await createJumiaSelfAuthorizationDiscovery(supabase, {
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
        });
      }
      return jumiaSelfAuthorizationHandler.discover({
        credentials: {
          clientId: submittedCredentials.clientId,
          refreshToken: submittedCredentials.refreshToken,
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
    const discoveryClaim = await claimJumiaSelfAuthorizationDiscovery(
      supabase,
      {
        discoveryId: body.discoveryId,
        merchantId,
        clientKeyHash,
      }
    );
    if (!discoveryClaim) {
      return NextResponse.json(
        { error: 'Jumia shop discovery is busy, expired, or no longer valid' },
        { status: 409 }
      );
    }
    const storedCredentials = jumiaAuthorizationCrypto.decrypt(
      discoveryClaim.credentialCiphertext,
      encryptionKey,
      jumiaAuthorizationCrypto.buildAuthorizationContext(
        merchantId,
        clientKeyHash
      )
    );
    const expectedRotationVersionRef: { current?: number } = {};
    try {
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
        validate: (credentials) =>
          validateJumiaSelfAuthorizationForConnect({
            clientKeyHash,
            discoveryId: body.discoveryId,
            encryptionKey,
            merchantId,
            onCredentialsRotated: async ({
              credentialCiphertext,
              expectedRotationVersion,
            }) => {
              expectedRotationVersionRef.current = expectedRotationVersion;
              await updateClaimedJumiaSelfAuthorizationDiscovery(supabase, {
                discoveryId: body.discoveryId,
                merchantId,
                claimToken: discoveryClaim.claimToken,
                credentialCiphertext,
              });
            },
            submittedCredentials: credentials,
            supabase,
          }),
        encrypt: jumiaAuthorizationCrypto.encrypt,
        expectedRotationVersionRef,
      });
      if (!response.ok) {
        await releaseJumiaDiscoveryClaim({
          discoveryId: body.discoveryId,
          merchantId,
          claimToken: discoveryClaim.claimToken,
          supabase,
        });
        return response;
      }
      try {
        const discoveryComplete =
          response.headers.get('x-jumia-discovery-complete') !== 'false';
        if (discoveryComplete) {
          await consumeJumiaSelfAuthorizationDiscovery(supabase, {
            discoveryId: body.discoveryId,
            merchantId,
            clientKeyHash,
            claimToken: discoveryClaim.claimToken,
          });
        } else {
          await releaseJumiaSelfAuthorizationDiscovery(supabase, {
            discoveryId: body.discoveryId,
            merchantId,
            claimToken: discoveryClaim.claimToken,
          });
        }
      } catch (cleanupError) {
        logger.warn({
          message:
            'Jumia self-authorization connect succeeded but discovery cleanup failed',
          error: cleanupError,
          discovery_id: body.discoveryId,
          merchant_id: merchantId,
        });
      }
      return response;
    } catch (error) {
      await releaseJumiaDiscoveryClaim({
        discoveryId: body.discoveryId,
        merchantId,
        claimToken: discoveryClaim.claimToken,
        supabase,
      });
      throw error;
    }
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
