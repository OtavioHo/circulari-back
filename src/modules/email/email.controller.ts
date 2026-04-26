import { ConfigService } from '@nestjs/config';
import { Controller, ForbiddenException, Get, Inject } from '@nestjs/common';
import { EMAIL_SERVICE } from './email.constants';
import { MockEmailService } from './providers/mock-email.service';

@Controller('email')
export class EmailController {
  constructor(
    @Inject(EMAIL_SERVICE) private readonly emailService: unknown,
    private readonly configService: ConfigService,
  ) {}

  @Get('sent')
  getSentEmails() {
    const nodeEnv = this.configService.get<string>('NODE_ENV');
    const emailProvider = this.configService.get<string>('EMAIL_PROVIDER');

    if (nodeEnv === 'production' || emailProvider !== 'mock') {
      throw new ForbiddenException();
    }

    if (!(this.emailService instanceof MockEmailService)) {
      throw new ForbiddenException(
        'Sent email inspection is only available with the mock email provider.',
      );
    }

    return this.emailService.getSentEmails();
  }
}
