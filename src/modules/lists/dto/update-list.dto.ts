import { IsHexColor, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class UpdateListDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  location?: string;

  @IsHexColor()
  @IsOptional()
  color_id?: string;

  @IsString()
  @IsNotEmpty()
  @IsOptional()
  icon_id?: string;

  @IsString()
  @IsNotEmpty()
  @IsOptional()
  picture_id?: string;
}
