import { ApiProperty } from '@nestjs/swagger';

export class UpsertStockResponseDto {
  @ApiProperty({ description: 'Stock ticker symbol', example: 'AAPL' })
  symbol: string;

  @ApiProperty({
    description: 'Whether periodic price checks are active for this symbol',
    example: true,
  })
  isActive: boolean;

  @ApiProperty({
    description: 'Timestamp when the symbol was first registered',
    example: '2026-04-14T10:00:00.000Z',
    type: String,
    format: 'date-time',
  })
  createdAt: Date;

  @ApiProperty({
    description: 'Timestamp of the last update to this symbol',
    example: '2026-04-14T10:00:00.000Z',
    type: String,
    format: 'date-time',
  })
  updatedAt: Date;
}
