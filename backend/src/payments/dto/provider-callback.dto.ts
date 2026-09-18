import { IsEnum, IsOptional, IsString } from 'class-validator';

export enum ProviderCallbackStatus {
  SUCCESSFUL = 'SUCCESSFUL',
  FAILED = 'FAILED',
}

/**
 * Normalized shape this backend expects from a mobile money callback.
 * Real MTN MoMo / Airtel Money webhook payloads look different — a thin
 * per-provider adapter would translate their payload into this shape
 * before calling PaymentsService.handleCallback. Kept provider-agnostic
 * here so the rest of the payment flow doesn't care which network was used.
 */
export class ProviderCallbackDto {
  /** Our Payment.id, sent as the externalId/reference on the original request-to-pay call. */
  @IsString()
  paymentId: string;

  @IsEnum(ProviderCallbackStatus)
  status: ProviderCallbackStatus;

  @IsOptional()
  @IsString()
  providerReference?: string;
}
