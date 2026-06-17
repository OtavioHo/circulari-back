import { Body, Controller, Headers, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { Public } from '../auth/decorators/public.decorator';
import { RevenueCatService } from './revenuecat.service';
import { RevenueCatWebhookBody } from './dto/webhook-event.dto';

@Controller('webhooks/revenuecat')
export class RevenueCatController {
  constructor(private readonly service: RevenueCatService) {}

  // Public endpoint: rate-limit by source IP to blunt abuse. The shared-secret
  // check still rejects unauthenticated callers before any work is done.
  @Public()
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { ttl: 60_000, limit: 120 } })
  @Post()
  @HttpCode(HttpStatus.OK)
  async handle(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: RevenueCatWebhookBody,
  ) {
    this.service.verifySignature(authorization);
    await this.service.handleWebhook(body);
    return { received: true };
  }
}
