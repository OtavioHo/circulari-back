import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';
import { IEmailService, SendEmailParams } from '../email.interface';

export class ResendEmailService implements IEmailService {
  private readonly client: Resend;
  private readonly from: string;

  constructor(private readonly config: ConfigService) {
    const apiKey = config.getOrThrow<string>('RESEND_API_KEY');
    this.from = config.getOrThrow<string>('EMAIL_FROM');
    this.client = new Resend(apiKey);
  }

  async sendEmail(params: SendEmailParams): Promise<void> {
    const { error } = await this.client.emails.send({
      from: this.from,
      to: params.to,
      subject: params.subject,
      html: params.html,
      text: params.text,
    });

    if (error) {
      throw new Error(`Resend error: ${error.message}`, { cause: error });
    }
  }
}
