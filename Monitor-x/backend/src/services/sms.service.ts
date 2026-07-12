import { env } from '../config/env.js';
import { HttpError } from '../middleware/errors.js';

/**
 * Sends a plain-text SMS via the configured provider. Mirrors the delivery
 * behaviour of otp.service.ts but for free-form messages (Fast2SMS "quick" `q`
 * route) — used for operational alerts such as SOS notifications.
 *
 * In `dev` mode it only logs to the console (no network). Throws HttpError on a
 * real provider failure so callers can decide whether to surface or swallow it.
 */
export async function sendSms(phone: string, message: string): Promise<void> {
  if (env.smsProvider === 'fast2sms') {
    if (!env.fast2smsApiKey) {
      throw new HttpError(500, 'Fast2SMS is selected but FAST2SMS_API_KEY is not set');
    }
    // Fast2SMS wants a bare 10-digit Indian mobile number (no +91 / spaces).
    const number = phone.replace(/\D/g, '').replace(/^91(?=\d{10}$)/, '');
    if (!/^\d{10}$/.test(number)) {
      throw new HttpError(422, `Cannot send SMS: "${phone}" is not a valid 10-digit mobile number`);
    }

    interface Fast2SmsResponse { return?: boolean; message?: unknown }
    let data: Fast2SmsResponse;
    try {
      const res = await fetch('https://www.fast2sms.com/dev/bulkV2', {
        method: 'POST',
        headers: { authorization: env.fast2smsApiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ route: 'q', message, numbers: number }),
      });
      data = (await res.json()) as Fast2SmsResponse;
    } catch {
      throw new HttpError(502, 'Fast2SMS request failed — check network connection and API key');
    }
    if (!data.return) {
      const detail = Array.isArray(data.message) ? data.message.join('; ') : String(data.message ?? 'unknown error');
      throw new HttpError(502, `Fast2SMS could not send the SMS: ${detail}`);
    }
    return;
  }
  if (env.smsProvider === 'msg91') {
    // TODO: real MSG91 call — kept as a stub so the flow is provider-ready.
    console.warn('[sms] MSG91 send not yet implemented — falling back to console log');
  }
  console.log(`\n[sms] === DEV SMS === to=${phone} message=${message}\n`);
}
