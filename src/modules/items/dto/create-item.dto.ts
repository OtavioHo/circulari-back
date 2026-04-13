import { Type } from 'class-transformer';
import { IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';

export class CreateItemDto {
  @IsUUID()
  @IsNotEmpty()
  list_id: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  description?: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  quantity?: number;

  @IsUUID()
  @IsOptional()
  location_id?: string;

  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  user_defined_value?: number;

  @IsOptional()
  image?: unknown;
}
