import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { FinnhubApiService } from './finnhub-api.service.js';
import {
  STOCK_QUEUE,
  UPDATE_ALL_SYMBOLS_JOB,
  UPDATE_SYMBOL_PRICE_JOB,
  UpdateSymbolPriceJobData,
} from './stock.queue.js';
import { StockQueueProducer } from './stock.queue.producer.js';
import { StockService } from './stock.service.js';

@Processor(STOCK_QUEUE, { concurrency: 5 })
export class StockQueueProcessor extends WorkerHost {
  private readonly logger = new Logger(StockQueueProcessor.name);

  constructor(
    private readonly stockService: StockService,
    private readonly finnhubApiService: FinnhubApiService,
    private readonly producer: StockQueueProducer,
  ) {
    super();
  }

  async process(job: Job): Promise<void> {
    try {
      switch (job.name) {
        case UPDATE_ALL_SYMBOLS_JOB:
          return await this.handleUpdateAllSymbols();
        case UPDATE_SYMBOL_PRICE_JOB:
          return await this.handleFetchSymbolPrice(
            (job.data as UpdateSymbolPriceJobData).symbol,
          );
        default:
          this.logger.warn(`Received unknown job name: ${job.name}`);
      }
    } catch (error) {
      this.logger.error({
        message: 'Error processing job',
        jobName: job.name,
        error: error instanceof Error ? error.message : String(error),
        job,
      });
    }
  }

  private async handleFetchSymbolPrice(symbol: string): Promise<void> {
    this.logger.log({ message: 'Fetching and storing price', symbol });

    const quote = await this.finnhubApiService.getStockPrice(symbol);
    if (quote.c === 0) {
      this.logger.warn({
        message: 'Received zero price from Finnhub, skipping store',
        symbol,
      });
      return;
    }

    await this.stockService.recordStockPrice(symbol, quote.c);
    this.logger.log({
      message: 'Stored stock price',
      symbol,
      price: quote.c,
    });
  }

  private async handleUpdateAllSymbols(): Promise<void> {
    this.logger.log({ message: 'Updating all active stock symbols' });

    const activeSymbols = await this.stockService.getActiveSymbols();
    this.logger.log({
      message: 'Fetched active stock symbols',
      count: activeSymbols.length,
    });

    for (const symbol of activeSymbols) {
      await this.producer.addSymbolUpdateJob(symbol);
      this.logger.log({
        message: 'Enqueued price fetch job for symbol',
        symbol,
      });
    }
  }
}
