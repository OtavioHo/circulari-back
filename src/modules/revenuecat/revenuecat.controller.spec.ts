import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { RevenueCatController } from './revenuecat.controller';
import { RevenueCatService } from './revenuecat.service';

describe('RevenueCatController', () => {
  let controller: RevenueCatController;
  const mockService = {
    verifySignature: jest.fn(),
    handleWebhook: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [RevenueCatController],
      providers: [{ provide: RevenueCatService, useValue: mockService }],
    }).compile();

    controller = module.get<RevenueCatController>(RevenueCatController);
    jest.clearAllMocks();
  });

  it('validates signature before handling the event', async () => {
    mockService.handleWebhook.mockResolvedValue(undefined);

    const body = { event: { id: 'evt-1', type: 'INITIAL_PURCHASE', app_user_id: 'user-1' } };
    const result = await controller.handle('Bearer secret', body);

    expect(mockService.verifySignature).toHaveBeenCalledWith('Bearer secret');
    expect(mockService.handleWebhook).toHaveBeenCalledWith(body);
    expect(result).toEqual({ received: true });
  });

  it('does not process the event when signature is invalid', async () => {
    mockService.verifySignature.mockImplementation(() => {
      throw new UnauthorizedException();
    });

    await expect(controller.handle('bad', {} as any)).rejects.toThrow(UnauthorizedException);
    expect(mockService.handleWebhook).not.toHaveBeenCalled();
  });
});
