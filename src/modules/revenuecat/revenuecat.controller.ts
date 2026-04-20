import { Body, Controller, Headers, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { Public } from '../auth/decorators/public.decorator';
import { RevenueCatService } from './revenuecat.service';
import { RevenueCatWebhookBody } from './dto/webhook-event.dto';

@Controller('webhooks/revenuecat')
export class RevenueCatController {
  constructor(private readonly service: RevenueCatService) {}

  @Public()
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
