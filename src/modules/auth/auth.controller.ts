import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { VerifyResetOtpDto } from './dto/verify-reset-otp.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { JwtRefreshGuard } from './guards/jwt-refresh.guard';
import { Public } from './decorators/public.decorator';
import { Request } from 'express';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Get('me')
  async getMe(@Req() req: Request) {
    const user = req.user as { id: string };
    return this.authService.getMe(user.id);
  }

  @Patch('me')
  async updateMe(@Body() dto: UpdateProfileDto, @Req() req: Request) {
    const user = req.user as { id: string };
    return this.authService.updateProfile(user.id, dto);
  }

  @Public()
  @Post('register')
  async register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtRefreshGuard)
  async refresh(@Req() req: Request) {
    const user = req.user as { id: string; refreshToken: string };
    return this.authService.refresh(user.id, user.refreshToken);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(@Req() req: Request) {
    const user = req.user as { id: string };
    await this.authService.logout(user.id);
    return { message: 'Logged out' };
  }

  @Public()
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    await this.authService.forgotPassword(dto.email);
    return { message: 'If that email exists, a reset code has been sent.' };
  }

  @Public()
  @Post('verify-reset-otp')
  @HttpCode(HttpStatus.OK)
  async verifyResetOtp(@Body() dto: VerifyResetOtpDto) {
    return this.authService.verifyResetOtp(dto.email, dto.otp);
  }

  @Public()
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  async resetPassword(@Body() dto: ResetPasswordDto) {
    await this.authService.resetPassword(dto.email, dto.resetToken, dto.newPassword);
    return { message: 'Password has been reset successfully.' };
  }
}
