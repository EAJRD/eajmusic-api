# EAJMUSIC — n8n alert workflows

Four workflow exports, ready to import into https://n8n.eajmusic.com/ (Workflows → Import from File).

| File | Trigger | Fires from |
|---|---|---|
| `testimonial-submitted.json` | Webhook `POST /webhook/testimonial-submitted` | `eajmusic-api` on public testimonial submission |
| `payout-requested.json` | Webhook `POST /webhook/payout-requested` | `eajmusic-api` on artist payout request |
| `release-submitted.json` | Webhook `POST /webhook/release-submitted` | `eajmusic-api` on release submitted for review |
| `system-health-alert.json` | Schedule (every 5 min) | n8n itself polls `GET /api/health` — works even if the backend can't call out |

## Setup (one-time, in n8n's UI — nothing here touches this repo's code)

1. **Create the Telegram credential**: message [@BotFather](https://t.me/BotFather) on Telegram, `/newbot`, get the bot token. In n8n: Credentials → New → Telegram API → paste the token. Name it `EAJMUSIC Telegram Alerts` (or update the `credentials.name` in each JSON to match whatever you name it).
2. **Get your chat ID**: send any message to your new bot, then open `https://api.telegram.org/bot<TOKEN>/getUpdates` in a browser and read `message.chat.id`.
3. **Import each JSON** via the n8n UI. After import, replace in each workflow:
   - `REPLACE_WITH_N8N_CREDENTIAL_ID` → the credential's real ID (n8n fills this in automatically once you select the credential on the Telegram node — you usually don't need to hand-edit this).
   - `REPLACE_WITH_YOUR_TELEGRAM_CHAT_ID` → your chat ID from step 2.
4. **Set `N8N_WEBHOOK_BASE_URL`** in `eajmusic-api`'s production `.env` to `https://n8n.eajmusic.com/webhook` so the backend's `notifyN8n()` calls (see `src/services/n8nWebhookService.js`) reach these three webhook workflows.
5. **Activate** each workflow (toggle in the top-right of the n8n editor).

## Why these four and not more

The task asked for "eventos críticos... nuevos registros, caídas del sistema, errores de base de datos." New-user-registration alerting wasn't built because it's noisy for a pre-launch product (every signup would page you) — happy to add it as a fifth workflow once you confirm you want it. The three business-event webhooks plus the health poller cover the actual "something needs a human" moments: content to moderate, money to move, and the system being down.

## Testing before going live

Once imported, active, and pointed at real credentials, trigger each webhook manually with curl to confirm the Telegram message arrives, before relying on real backend traffic to test it:

```bash
curl -X POST https://n8n.eajmusic.com/webhook/testimonial-submitted \
  -H "Content-Type: application/json" \
  -d '{"testimonialId":"test-123","artistProfileId":"artist-abc","quote":"Prueba de webhook","submittedAt":"2026-07-29T00:00:00Z"}'
```
