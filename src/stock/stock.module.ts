import { Module } from '@nestjs/common';
import { FinnhubApiService } from './finnhub-api.service.js';
import { StockController } from './stock.controller.js';
import { StockService } from './stock.service.js';

@Module({
  controllers: [StockController],
  providers: [StockService, FinnhubApiService],
})
export class StockModule {}
