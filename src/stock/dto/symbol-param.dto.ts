import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class SymbolParamDto {
  @ApiProperty({ description: 'Stock ticker symbol', example: 'AAPL' })
  @IsString()
  @IsNotEmpty()
  symbol: string;
}
