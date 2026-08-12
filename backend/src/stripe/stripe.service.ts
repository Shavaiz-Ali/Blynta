import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';

@Injectable()
export class StripeService implements OnModuleInit {
  public stripe: Stripe;

  constructor(private configService: ConfigService) {}

  onModuleInit() {
    const secretKey = this.configService.get<string>('STRIPE_SECRET_KEY');

    if (!secretKey) {
      throw new Error(
        'STRIPE_SECRET_KEY is not defined in environment variables. Set it in backend/.env (Stripe Dashboard > Developers > API keys > Secret key, test mode).',
      );
    }

    this.stripe = new Stripe(secretKey, {
      typescript: true,
    });
  }

  getWebhookSecret(): string {
    const secret = this.configService.get<string>('STRIPE_WEBHOOK_SECRET');
    if (!secret) {
      throw new Error(
        'STRIPE_WEBHOOK_SECRET is not defined. Register a webhook endpoint in Stripe Dashboard > Developers > Webhooks and paste the Signing secret here.',
      );
    }
    return secret;
  }

  getPriceIdForPlan(plan: 'pro' | 'business'): string {
    if (plan === 'pro') {
      const id = this.configService.get<string>('STRIPE_PRICE_ID_PRO');
      if (!id) {
        throw new Error(
          'STRIPE_PRICE_ID_PRO is not defined. Create a recurring monthly Price for the Pro product in Stripe Dashboard and paste its ID here.',
        );
      }
      return id;
    }
    const id = this.configService.get<string>('STRIPE_PRICE_ID_BUSINESS');
    if (!id) {
      throw new Error(
        'STRIPE_PRICE_ID_BUSINESS is not defined. Create a recurring monthly Price for the Business product in Stripe Dashboard and paste its ID here.',
      );
    }
    return id;
  }

  /**
   * Reverse lookup: given a Stripe Price ID, return our UserPlan enum value.
   * Returns null if it matches neither configured price.
   */
  mapPriceIdToPlan(priceId: string): 'free' | 'pro' | 'business' | null {
    const pro = this.configService.get<string>('STRIPE_PRICE_ID_PRO');
    const business = this.configService.get<string>('STRIPE_PRICE_ID_BUSINESS');
    if (pro && priceId === pro) return 'pro';
    if (business && priceId === business) return 'business';
    return null;
  }
}
