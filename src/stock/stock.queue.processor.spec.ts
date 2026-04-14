import { Test, TestingModule } from '@nestjs/testing';
import { FinnhubApiService } from './finnhub-api.service.js';
import { StockQueueProcessor } from './stock.queue.processor.js';
import { StockQueueProducer } from './stock.queue.producer.js';
import {
  UPDATE_ALL_SYMBOLS_JOB,
  UPDATE_SYMBOL_PRICE_JOB,
} from './stock.queue.js';
import { StockService } from './stock.service.js';

const makeJob = (name: string, data: Record<string, unknown> = {}) =>
  ({ name, data, id: '1' }) as any;

describe('StockQueueProcessor', () => {
  let processor: StockQueueProcessor;
  let stockService: jest.Mocked<StockService>;
  let finnhubApiService: jest.Mocked<FinnhubApiService>;
  let producer: jest.Mocked<StockQueueProducer>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StockQueueProcessor,
        {
          provide: StockService,
          useValue: {
            recordStockPrice: jest.fn(),
            getActiveSymbols: jest.fn(),
          },
        },
        {
          provide: FinnhubApiService,
          useValue: {
            getStockPrice: jest.fn(),
          },
        },
        {
          provide: StockQueueProducer,
          useValue: {
            addSymbolUpdateJob: jest.fn(),
          },
        },
      ],
    }).compile();

    processor = module.get<StockQueueProcessor>(StockQueueProcessor);
    stockService = module.get(StockService);
    finnhubApiService = module.get(FinnhubApiService);
    producer = module.get(StockQueueProducer);
  });

  describe('process', () => {
    describe(`${UPDATE_SYMBOL_PRICE_JOB}`, () => {
      it('should fetch and store price for the given symbol', async () => {
        finnhubApiService.getStockPrice.mockResolvedValue({
          c: 150.5,
          h: 155,
          l: 148,
          o: 149,
          pc: 147,
          t: 1712345678,
        });
        stockService.recordStockPrice.mockResolvedValue(undefined);

        await processor.process(
          makeJob(UPDATE_SYMBOL_PRICE_JOB, { symbol: 'AAPL' }),
        );

        expect(finnhubApiService.getStockPrice).toHaveBeenCalledWith('AAPL');
        expect(stockService.recordStockPrice).toHaveBeenCalledWith(
          'AAPL',
          150.5,
        );
      });

      it('should skip storing price when quote.c is 0', async () => {
        finnhubApiService.getStockPrice.mockResolvedValue({
          c: 0,
          h: 0,
          l: 0,
          o: 0,
          pc: 0,
          t: 0,
        });

        await processor.process(
          makeJob(UPDATE_SYMBOL_PRICE_JOB, { symbol: 'AAPL' }),
        );

        expect(stockService.recordStockPrice).not.toHaveBeenCalled();
      });
    });

    describe(`${UPDATE_ALL_SYMBOLS_JOB}`, () => {
      it('should enqueue a price fetch job for each active symbol', async () => {
        stockService.getActiveSymbols.mockResolvedValue([
          'AAPL',
          'GOOG',
          'MSFT',
        ]);
        producer.addSymbolUpdateJob.mockResolvedValue(undefined);

        await processor.process(makeJob(UPDATE_ALL_SYMBOLS_JOB));

        expect(stockService.getActiveSymbols).toHaveBeenCalledTimes(1);
        expect(producer.addSymbolUpdateJob).toHaveBeenCalledTimes(3);
        expect(producer.addSymbolUpdateJob).toHaveBeenCalledWith('AAPL');
        expect(producer.addSymbolUpdateJob).toHaveBeenCalledWith('GOOG');
        expect(producer.addSymbolUpdateJob).toHaveBeenCalledWith('MSFT');
      });

      it('should handle empty active symbols list without error', async () => {
        stockService.getActiveSymbols.mockResolvedValue([]);

        await processor.process(makeJob(UPDATE_ALL_SYMBOLS_JOB));

        expect(producer.addSymbolUpdateJob).not.toHaveBeenCalled();
      });
    });

    describe('unknown job name', () => {
      it('should not throw for an unrecognised job name', async () => {
        await expect(
          processor.process(makeJob('unknown-job-name')),
        ).resolves.toBeUndefined();
      });
    });

    describe('error handling', () => {
      it('should not propagate errors thrown during job processing', async () => {
        finnhubApiService.getStockPrice.mockRejectedValue(
          new Error('Finnhub down'),
        );

        await expect(
          processor.process(
            makeJob(UPDATE_SYMBOL_PRICE_JOB, { symbol: 'AAPL' }),
          ),
        ).resolves.toBeUndefined();
      });

      it('should not propagate errors thrown during update-all-symbols', async () => {
        stockService.getActiveSymbols.mockRejectedValue(
          new Error('DB connection lost'),
        );

        await expect(
          processor.process(makeJob(UPDATE_ALL_SYMBOLS_JOB)),
        ).resolves.toBeUndefined();
      });
    });
  });
});
