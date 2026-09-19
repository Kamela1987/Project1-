/**
 * Automated driver payouts (Phase 4) — a scheduled sweep that pays out
 * every opted-in, approved driver's full wallet balance once it clears a
 * minimum threshold, instead of the driver having to remember to request
 * one (see PaymentsService.runAutoPayouts / PayoutSchedulerService). A
 * driver who never opts in (Driver.autoPayoutEnabled) is completely
 * unaffected — `POST /payments/payout`'s on-demand flow is unchanged.
 */
export const AUTO_PAYOUT_ENABLED_ENV = 'AUTO_PAYOUT_ENABLED';
export const AUTO_PAYOUT_MIN_BALANCE_ENV = 'AUTO_PAYOUT_MIN_BALANCE';
export const AUTO_PAYOUT_CRON_ENV = 'AUTO_PAYOUT_CRON';

export const DEFAULT_AUTO_PAYOUT_MIN_BALANCE = 50;
/** Default: once a day at 02:00. */
export const DEFAULT_AUTO_PAYOUT_CRON = '0 2 * * *';
