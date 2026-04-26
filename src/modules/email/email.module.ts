import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EMAIL_SERVICE } from './email.constants';
import { StalwartEmailService } from './providers/stalwart-email.service';
import { MockEmailService } from './providers/mock-email.service';
import { EmailController } from './email.controller';

const shouldRegisterEmailController =
  process.env.EMAIL_PROVIDER === 'mock' && process.env.NODE_ENV !== 'production';

@Module({
  controllers: shouldRegisterEmailController ? [EmailController] : [],
  providers: [
    {
      provide: EMAIL_SERVICE,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const provider = config.getOrThrow<string>('EMAIL_PROVIDER');
        switch (provider) {
          case 'mock':
            return new MockEmailService();
          case 'stalwart':
            return new StalwartEmailService(config);
          default:
            throw new Error(`Unknown EMAIL_PROVIDER "${provider}". Valid values: stalwart, mock`);
        }
      },
    },
  ],
  exports: [EMAIL_SERVICE],
})
export class EmailModule {}
