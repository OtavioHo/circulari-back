import { IsEmail, IsString, MinLength } from 'class-validator';
import { IsPassword } from './password.validator';

export class RegisterDto {
  @IsEmail()
  email: string;

  @IsPassword()
  password: string;

  @IsString()
  @MinLength(1)
  name: string;
}
