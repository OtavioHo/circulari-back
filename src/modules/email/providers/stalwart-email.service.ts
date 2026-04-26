import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { IEmailService, SendEmailParams } from '../email.interface';

export class StalwartEmailService implements IEmailService {
  private readonly transporter: nodemailer.Transporter;
  private readonly from: string;

  constructor(private readonly config: ConfigService) {
    this.from = config.getOrThrow<string>('EMAIL_FROM');
    this.transporter = nodemailer.createTransport({
      host: config.getOrThrow<string>('STALWART_SMTP_HOST'),
      port: config.getOrThrow<number>('STALWART_SMTP_PORT'),
      auth: {
        user: config.getOrThrow<string>('STALWART_SMTP_USER'),
        pass: config.getOrThrow<string>('STALWART_SMTP_PASS'),
      },
    });
  }

  async sendEmail(params: SendEmailParams): Promise<void> {
    await this.transporter.sendMail({
      from: this.from,
      to: params.to,
      subject: params.subject,
      html: params.html,
      text: params.text,
    });
  }
}
