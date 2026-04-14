import {
  Body,
  Controller,
  Get,
  InternalServerErrorException,
  NotFoundException,
  Param,
  Put,
  ValidationPipe,
} from '@nestjs/common';
import {
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { StockPriceResponseDto } from './dto/stock-price-response.dto.js';
import { SymbolParamDto } from './dto/symbol-param.dto.js';
import { UpdateStockDto } from './dto/update-stock.dto.js';
import { UpsertStockResponseDto } from './dto/upsert-stock-response.dto.js';
import { StockService } from './stock.service.js';

const symbolValidation = new ValidationPipe({
  whitelist: true,
  transform: true,
});

@ApiTags('stock')
@Controller('stock')
export class StockController {
  constructor(private readonly stockService: StockService) {}

  @Get(':symbol')
  @ApiOperation({
    summary: 'Get current stock info',
    description:
      'Returns the current price, last updated time, and moving average for the given symbol.',
  })
  @ApiOkResponse({ type: StockPriceResponseDto })
  @ApiNotFoundResponse({ description: 'Stock symbol not found' })
  async getStock(
    @Param(symbolValidation) params: SymbolParamDto,
  ): Promise<StockPriceResponseDto> {
    try {
      return await this.stockService.getStock(params.symbol);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException(
        `Failed to fetch stock data: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  @Put(':symbol')
  @ApiOperation({
    summary: 'Start periodic checks for a symbol',
    description:
      'Upserts the stock symbol and activates (or deactivates) periodic price checks.',
  })
  @ApiOkResponse({ type: UpsertStockResponseDto })
  @ApiNotFoundResponse({ description: 'Stock symbol not found in Finnhub API' })
  async upsertStock(
    @Param(symbolValidation) params: SymbolParamDto,
    @Body(new ValidationPipe({ whitelist: true, transform: true }))
    dto: UpdateStockDto,
  ): Promise<UpsertStockResponseDto> {
    try {
      return await this.stockService.upsertStock(params.symbol, dto);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException(
        `Failed to upsert stock: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }
}
