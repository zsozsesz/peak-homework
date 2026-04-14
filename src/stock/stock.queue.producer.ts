import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Queue } from 'bullmq';
import {
  UPDATE_ALL_SYMBOLS_JOB,
  STOCK_QUEUE,
  UPDATE_SYMBOL_PRICE_JOB,
} from './stock.queue.js';

@Injectable()
export class StockQueueProducer implements OnModuleInit {
  private readonly logger = new Logger(StockQueueProducer.name);

  constructor(@InjectQueue(STOCK_QUEUE) private readonly stockQueue: Queue) {}

  async onModuleInit() {
    try {
      await this.stockQueue.upsertJobScheduler(
        UPDATE_ALL_SYMBOLS_JOB,
        {
          pattern: ' * * * * *',
        },
        {
          name: UPDATE_ALL_SYMBOLS_JOB,
          data: {},
          opts: {
            backoff: 3,
            attempts: 5,
          },
        },
      );
    } catch (error) {
      this.logger.error({
        message: 'Failed to upsert update-all-symbols job scheduler',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async addSymbolUpdateJob(symbol: string): Promise<void> {
    await this.stockQueue.add(
      UPDATE_SYMBOL_PRICE_JOB,
      { symbol },
      {
        backoff: 3,
        attempts: 5,
      },
    );
    this.logger.log({
      message: 'Enqueued job to fetch stock price',
      symbol,
    });
  }
}
