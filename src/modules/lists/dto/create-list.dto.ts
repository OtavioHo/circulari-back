import { IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateListDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  location?: string;

  @IsUUID()
  color_id: string;

  @IsUUID()
  icon_id: string;
}
