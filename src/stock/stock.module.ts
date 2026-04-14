import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { FinnhubApiService } from './finnhub-api.service.js';
import { StockController } from './stock.controller.js';
import { STOCK_QUEUE } from './stock.queue.js';
import { StockQueueProcessor } from './stock.queue.processor.js';
import { StockQueueProducer } from './stock.queue.producer.js';
import { StockService } from './stock.service.js';

@Module({
  imports: [BullModule.registerQueue({ name: STOCK_QUEUE })],
  controllers: [StockController],
  providers: [
    StockService,
    FinnhubApiService,
    StockQueueProducer,
    StockQueueProcessor,
  ],
})
export class StockModule {}
