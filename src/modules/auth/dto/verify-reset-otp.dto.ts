import { IsEmail, IsNumberString, Length } from 'class-validator';

export class VerifyResetOtpDto {
  @IsEmail()
  email: string;

  @IsNumberString()
  @Length(6, 6)
  otp: string;
}
