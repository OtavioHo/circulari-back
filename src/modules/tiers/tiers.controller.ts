import { Controller, Get, Req } from '@nestjs/common';
import { Request } from 'express';
import { LimitsService } from './limits.service';

@Controller('plan')
export class TiersController {
  constructor(private readonly limitsService: LimitsService) {}

  @Get()
  getPlanUsage(@Req() req: Request) {
    const user = req.user as { id: string };
    return this.limitsService.getPlanUsage(user.id);
  }
}
