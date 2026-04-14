import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class StockPriceResponseDto {
  @ApiProperty({ description: 'Stock ticker symbol', example: 'AAPL' })
  symbol: string;

  @ApiPropertyOptional({
    description: 'Most recent price. Null if no prices have been recorded yet.',
    example: 175.34,
    nullable: true,
  })
  currentPrice: number | null;

  @ApiPropertyOptional({
    description:
      'Timestamp of the most recent price record. Null if no prices have been recorded yet.',
    example: '2026-04-14T10:00:00.000Z',
    nullable: true,
    type: String,
    format: 'date-time',
  })
  lastUpdatedAt: Date | null;

  @ApiPropertyOptional({
    description: `Moving average of the last 10 recorded prices. Null if no prices have been recorded yet.`,
    example: 174.12,
    nullable: true,
  })
  movingAverage: number | null;
}
