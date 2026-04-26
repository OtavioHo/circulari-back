import { Controller, ForbiddenException, Get, Inject } from '@nestjs/common';
import { EMAIL_SERVICE } from './email.constants';
import { MockEmailService } from './providers/mock-email.service';
import { Public } from '../auth/decorators/public.decorator';

@Public()
@Controller('email')
export class EmailController {
  constructor(@Inject(EMAIL_SERVICE) private readonly emailService: unknown) {}

  @Get('sent')
  getSentEmails() {
    if (process.env.NODE_ENV === 'production') {
      throw new ForbiddenException();
    }
    return (this.emailService as MockEmailService).getSentEmails();
  }
}
