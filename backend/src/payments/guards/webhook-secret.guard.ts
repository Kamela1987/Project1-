import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DEFAULT_WEBHOOK_SECRET, MOBILE_MONEY_WEBHOOK_SECRET_ENV } from '../../config/mobile-money.config';

/**
 * Placeholder auth for provider webhooks: a shared secret header, since
 * there's no real MTN/Airtel integration to verify a signed payload
 * against. Replace with real signature verification before production —
 * see MobileMoneyService's class doc.
 */
@Injectable()
export class WebhookSecretGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const expected = this.config.get<string>(MOBILE_MONEY_WEBHOOK_SECRET_ENV, DEFAULT_WEBHOOK_SECRET);
    const provided = request.headers['x-webhook-secret'];
    if (provided !== expected) {
      throw new UnauthorizedException('Invalid webhook secret');
    }
    return true;
  }
}
