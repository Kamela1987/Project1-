import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { WebhookSecretGuard } from './guards/webhook-secret.guard';
import { ProviderCallbackDto, ProviderCallbackStatus } from './dto/provider-callback.dto';
import { PaymentsService } from './payments.service';

/**
 * Where MTN MoMo / Airtel Money would notify us of a request-to-pay result
 * in production. Separate paths per provider so each can carry its own
 * payload-normalization step later; both currently expect the same
 * normalized ProviderCallbackDto shape (see that file's doc comment).
 */
@Controller('payments/webhooks')
@UseGuards(WebhookSecretGuard)
export class PaymentsWebhookController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('momo')
  momoCallback(@Body() dto: ProviderCallbackDto) {
    return this.paymentsService.handleCallback(
      dto.paymentId,
      dto.status === ProviderCallbackStatus.SUCCESSFUL,
      dto.providerReference,
    );
  }

  @Post('airtel')
  airtelCallback(@Body() dto: ProviderCallbackDto) {
    return this.paymentsService.handleCallback(
      dto.paymentId,
      dto.status === ProviderCallbackStatus.SUCCESSFUL,
      dto.providerReference,
    );
  }
}
