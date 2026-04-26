export interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export interface IEmailService {
  sendEmail(params: SendEmailParams): Promise<void>;
}
