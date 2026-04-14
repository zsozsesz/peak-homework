import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module.js';
import { FinnhubApiService } from './stock/finnhub-api.service.js';
import { STOCK_QUEUE } from './stock/stock.queue.js';
import { StockQueueProcessor } from './stock/stock.queue.processor.js';
import { StockQueueProducer } from './stock/stock.queue.producer.js';
import { StockService } from './stock/stock.service.js';

@Module({
  imports: [
    BullModule.forRootAsync({
      useFactory: () => {
        const redisUrl = process.env.REDIS_URL ?? 'redis://localhost:6379';
        const url = new URL(redisUrl);
        return {
          connection: {
            host: url.hostname,
            port: Number(url.port) || 6379,
          },
        };
      },
    }),
    BullModule.registerQueue({ name: STOCK_QUEUE }),
    PrismaModule,
  ],
  providers: [
    StockService,
    FinnhubApiService,
    StockQueueProducer,
    StockQueueProcessor,
  ],
})
export class WorkerModule {}
