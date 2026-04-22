import { IsHexColor, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateListDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  location?: string;

  @IsHexColor()
  @IsNotEmpty()
  color_id: string;

  @IsString()
  @IsNotEmpty()
  icon_id: string;

  @IsString()
  @IsNotEmpty()
  picture_id: string;
}
