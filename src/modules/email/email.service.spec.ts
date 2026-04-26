import { ConfigService } from '@nestjs/config';
import { StalwartEmailService } from './providers/stalwart-email.service';
import { MockEmailService } from './providers/mock-email.service';

jest.mock('nodemailer', () => {
  const mockSendMail = jest.fn().mockResolvedValue({});
  const mockCreateTransport = jest.fn().mockReturnValue({ sendMail: mockSendMail });
  return {
    createTransport: mockCreateTransport,
    __mockSendMail: mockSendMail,
    __mockCreateTransport: mockCreateTransport,
  };
});

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { __mockSendMail: mockSendMail } = require('nodemailer') as {
  __mockSendMail: jest.Mock;
};

function mockConfig(values: Record<string, string | number>): ConfigService {
  return {
    getOrThrow: (key: string) => {
      if (!(key in values)) throw new Error(`Missing config: ${key}`);
      return values[key];
    },
    get: (key: string, fallback?: string) => values[key] ?? fallback,
  } as unknown as ConfigService;
}

describe('StalwartEmailService', () => {
  const baseConfig = {
    EMAIL_FROM: 'no-reply@example.com',
    STALWART_SMTP_HOST: 'smtp.example.com',
    STALWART_SMTP_PORT: 587,
    STALWART_SMTP_USER: 'user',
    STALWART_SMTP_PASS: 'pass',
  };

  beforeEach(() => jest.clearAllMocks());

  it('calls sendMail with correct params', async () => {
    const service = new StalwartEmailService(mockConfig(baseConfig));
    await service.sendEmail({ to: 'user@test.com', subject: 'Hello', html: '<p>Hi</p>' });

    expect(mockSendMail).toHaveBeenCalledWith({
      from: 'no-reply@example.com',
      to: 'user@test.com',
      subject: 'Hello',
      html: '<p>Hi</p>',
      text: undefined,
    });
  });

  it('includes text when provided', async () => {
    const service = new StalwartEmailService(mockConfig(baseConfig));
    await service.sendEmail({
      to: 'user@test.com',
      subject: 'Hello',
      html: '<p>Hi</p>',
      text: 'Hi',
    });

    expect(mockSendMail).toHaveBeenCalledWith(expect.objectContaining({ text: 'Hi' }));
  });

  it('throws on missing required config', () => {
    expect(() => new StalwartEmailService(mockConfig({}))).toThrow();
  });
});

describe('MockEmailService', () => {
  it('stores sent emails in order', async () => {
    const service = new MockEmailService();
    await service.sendEmail({ to: 'a@test.com', subject: 'A', html: '<p>A</p>' });
    await service.sendEmail({ to: 'b@test.com', subject: 'B', html: '<p>B</p>' });

    const sent = service.getSentEmails();
    expect(sent).toHaveLength(2);
    expect(sent[0].to).toBe('a@test.com');
    expect(sent[1].to).toBe('b@test.com');
  });

  it('sets sentAt timestamp', async () => {
    const service = new MockEmailService();
    const before = new Date();
    await service.sendEmail({ to: 'a@test.com', subject: 'A', html: '<p>A</p>' });
    const after = new Date();

    const [email] = service.getSentEmails();
    expect(email.sentAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
    expect(email.sentAt.getTime()).toBeLessThanOrEqual(after.getTime());
  });

  it('clears sent emails', async () => {
    const service = new MockEmailService();
    await service.sendEmail({ to: 'a@test.com', subject: 'A', html: '<p>A</p>' });
    service.clearSentEmails();

    expect(service.getSentEmails()).toHaveLength(0);
  });
});
