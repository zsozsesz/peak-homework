import { Test, TestingModule } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { StockQueueProducer } from './stock.queue.producer.js';
import {
  STOCK_QUEUE,
  UPDATE_ALL_SYMBOLS_JOB,
  UPDATE_SYMBOL_PRICE_JOB,
} from './stock.queue.js';

describe('StockQueueProducer', () => {
  let producer: StockQueueProducer;
  let mockQueue: {
    upsertJobScheduler: jest.Mock;
    add: jest.Mock;
  };

  beforeEach(async () => {
    mockQueue = {
      upsertJobScheduler: jest.fn().mockResolvedValue(undefined),
      add: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StockQueueProducer,
        {
          provide: getQueueToken(STOCK_QUEUE),
          useValue: mockQueue,
        },
      ],
    }).compile();

    producer = module.get<StockQueueProducer>(StockQueueProducer);
  });

  describe('onModuleInit', () => {
    it('should schedule the update-all-symbols recurring job', async () => {
      await producer.onModuleInit();

      expect(mockQueue.upsertJobScheduler).toHaveBeenCalledWith(
        UPDATE_ALL_SYMBOLS_JOB,
        expect.objectContaining({ pattern: expect.any(String) }),
        expect.objectContaining({ name: UPDATE_ALL_SYMBOLS_JOB }),
      );
    });

    it('should configure the job with removeOnComplete, backoff, and attempts', async () => {
      await producer.onModuleInit();

      expect(mockQueue.upsertJobScheduler).toHaveBeenCalledWith(
        UPDATE_ALL_SYMBOLS_JOB,
        expect.any(Object),
        expect.objectContaining({
          opts: expect.objectContaining({
            removeOnComplete: true,
            backoff: expect.any(Number),
            attempts: expect.any(Number),
          }),
        }),
      );
    });

    it('should not throw when upsertJobScheduler rejects', async () => {
      mockQueue.upsertJobScheduler.mockRejectedValue(
        new Error('Redis connection refused'),
      );

      await expect(producer.onModuleInit()).resolves.toBeUndefined();
    });
  });

  describe('addSymbolUpdateJob', () => {
    it('should add an update-symbol-price job with the given symbol', async () => {
      await producer.addSymbolUpdateJob('AAPL');

      expect(mockQueue.add).toHaveBeenCalledWith(
        UPDATE_SYMBOL_PRICE_JOB,
        { symbol: 'AAPL' },
        expect.any(Object),
      );
    });

    it('should configure the job with backoff, attempts, and removeOnComplete', async () => {
      await producer.addSymbolUpdateJob('GOOG');

      expect(mockQueue.add).toHaveBeenCalledWith(
        UPDATE_SYMBOL_PRICE_JOB,
        expect.any(Object),
        expect.objectContaining({
          backoff: expect.any(Number),
          attempts: expect.any(Number),
          removeOnComplete: expect.any(Object),
        }),
      );
    });

    it('should add separate jobs for different symbols', async () => {
      await producer.addSymbolUpdateJob('AAPL');
      await producer.addSymbolUpdateJob('GOOG');

      expect(mockQueue.add).toHaveBeenCalledTimes(2);
      expect(mockQueue.add).toHaveBeenCalledWith(
        UPDATE_SYMBOL_PRICE_JOB,
        { symbol: 'AAPL' },
        expect.any(Object),
      );
      expect(mockQueue.add).toHaveBeenCalledWith(
        UPDATE_SYMBOL_PRICE_JOB,
        { symbol: 'GOOG' },
        expect.any(Object),
      );
    });
  });
});
