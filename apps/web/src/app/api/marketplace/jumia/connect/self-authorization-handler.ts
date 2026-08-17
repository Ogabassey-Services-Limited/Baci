import { createHash } from 'node:crypto';
import { NextResponse } from 'next/server';
import { isJumiaShopAlreadyConnected } from '@/lib/jumia/jumia-shop-connection-identity';
import type {
  SafeJumiaShop,
  ValidatedSelfAuthorization,
} from '@/lib/jumia/self-authorization';
import type { JumiaSelfAuthorizationCredentials } from '@/schemas/jumia/self-authorization';

type Validate = (
  credentials: JumiaSelfAuthorizationCredentials
) => Promise<ValidatedSelfAuthorization>;

type Rpc = (
  name: string,
  args: Record<string, unknown>
) => Promise<{
  data: Array<{
    authorization_id: string | null;
    integration_id: string;
    shop_id: string;
    inserted: boolean;
  }> | null;
  error: unknown;
}>;

function noStore(response: NextResponse): NextResponse {
  response.headers.set('Cache-Control', 'private, no-store');
  return response;
}

async function discover(args: {
  credentials: JumiaSelfAuthorizationCredentials;
  discoveryId: string;
  existingShopIds: Set<string>;
  validate: Validate;
}): Promise<NextResponse> {
  const validated = await args.validate(args.credentials);
  return noStore(
    NextResponse.json({
      discoveryId: args.discoveryId,
      shops: validated.shops.map((shop) => ({
        ...shop,
        alreadyConnected: isJumiaShopAlreadyConnected(
          shop,
          args.existingShopIds
        ),
      })),
    })
  );
}

async function connect(args: {
  credentials: JumiaSelfAuthorizationCredentials;
  encryptionKey: string;
  merchantId: string;
  existingShopIds: Set<string>;
  rpc: Rpc;
  selectedShopIds: string[];
  validate: Validate;
  encrypt: (
    credentials: ValidatedSelfAuthorization['credentials'],
    encryptionKey: string,
    context: string
  ) => string;
}): Promise<NextResponse> {
  const validated = await args.validate(args.credentials);
  const shopsById = new Map(
    validated.shops.map((shop) => [shop.selectionKey ?? shop.id, shop])
  );
  const selectedShops = args.selectedShopIds.flatMap((shopId) => {
    const shop = shopsById.get(shopId);
    return shop ? [shop] : [];
  });

  if (selectedShops.length !== args.selectedShopIds.length) {
    return noStore(
      NextResponse.json(
        { error: 'Selected Jumia shop is no longer available' },
        { status: 400 }
      )
    );
  }

  const shopsToConnect = selectedShops.filter(
    (shop) => !isJumiaShopAlreadyConnected(shop, args.existingShopIds)
  );
  const skippedShops = selectedShops.filter((shop) =>
    isJumiaShopAlreadyConnected(shop, args.existingShopIds)
  );

  if (shopsToConnect.length === 0) {
    return noStore(
      NextResponse.json({
        connected: [],
        alreadyConnected: skippedShops.map((shop) => ({
          id: shop.id,
          name: shop.name,
        })),
      })
    );
  }

  const clientKeyHash = createHash('sha256')
    .update(args.credentials.clientId)
    .digest('hex');
  const { data, error } = await args.rpc('persist_jumia_self_authorization', {
    p_merchant_id: args.merchantId,
    p_client_key_hash: clientKeyHash,
    p_credential_ciphertext: args.encrypt(
      validated.credentials,
      args.encryptionKey,
      `${args.merchantId}:${clientKeyHash}`
    ),
    p_token_expires_at: validated.accessTokenExpiresAt,
    p_shop_ids: shopsToConnect.map((shop) => shop.id),
    p_shop_names: shopsToConnect.map((shop) => shop.name),
    p_country_codes: shopsToConnect.map((shop) => shop.countryCode),
    p_marketplace_labels: shopsToConnect.map((shop) => shop.marketplace),
  });

  if (error || !data) {
    console.error(
      '[Jumia Connect] Failed to save selected Jumia shops:',
      error
    );
    return noStore(
      NextResponse.json(
        { error: 'Failed to save selected Jumia shops' },
        { status: 500 }
      )
    );
  }

  const insertedSelectionKeys = new Set(
    data.flatMap((row, index) => {
      if (!row.inserted) return [];
      const shop = shopsToConnect[index];
      if (!shop) return [];
      return [shop.selectionKey ?? shop.id];
    })
  );
  const resultShape = (shop: SafeJumiaShop) => ({
    id: shop.id,
    name: shop.name,
  });
  return noStore(
    NextResponse.json({
      connected: shopsToConnect
        .filter((shop) =>
          insertedSelectionKeys.has(shop.selectionKey ?? shop.id)
        )
        .map(resultShape),
      alreadyConnected: [
        ...skippedShops.map(resultShape),
        ...shopsToConnect
          .filter(
            (shop) => !insertedSelectionKeys.has(shop.selectionKey ?? shop.id)
          )
          .map(resultShape),
      ],
    })
  );
}

export const jumiaSelfAuthorizationHandler = { discover, connect };
