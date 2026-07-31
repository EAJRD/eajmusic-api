import admin from 'firebase-admin';

// ===========================================
// FIREBASE CLOUD MESSAGING (push notifications)
// ===========================================
// Prep work for a future mobile/PWA app - there is no client collecting FCM
// device tokens yet, so nothing calls sendPushNotification() in production
// today. This just gets the server-side plumbing ready behind env vars, the
// same lazy-init/never-throw pattern as minioStorageService.js and
// n8nWebhookService.js, so wiring it up later is a small addition instead of
// a new integration from scratch.
//
// Storing device tokens against a User will need a schema change
// (e.g. a DeviceToken model, one-to-many since a user can have multiple
// devices) - deliberately not added yet, see the app's task backlog.

let app = null;
let initAttempted = false;

function getApp() {
  if (app) return app;
  if (initAttempted) return null;
  initAttempted = true;

  const { FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY } = process.env;
  if (!FIREBASE_PROJECT_ID || !FIREBASE_CLIENT_EMAIL || !FIREBASE_PRIVATE_KEY) {
    return null;
  }

  try {
    app = admin.initializeApp({
      credential: admin.credential.cert({
        projectId: FIREBASE_PROJECT_ID,
        clientEmail: FIREBASE_CLIENT_EMAIL,
        // .env files can't hold real newlines in a single-line value, so the
        // private key is stored with literal "\n" escapes and unescaped here.
        privateKey: FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      }),
    });
    return app;
  } catch (err) {
    console.error('[firebaseService] Failed to initialize Firebase Admin:', err.message);
    return null;
  }
}

/**
 * Sends a push notification to a single device token. Returns true on
 * success, false on any failure (not configured, invalid/expired token,
 * network error) - never throws, so a notification failure can never break
 * the request that triggered it.
 */
export async function sendPushNotification(deviceToken, { title, body, data } = {}) {
  const firebaseApp = getApp();
  if (!firebaseApp || !deviceToken) return false;

  try {
    await admin.messaging(firebaseApp).send({
      token: deviceToken,
      notification: { title, body },
      ...(data && { data }),
    });
    return true;
  } catch (err) {
    console.error('[firebaseService] Push send failed:', err.message);
    return false;
  }
}

/**
 * Same as sendPushNotification but for many tokens at once (e.g. an
 * announcement or a bulk payout-complete notice). Returns the count of
 * successful sends; never throws.
 */
export async function sendPushNotificationBatch(deviceTokens, { title, body, data } = {}) {
  const firebaseApp = getApp();
  if (!firebaseApp || !deviceTokens?.length) return 0;

  try {
    const res = await admin.messaging(firebaseApp).sendEachForMulticast({
      tokens: deviceTokens,
      notification: { title, body },
      ...(data && { data }),
    });
    return res.successCount;
  } catch (err) {
    console.error('[firebaseService] Batch push send failed:', err.message);
    return 0;
  }
}
