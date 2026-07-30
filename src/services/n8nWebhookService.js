/**
 * n8n Outgoing Webhook Notifier
 *
 * Fires lightweight "something happened" pings at the existing n8n
 * automation instance (https://n8n.eajmusic.com/) so staff can be notified
 * (Slack/email/WhatsApp/etc, wired up inside n8n itself) without polling the
 * admin panel. n8n's convention is one distinct webhook path per workflow,
 * so this is modeled as a base URL plus a per-event suffix path:
 *
 *   ${N8N_WEBHOOK_BASE_URL}/testimonial-submitted
 *   ${N8N_WEBHOOK_BASE_URL}/payout-requested
 *   ${N8N_WEBHOOK_BASE_URL}/release-submitted
 *
 * This is a notification ping, not authoritative data transfer - it must
 * NEVER become a hard dependency for the request that triggers it. If
 * N8N_WEBHOOK_BASE_URL isn't configured, or n8n is slow/unreachable, this
 * fails silently (logged via console.error/console.warn) and never throws
 * back into the caller.
 *
 * Configuration via environment variables:
 * - N8N_WEBHOOK_BASE_URL: Base URL for n8n webhooks, e.g.
 *   "https://n8n.eajmusic.com/webhook" (no trailing slash)
 */

const N8N_TIMEOUT_MS = 5000;

let warnedNotConfigured = false;

/**
 * Fire-and-forget POST to an n8n webhook. Callers should NOT await this in
 * a way that delays their HTTP response - call it without awaiting, or
 * await it only after res.json(...)/res.status(...).json(...) has already
 * been sent.
 *
 * @param {string} eventPath - e.g. 'testimonial-submitted'
 * @param {object} payload - JSON-serializable body to send
 */
export async function notifyN8n(eventPath, payload) {
  const baseUrl = process.env.N8N_WEBHOOK_BASE_URL;

  if (!baseUrl) {
    if (!warnedNotConfigured) {
      warnedNotConfigured = true;
      console.warn('[N8N_WEBHOOK] N8N_WEBHOOK_BASE_URL is not configured - skipping n8n notifications.');
    }
    return;
  }

  try {
    const response = await fetch(`${baseUrl}/${eventPath}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(N8N_TIMEOUT_MS),
    });

    if (!response.ok) {
      console.error(`[N8N_WEBHOOK] ${eventPath} responded with ${response.status}`);
    }
  } catch (error) {
    console.error(`[N8N_WEBHOOK] Failed to notify n8n for event "${eventPath}":`, error.message);
  }
}
