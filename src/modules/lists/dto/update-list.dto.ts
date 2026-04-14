import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class UpdateListDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  location?: string;
}
