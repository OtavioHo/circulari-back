import { applyDecorators } from '@nestjs/common';
import { IsString, Matches, MinLength } from 'class-validator';

export function IsPassword() {
  return applyDecorators(
    IsString(),
    MinLength(8),
    Matches(/[A-Z]/, { message: 'password must contain at least one uppercase letter' }),
    Matches(/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/, {
      message: 'password must contain at least one special character',
    }),
  );
}
