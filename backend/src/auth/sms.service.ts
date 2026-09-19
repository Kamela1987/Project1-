import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * SMS gateway integration for OTP delivery. Africa's Talking is the
 * concrete provider — it's the dominant SMS aggregator across
 * Zambia/sub-Saharan Africa and reaches MTN, Airtel, and Zamtel numbers
 * through a single API, so it needs no per-network integration the way
 * mobile money does (see mobile-money.service.ts, which is still a stand-in
 * since MTN/Airtel each require their own sandbox credentials).
 *
 * Falls back to logging the message instead of sending when
 * AFRICASTALKING_API_KEY/AFRICASTALKING_USERNAME aren't configured, so
 * local dev and CI never need real credentials or make network calls.
 */
@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);
  private readonly apiKey?: string;
  private readonly username?: string;
  private readonly senderId?: string;
  private readonly apiUrl: string;

  constructor(private readonly config: ConfigService) {
    this.apiKey = this.config.get<string>('AFRICASTALKING_API_KEY');
    this.username = this.config.get<string>('AFRICASTALKING_USERNAME');
    this.senderId = this.config.get<string>('AFRICASTALKING_SENDER_ID');
    this.apiUrl = this.config.get<string>(
      'AFRICASTALKING_API_URL',
      'https://api.africastalking.com/version1/messaging',
    );
  }

  get isConfigured(): boolean {
    return Boolean(this.apiKey && this.username);
  }

  async send(phoneNumber: string, message: string): Promise<void> {
    if (!this.isConfigured) {
      this.logger.log(`[DEV] SMS to ${phoneNumber}: ${message}`);
      return;
    }

    const body = new URLSearchParams({
      username: this.username!,
      to: phoneNumber,
      message,
      ...(this.senderId ? { from: this.senderId } : {}),
    });

    const response = await fetch(this.apiUrl, {
      method: 'POST',
      headers: {
        apiKey: this.apiKey!,
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body,
    });

    if (!response.ok) {
      const text = await response.text();
      this.logger.error(`Africa's Talking SMS send failed (${response.status}): ${text}`);
      throw new Error('Failed to send SMS');
    }
  }
}
