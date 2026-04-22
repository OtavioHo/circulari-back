import { IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

export class UpdateListDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  location?: string;

  @IsUUID()
  @IsOptional()
  color_id?: string;

  @IsUUID()
  @IsOptional()
  icon_id?: string;

  @IsUUID()
  @IsOptional()
  picture_id?: string;
}
