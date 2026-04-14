import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';

export class UpdateStockDto {
  @ApiPropertyOptional({
    description:
      'Whether to activate or deactivate periodic price checks for this symbol',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
