import { IEmailService, SendEmailParams } from '../email.interface';

export interface SentEmail extends SendEmailParams {
  sentAt: Date;
}

export class MockEmailService implements IEmailService {
  private readonly sentEmails: SentEmail[] = [];

  async sendEmail(params: SendEmailParams): Promise<void> {
    this.sentEmails.push({ ...params, sentAt: new Date() });
  }

  getSentEmails(): SentEmail[] {
    return this.sentEmails;
  }

  clearSentEmails(): void {
    this.sentEmails.length = 0;
  }
}
