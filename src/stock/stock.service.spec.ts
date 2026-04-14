import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service.js';
import { FinnhubApiService } from './finnhub-api.service.js';
import { StockService } from './stock.service.js';

const mockQuote = { c: 150.5, h: 155, l: 148, o: 149, pc: 147, t: 1712345678 };

const makeStockSymbol = (overrides: Record<string, unknown> = {}) => ({
  id: 1,
  symbol: 'AAPL',
  isActive: true,
  lastCheckedAt: null,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
  prices: [],
  ...overrides,
});

const makePrice = (price: number, fetchedAt: Date) => ({
  id: 1,
  stockSymbolId: 1,
  price,
  fetchedAt,
});

describe('StockService', () => {
  let service: StockService;
  let prisma: jest.Mocked<PrismaService>;
  let finnhubApiService: jest.Mocked<FinnhubApiService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StockService,
        {
          provide: PrismaService,
          useValue: {
            stockSymbol: {
              findUnique: jest.fn(),
              upsert: jest.fn(),
              findMany: jest.fn(),
              update: jest.fn(),
            },
            stockPrice: {
              create: jest.fn(),
            },
            $transaction: jest.fn(),
          },
        },
        {
          provide: FinnhubApiService,
          useValue: {
            getStockPrice: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<StockService>(StockService);
    prisma = module.get(PrismaService);
    finnhubApiService = module.get(FinnhubApiService);
  });

  describe('getStock', () => {
    it('should return stock data with current price and moving average', async () => {
      const fetchedAt = new Date('2026-04-14T10:00:00Z');
      const prices = [
        makePrice(150, fetchedAt),
        makePrice(148, new Date('2026-04-14T09:00:00Z')),
      ];
      const stockSymbol = makeStockSymbol({ prices });

      finnhubApiService.getStockPrice.mockResolvedValue(mockQuote);
      prisma.stockSymbol.findUnique.mockResolvedValue(stockSymbol as any);

      const result = await service.getStock('AAPL');

      expect(result.symbol).toBe('AAPL');
      expect(result.currentPrice).toBe(150);
      expect(result.lastUpdatedAt).toEqual(fetchedAt);
      expect(result.movingAverage).toBeCloseTo(149);
    });

    it('should return null currentPrice and movingAverage when no prices recorded', async () => {
      finnhubApiService.getStockPrice.mockResolvedValue(mockQuote);
      prisma.stockSymbol.findUnique.mockResolvedValue(
        makeStockSymbol({ prices: [] }) as any,
      );

      const result = await service.getStock('AAPL');

      expect(result.currentPrice).toBeNull();
      expect(result.movingAverage).toBeNull();
      expect(result.lastUpdatedAt).toBeNull();
    });

    it('should calculate moving average across all returned prices', async () => {
      const prices = [160, 158, 155, 153, 150, 148, 145, 143, 140, 138].map(
        (price, i) => makePrice(price, new Date(Date.now() - i * 60000)),
      );
      finnhubApiService.getStockPrice.mockResolvedValue(mockQuote);
      prisma.stockSymbol.findUnique.mockResolvedValue(
        makeStockSymbol({ prices }) as any,
      );

      const result = await service.getStock('AAPL');

      const expected = prices.reduce((s, p) => s + p.price, 0) / prices.length;
      expect(result.movingAverage).toBeCloseTo(expected);
    });

    it('should throw NotFoundException when quote.c is 0', async () => {
      finnhubApiService.getStockPrice.mockResolvedValue({
        ...mockQuote,
        c: 0,
      });

      await expect(service.getStock('INVALID')).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.getStock('INVALID')).rejects.toThrow(
        "Stock symbol 'INVALID' not found in Finnhub API",
      );
    });

    it('should throw NotFoundException when symbol not in database', async () => {
      finnhubApiService.getStockPrice.mockResolvedValue(mockQuote);
      prisma.stockSymbol.findUnique.mockResolvedValue(null);

      await expect(service.getStock('AAPL')).rejects.toThrow(NotFoundException);
      await expect(service.getStock('AAPL')).rejects.toThrow(
        "Stock symbol 'AAPL' not found in database",
      );
    });

    it('should query prices ordered descending limited to 10', async () => {
      finnhubApiService.getStockPrice.mockResolvedValue(mockQuote);
      prisma.stockSymbol.findUnique.mockResolvedValue(
        makeStockSymbol({ prices: [] }) as any,
      );

      await service.getStock('AAPL');

      expect(prisma.stockSymbol.findUnique).toHaveBeenCalledWith({
        where: { symbol: 'AAPL' },
        include: {
          prices: {
            orderBy: { fetchedAt: 'desc' },
            take: 10,
          },
        },
      });
    });
  });

  describe('upsertStock', () => {
    it('should upsert symbol and return response dto', async () => {
      const now = new Date('2026-04-14T10:00:00Z');
      const stockSymbol = makeStockSymbol({
        isActive: true,
        createdAt: now,
        updatedAt: now,
      });

      finnhubApiService.getStockPrice.mockResolvedValue(mockQuote);
      prisma.stockSymbol.upsert.mockResolvedValue(stockSymbol as any);

      const result = await service.upsertStock('AAPL', { isActive: true });

      expect(result.symbol).toBe('AAPL');
      expect(result.isActive).toBe(true);
      expect(result.createdAt).toEqual(now);
      expect(result.updatedAt).toEqual(now);
    });

    it('should default isActive to true when not provided in dto', async () => {
      const stockSymbol = makeStockSymbol({ isActive: true });

      finnhubApiService.getStockPrice.mockResolvedValue(mockQuote);
      prisma.stockSymbol.upsert.mockResolvedValue(stockSymbol as any);

      await service.upsertStock('AAPL', {});

      expect(prisma.stockSymbol.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({ isActive: true }),
        }),
      );
    });

    it('should respect isActive=false from dto', async () => {
      const stockSymbol = makeStockSymbol({ isActive: false });

      finnhubApiService.getStockPrice.mockResolvedValue(mockQuote);
      prisma.stockSymbol.upsert.mockResolvedValue(stockSymbol as any);

      await service.upsertStock('AAPL', { isActive: false });

      expect(prisma.stockSymbol.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({ isActive: false }),
        }),
      );
    });

    it('should throw NotFoundException when quote.c is 0', async () => {
      finnhubApiService.getStockPrice.mockResolvedValue({
        ...mockQuote,
        c: 0,
      });

      await expect(service.upsertStock('INVALID', {})).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getActiveSymbols', () => {
    it('should return array of active symbol strings', async () => {
      prisma.stockSymbol.findMany.mockResolvedValue([
        { symbol: 'AAPL' } as any,
        { symbol: 'GOOG' } as any,
      ]);

      const result = await service.getActiveSymbols();

      expect(result).toEqual(['AAPL', 'GOOG']);
      expect(prisma.stockSymbol.findMany).toHaveBeenCalledWith({
        where: { isActive: true },
        select: { symbol: true },
      });
    });

    it('should return empty array when no active symbols', async () => {
      prisma.stockSymbol.findMany.mockResolvedValue([]);

      const result = await service.getActiveSymbols();

      expect(result).toEqual([]);
    });
  });

  describe('recordStockPrice', () => {
    it('should create price record and update lastCheckedAt in a transaction', async () => {
      prisma.stockSymbol.findUnique.mockResolvedValue(makeStockSymbol() as any);
      prisma.stockPrice.create.mockReturnValue({ id: 1 } as any);
      prisma.stockSymbol.update.mockReturnValue(makeStockSymbol() as any);
      prisma.$transaction.mockResolvedValue([]);

      await service.recordStockPrice('AAPL', 150.5);

      expect(prisma.$transaction).toHaveBeenCalledWith([
        expect.anything(),
        expect.anything(),
      ]);
    });

    it('should create the price with correct data', async () => {
      const stockSymbol = makeStockSymbol({ id: 42 });
      prisma.stockSymbol.findUnique.mockResolvedValue(stockSymbol as any);
      prisma.stockPrice.create.mockReturnValue({ id: 1 } as any);
      prisma.stockSymbol.update.mockReturnValue(stockSymbol as any);
      prisma.$transaction.mockImplementation((ops) => Promise.resolve(ops));

      await service.recordStockPrice('AAPL', 175.25);

      expect(prisma.stockPrice.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          stockSymbolId: 42,
          price: 175.25,
          fetchedAt: expect.any(Date),
        }),
      });
    });

    it('should not call $transaction when symbol is not found', async () => {
      prisma.stockSymbol.findUnique.mockResolvedValue(null);

      await service.recordStockPrice('UNKNOWN', 150);

      expect(prisma.$transaction).not.toHaveBeenCalled();
    });
  });
});
