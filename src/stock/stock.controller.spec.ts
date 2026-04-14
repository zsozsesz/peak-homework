import {
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { StockPriceResponseDto } from './dto/stock-price-response.dto.js';
import { UpsertStockResponseDto } from './dto/upsert-stock-response.dto.js';
import { StockController } from './stock.controller.js';
import { StockService } from './stock.service.js';

const mockStockPriceResponse: StockPriceResponseDto = {
  symbol: 'AAPL',
  currentPrice: 150.5,
  lastUpdatedAt: new Date('2026-04-14T10:00:00Z'),
  movingAverage: 149.2,
};

const mockUpsertResponse: UpsertStockResponseDto = {
  symbol: 'AAPL',
  isActive: true,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-04-14T10:00:00Z'),
};

describe('StockController', () => {
  let controller: StockController;
  let stockService: jest.Mocked<StockService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [StockController],
      providers: [
        {
          provide: StockService,
          useValue: {
            getStock: jest.fn(),
            upsertStock: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<StockController>(StockController);
    stockService = module.get(StockService);
  });

  describe('getStock', () => {
    it('should return stock price response from service', async () => {
      stockService.getStock.mockResolvedValue(mockStockPriceResponse);

      const result = await controller.getStock({ symbol: 'AAPL' });

      expect(result).toEqual(mockStockPriceResponse);
      expect(stockService.getStock).toHaveBeenCalledWith('AAPL');
    });

    it('should re-throw NotFoundException from service', async () => {
      stockService.getStock.mockRejectedValue(
        new NotFoundException("Stock symbol 'AAPL' not found in database"),
      );

      await expect(controller.getStock({ symbol: 'AAPL' })).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should wrap unexpected errors in InternalServerErrorException', async () => {
      stockService.getStock.mockRejectedValue(new Error('DB connection lost'));

      await expect(controller.getStock({ symbol: 'AAPL' })).rejects.toThrow(
        InternalServerErrorException,
      );
      await expect(controller.getStock({ symbol: 'AAPL' })).rejects.toThrow(
        'Failed to fetch stock data: DB connection lost',
      );
    });

    it('should handle non-Error rejections', async () => {
      stockService.getStock.mockRejectedValue('unexpected string error');

      await expect(controller.getStock({ symbol: 'AAPL' })).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  describe('upsertStock', () => {
    it('should return upsert response from service', async () => {
      stockService.upsertStock.mockResolvedValue(mockUpsertResponse);

      const result = await controller.upsertStock(
        { symbol: 'AAPL' },
        { isActive: true },
      );

      expect(result).toEqual(mockUpsertResponse);
      expect(stockService.upsertStock).toHaveBeenCalledWith('AAPL', {
        isActive: true,
      });
    });

    it('should pass isActive=false to service', async () => {
      stockService.upsertStock.mockResolvedValue({
        ...mockUpsertResponse,
        isActive: false,
      });

      await controller.upsertStock({ symbol: 'AAPL' }, { isActive: false });

      expect(stockService.upsertStock).toHaveBeenCalledWith('AAPL', {
        isActive: false,
      });
    });

    it('should re-throw NotFoundException from service', async () => {
      stockService.upsertStock.mockRejectedValue(
        new NotFoundException("Stock symbol 'AAPL' not found in Finnhub API"),
      );

      await expect(
        controller.upsertStock({ symbol: 'AAPL' }, {}),
      ).rejects.toThrow(NotFoundException);
    });

    it('should wrap unexpected errors in InternalServerErrorException', async () => {
      stockService.upsertStock.mockRejectedValue(new Error('Timeout'));

      await expect(
        controller.upsertStock({ symbol: 'AAPL' }, {}),
      ).rejects.toThrow(InternalServerErrorException);
      await expect(
        controller.upsertStock({ symbol: 'AAPL' }, {}),
      ).rejects.toThrow('Failed to upsert stock: Timeout');
    });

    it('should handle empty dto', async () => {
      stockService.upsertStock.mockResolvedValue(mockUpsertResponse);

      await controller.upsertStock({ symbol: 'AAPL' }, {});

      expect(stockService.upsertStock).toHaveBeenCalledWith('AAPL', {});
    });
  });
});
