import * as admin from 'firebase-admin';

if (!admin.apps.length) {
  try {
    const serviceAccount = JSON.parse(
      process.env.FIREBASE_SERVICE_ACCOUNT || '{}'
    );

    if (serviceAccount.project_id) {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
      console.log('✅ Firebase Admin initialized');
    } else {
      console.warn('⚠️ FIREBASE_SERVICE_ACCOUNT not configured correctly');
    }
  } catch (error) {
    console.error('❌ Firebase Admin init error:', error);
  }
}

export const messaging = admin.messaging();

/**
 * Send a direct FCM notification (Elite 2025 Best Practice)
 */
export async function sendFCMNotification(
  token: string,
  title: string,
  body: string,
  data?: Record<string, string>,
  priority: 'high' | 'normal' = 'high'
) {
  try {
    const response = await messaging.send({
      token,
      notification: {
        title,
        body,
      },
      data: data || {},
      android: {
        priority,
        notification: {
          sound: 'default',
          channelId: 'orders',
        },
      },
      apns: {
        payload: {
          aps: {
            sound: 'default',
            badge: 1,
            'mutable-content': 1,
          },
        },
      },
    });
    return { success: true, messageId: response };
  } catch (error: any) {
    const errorCode = error?.code;
    const isUnregistered = 
      errorCode === 'messaging/registration-token-not-registered' ||
      errorCode === 'messaging/invalid-registration-token';

    return { 
      success: false, 
      error: error.message, 
      isUnregistered 
    };
  }
}
