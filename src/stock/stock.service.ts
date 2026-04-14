import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { StockPriceResponseDto } from './dto/stock-price-response.dto.js';
import { UpdateStockDto } from './dto/update-stock.dto.js';
import { UpsertStockResponseDto } from './dto/upsert-stock-response.dto.js';
import { FinnhubApiService } from './finnhub-api.service.js';

const MOVING_AVERAGE_WINDOW = 10;

@Injectable()
export class StockService {
  private readonly finnhubApiService = new FinnhubApiService();
  private readonly logger = new Logger(StockService.name);
  constructor(private readonly prisma: PrismaService) {}

  async getStock(symbol: string): Promise<StockPriceResponseDto> {
    this.logger.log({
      message: 'Fetching stock price',
      symbol,
    });

    const quote = await this.finnhubApiService.getStockPrice(symbol);
    if (quote.c === 0) {
      throw new NotFoundException(
        `Stock symbol '${symbol}' not found in Finnhub API`,
      );
    }

    const stockSymbol = await this.prisma.stockSymbol.findUnique({
      where: { symbol },
      include: {
        prices: {
          orderBy: { fetchedAt: 'desc' },
          take: MOVING_AVERAGE_WINDOW,
        },
      },
    });

    if (!stockSymbol) {
      throw new NotFoundException(
        `Stock symbol '${symbol}' not found in database`,
      );
    }

    const latestPrice = stockSymbol.prices[0] ?? null;

    const movingAverage =
      stockSymbol.prices.length > 0
        ? stockSymbol.prices.reduce((sum, p) => sum + Number(p.price), 0) /
          stockSymbol.prices.length
        : null;

    return {
      symbol: stockSymbol.symbol,
      currentPrice: latestPrice ? Number(latestPrice.price) : null,
      lastUpdatedAt: latestPrice ? latestPrice.fetchedAt : null,
      movingAverage,
    };
  }

  async upsertStock(
    symbol: string,
    dto: UpdateStockDto,
  ): Promise<UpsertStockResponseDto> {
    this.logger.log({
      message: 'Upserting stock symbol',
      symbol,
      dto,
    });

    const quote = await this.finnhubApiService.getStockPrice(symbol);
    if (quote.c === 0) {
      throw new NotFoundException(
        `Stock symbol '${symbol}' not found in Finnhub API`,
      );
    }

    const isActive = dto.isActive ?? true;

    const stockSymbol = await this.prisma.stockSymbol.upsert({
      where: { symbol },
      create: {
        symbol,
        isActive,
      },
      update: {
        isActive,
        updatedAt: new Date(),
      },
    });

    return {
      symbol: stockSymbol.symbol,
      isActive: stockSymbol.isActive,
      createdAt: stockSymbol.createdAt,
      updatedAt: stockSymbol.updatedAt,
    };
  }
}
