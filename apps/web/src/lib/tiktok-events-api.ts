import { tiktokEventsAPIHelpers } from './tiktok-events-api-helpers';
import { sendTikTokEvent } from './tiktok-events-api-request';
import type {
  TikTokEventName,
  TikTokEventOptions,
  TikTokEventProperties,
  TikTokUserData,
} from './tiktok-events-api-types';

export { sendTikTokEvent } from './tiktok-events-api-request';
export type {
  TikTokEventName,
  TikTokEventOptions,
  TikTokEventProperties,
  TikTokUserData,
} from './tiktok-events-api-types';

function sendContentEvent(
  eventName: TikTokEventName,
  pixelId: string,
  accessToken: string,
  userData: TikTokUserData,
  properties: TikTokEventProperties,
  options?: TikTokEventOptions,
  signal?: AbortSignal
) {
  return sendTikTokEvent(
    pixelId,
    accessToken,
    eventName,
    userData,
    tiktokEventsAPIHelpers.withFirstContent(properties),
    options,
    undefined,
    signal
  );
}

export const tiktokEventsAPI = {
  purchase: (
    pixelId: string,
    accessToken: string,
    userData: TikTokUserData,
    orderId: string,
    value: number,
    currency: string,
    products: Array<{
      id: string;
      name: string;
      price: number;
      quantity: number;
    }>,
    options?: TikTokEventOptions,
    signal?: AbortSignal
  ) => {
    const firstProduct = products[0];
    return sendTikTokEvent(
      pixelId,
      accessToken,
      'Purchase',
      userData,
      {
        value,
        currency,
        orderId,
        contentId: firstProduct?.id,
        contentName: firstProduct?.name,
        contentType: 'product',
        price: firstProduct?.price,
        contentIds: products.map((product) => product.id),
        contents: products.map((product) => ({
          content_id: product.id,
          content_name: product.name,
          price: product.price,
          quantity: product.quantity,
        })),
      },
      options,
      undefined,
      signal
    );
  },

  initiateCheckout: (
    pixelId: string,
    accessToken: string,
    userData: TikTokUserData,
    valueOrProperties: number | TikTokEventProperties,
    currencyOrOptions?: string | TikTokEventOptions,
    productIds?: string[],
    options?: TikTokEventOptions,
    signal?: AbortSignal
  ) => {
    const properties =
      typeof valueOrProperties === 'number'
        ? {
            value: valueOrProperties,
            currency:
              typeof currencyOrOptions === 'string'
                ? currencyOrOptions
                : undefined,
            contentIds: productIds,
          }
        : valueOrProperties;
    const finalOptions =
      typeof currencyOrOptions === 'object' ? currencyOrOptions : options;
    return sendContentEvent(
      'InitiateCheckout',
      pixelId,
      accessToken,
      userData,
      properties,
      finalOptions,
      signal
    );
  },

  viewContent: (
    pixelId: string,
    accessToken: string,
    userData: TikTokUserData,
    properties: TikTokEventProperties,
    options?: TikTokEventOptions,
    signal?: AbortSignal
  ) =>
    sendContentEvent(
      'ViewContent',
      pixelId,
      accessToken,
      userData,
      properties,
      options,
      signal
    ),

  addToCart: (
    pixelId: string,
    accessToken: string,
    userData: TikTokUserData,
    properties: TikTokEventProperties,
    options?: TikTokEventOptions,
    signal?: AbortSignal
  ) =>
    sendContentEvent(
      'AddToCart',
      pixelId,
      accessToken,
      userData,
      properties,
      options,
      signal
    ),

  addToWishlist: (
    pixelId: string,
    accessToken: string,
    userData: TikTokUserData,
    properties: TikTokEventProperties,
    options?: TikTokEventOptions,
    signal?: AbortSignal
  ) =>
    sendContentEvent(
      'AddToWishlist',
      pixelId,
      accessToken,
      userData,
      properties,
      options,
      signal
    ),

  addPaymentInfo: (
    pixelId: string,
    accessToken: string,
    userData: TikTokUserData,
    properties: TikTokEventProperties = {},
    options?: TikTokEventOptions,
    signal?: AbortSignal
  ) =>
    sendContentEvent(
      'AddPaymentInfo',
      pixelId,
      accessToken,
      userData,
      properties,
      options,
      signal
    ),

  placeAnOrder: (
    pixelId: string,
    accessToken: string,
    userData: TikTokUserData,
    properties: TikTokEventProperties,
    options?: TikTokEventOptions,
    signal?: AbortSignal
  ) =>
    sendContentEvent(
      'PlaceAnOrder',
      pixelId,
      accessToken,
      userData,
      properties,
      options,
      signal
    ),

  completeRegistration: (
    pixelId: string,
    accessToken: string,
    userData: TikTokUserData,
    properties: TikTokEventProperties = {},
    options?: TikTokEventOptions,
    signal?: AbortSignal
  ) =>
    sendTikTokEvent(
      pixelId,
      accessToken,
      'CompleteRegistration',
      userData,
      properties,
      options,
      undefined,
      signal
    ),

  search: (
    pixelId: string,
    accessToken: string,
    userData: TikTokUserData,
    searchString: string,
    options?: TikTokEventOptions,
    signal?: AbortSignal
  ) =>
    sendTikTokEvent(
      pixelId,
      accessToken,
      'Search',
      userData,
      { searchString, url: options?.url },
      options,
      undefined,
      signal
    ),
};
