const envPath = 'apps/web/src/env.ts';
const adminPath = 'apps/web/src/lib/supabase/admin.ts';
const scopedJwt = 'apps/web/src/lib/supabase/scoped-jwt.ts';
const jwtSigning = 'apps/web/src/lib/agentic/jwt-signing-material.ts';
const receiverClient =
  'apps/web/src/lib/repairs/repair-pickup-receiver-client.ts';
const centerAddress = 'apps/web/src/lib/repairs/repair-center-address.ts';
const repairNotifications = 'apps/web/src/lib/repair-notifications.ts';
const notifyPickupBooking =
  'apps/web/src/lib/repairs/notify-repair-pickup-booking.ts';
const bookPickup = 'apps/web/src/lib/repairs/book-repair-pickup.ts';
const startPayment = 'apps/web/src/lib/repairs/start-repair-pickup-payment.ts';
const findResumable =
  'apps/web/src/lib/repairs/find-resumable-repair-pickup.ts';
const handlePayment =
  'apps/web/src/lib/repairs/handle-repair-pickup-payment.ts';
const dispatchPayment =
  'apps/web/src/lib/repairs/dispatch-repair-pickup-payment.ts';
const cachedData = 'apps/web/src/lib/cached-data.ts';
const expoPush = 'apps/web/src/lib/expo-push.ts';
const zeptomail = 'apps/web/src/lib/zeptomail.ts';
const webhookRoute = 'apps/web/src/app/api/payments/webhook/route.ts';
const pickupRoute =
  'apps/web/src/app/api/repairs/bookings/[id]/pickup/route.ts';
const repairAction = 'apps/web/src/app/actions/repair.ts';
const repairPickupPaymentAction =
  'apps/web/src/app/actions/repair-pickup-payment.ts';

const receiverJwtEnv = [
  receiverClient,
  scopedJwt,
  jwtSigning,
  envPath,
] as const;
const centerReceiverJwtEnv = [centerAddress, ...receiverJwtEnv] as const;

export const eventPipelineRepairPickupCredentialPaths = [
  [repairPickupPaymentAction, startPayment, ...centerReceiverJwtEnv],
  [repairAction, ...centerReceiverJwtEnv],
  [
    webhookRoute,
    dispatchPayment,
    handlePayment,
    bookPickup,
    ...centerReceiverJwtEnv,
  ],
  [
    webhookRoute,
    dispatchPayment,
    handlePayment,
    notifyPickupBooking,
    repairNotifications,
    cachedData,
    envPath,
  ],
  [pickupRoute, bookPickup, ...centerReceiverJwtEnv],
  [bookPickup, ...centerReceiverJwtEnv],
  [dispatchPayment, handlePayment, bookPickup, ...centerReceiverJwtEnv],
  [
    dispatchPayment,
    handlePayment,
    notifyPickupBooking,
    repairNotifications,
    cachedData,
    envPath,
  ],
  [
    dispatchPayment,
    handlePayment,
    notifyPickupBooking,
    repairNotifications,
    expoPush,
    envPath,
  ],
  [
    dispatchPayment,
    handlePayment,
    notifyPickupBooking,
    repairNotifications,
    adminPath,
    envPath,
  ],
  [
    dispatchPayment,
    handlePayment,
    notifyPickupBooking,
    repairNotifications,
    zeptomail,
    envPath,
  ],
  [handlePayment, bookPickup, ...centerReceiverJwtEnv],
  [
    handlePayment,
    notifyPickupBooking,
    repairNotifications,
    cachedData,
    envPath,
  ],
  [handlePayment, notifyPickupBooking, repairNotifications, expoPush, envPath],
  [handlePayment, notifyPickupBooking, repairNotifications, adminPath, envPath],
  [handlePayment, notifyPickupBooking, repairNotifications, zeptomail, envPath],
  [notifyPickupBooking, repairNotifications, cachedData, envPath],
  [notifyPickupBooking, repairNotifications, expoPush, envPath],
  [notifyPickupBooking, repairNotifications, adminPath, envPath],
  [notifyPickupBooking, repairNotifications, zeptomail, envPath],
  [...centerReceiverJwtEnv],
  [...receiverJwtEnv],
  [startPayment, ...centerReceiverJwtEnv],
  [startPayment, findResumable, ...receiverJwtEnv],
  [repairPickupPaymentAction, startPayment, findResumable, ...receiverJwtEnv],
] as const;
