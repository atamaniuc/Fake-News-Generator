import { IsOptional, IsString, IsUUID, MinLength } from 'class-validator';

export class SendMessageDto {
  @IsString()
  @MinLength(1)
  message!: string;

  @IsOptional()
  @IsUUID()
  requestId?: string;
}
