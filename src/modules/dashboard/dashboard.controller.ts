import { Controller, Get, Req } from '@nestjs/common';
import { Request } from 'express';
import { DashboardService } from './dashboard.service';

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get()
  summary(@Req() req: Request) {
    const user = req.user as { id: string };
    return this.dashboardService.getSummary(user.id);
  }
}
