import { IsInt, IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';

export class UpdateItemDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsInt()
  @Min(1)
  @IsOptional()
  quantity?: number;

  @IsUUID()
  @IsOptional()
  location_id?: string;

  @IsNumber()
  @IsOptional()
  user_defined_value?: number;
}
