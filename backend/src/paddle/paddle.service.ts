import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Paddle, Environment } from '@paddle/paddle-node-sdk';

@Injectable()
export class PaddleService implements OnModuleInit {
  private readonly logger = new Logger(PaddleService.name);
  public paddle: Paddle;

  constructor(private configService: ConfigService) {}

  onModuleInit() {
    const apiKey = this.configService.get<string>('PADDLE_API_KEY');

    if (!apiKey) {
      throw new Error(
        'PADDLE_API_KEY is not defined in environment variables. Set it in backend/.env',
      );
    }

    const env = this.configService.get<string>('PADDLE_ENV', 'sandbox');
    const environment =
      env.toLowerCase() === 'production'
        ? Environment.production
        : Environment.sandbox;

    this.logger.log(
      `Initializing Paddle SDK in ${env.toLowerCase()} environment`,
    );

    this.paddle = new Paddle(apiKey, {
      environment,
    });
  }

  getWebhookSecret(): string {
    const secret = this.configService.get<string>('PADDLE_WEBHOOK_SECRET');
    if (!secret) {
      throw new Error(
        'PADDLE_WEBHOOK_SECRET is not defined in backend/.env. Create a Notification Destination in Paddle Sandbox and paste the Signing Secret into PADDLE_WEBHOOK_SECRET.',
      );
    }
    return secret;
  }

  getPriceIdForPlan(plan: 'pro' | 'business'): string {
    if (plan === 'pro') {
      const id =
        this.configService.get<string>('PADDLE_PRICE_ID_PRO') ||
        this.configService.get<string>('PADDLE_PRICE_ID_PRO_MONTHLY');
      if (!id) {
        throw new Error(
          'PADDLE_PRICE_ID_PRO / PADDLE_PRICE_ID_PRO_MONTHLY is not defined in environment variables.',
        );
      }
      return id;
    }

    const id =
      this.configService.get<string>('PADDLE_PRICE_ID_BUSINESS') ||
      this.configService.get<string>('PADDLE_PRICE_ID_BUSINESS_MONTHLY');
    if (!id) {
      throw new Error(
        'PADDLE_PRICE_ID_BUSINESS / PADDLE_PRICE_ID_BUSINESS_MONTHLY is not defined in environment variables.',
      );
    }
    return id;
  }

  mapPriceIdToPlan(priceId: string): 'free' | 'pro' | 'business' | null {
    if (!priceId) return null;

    const proMonthly =
      this.configService.get<string>('PADDLE_PRICE_ID_PRO') ||
      this.configService.get<string>('PADDLE_PRICE_ID_PRO_MONTHLY');
    const proAnnual = this.configService.get<string>(
      'PADDLE_PRICE_ID_PRO_ANNUAL',
    );

    const businessMonthly =
      this.configService.get<string>('PADDLE_PRICE_ID_BUSINESS') ||
      this.configService.get<string>('PADDLE_PRICE_ID_BUSINESS_MONTHLY');
    const businessAnnual = this.configService.get<string>(
      'PADDLE_PRICE_ID_BUSINESS_ANNUAL',
    );

    if (
      (proMonthly && priceId === proMonthly) ||
      (proAnnual && priceId === proAnnual)
    ) {
      return 'pro';
    }

    if (
      (businessMonthly && priceId === businessMonthly) ||
      (businessAnnual && priceId === businessAnnual)
    ) {
      return 'business';
    }

    return null;
  }
}
