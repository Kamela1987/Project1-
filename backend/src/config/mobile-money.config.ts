/**
 * No real MTN MoMo / Airtel Money sandbox credentials exist for this
 * scaffold, so `MobileMoneyService` (src/payments/mobile-money.service.ts)
 * only logs what it would send. In dev mode a request-to-pay is
 * auto-resolved as successful after a short delay instead of waiting for a
 * real provider webhook, so the end-to-end flow is testable locally.
 *
 * Before production: wire MobileMoneyService up to the real Collections/
 * Disbursements APIs, set MOBILE_MONEY_DEV_AUTO_COMPLETE=false, and make
 * the webhook endpoints verify the provider's real signature instead of a
 * shared secret header.
 */
export const MOBILE_MONEY_DEV_AUTO_COMPLETE_ENV = 'MOBILE_MONEY_DEV_AUTO_COMPLETE';
export const MOBILE_MONEY_DEV_AUTO_COMPLETE_DELAY_MS_ENV = 'MOBILE_MONEY_DEV_AUTO_COMPLETE_DELAY_MS';
export const MOBILE_MONEY_WEBHOOK_SECRET_ENV = 'MOBILE_MONEY_WEBHOOK_SECRET';

export const DEFAULT_DEV_AUTO_COMPLETE_DELAY_MS = 3000;
export const DEFAULT_WEBHOOK_SECRET = 'dev-webhook-secret';
