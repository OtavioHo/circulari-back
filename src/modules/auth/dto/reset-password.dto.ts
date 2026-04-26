import { IsEmail, IsUUID } from 'class-validator';
import { IsPassword } from './password.validator';

export class ResetPasswordDto {
  @IsEmail()
  email: string;

  @IsUUID()
  resetToken: string;

  @IsPassword()
  newPassword: string;
}
