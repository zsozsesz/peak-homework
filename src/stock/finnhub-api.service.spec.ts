import { InternalServerErrorException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { FinnhubApiService } from './finnhub-api.service.js';

const mockQuote = {
  c: 150.5,
  h: 155,
  l: 148,
  o: 149,
  pc: 147.5,
  t: 1712345678,
};

describe('FinnhubApiService', () => {
  let service: FinnhubApiService;
  let getOrThrowMock: jest.Mock;
  let getMock: jest.Mock;

  beforeEach(async () => {
    getOrThrowMock = jest.fn().mockReturnValue('test-api-key');
    getMock = jest.fn().mockReturnValue('https://finnhub.io/api/v1');

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FinnhubApiService,
        {
          provide: ConfigService,
          useValue: {
            getOrThrow: getOrThrowMock,
            get: getMock,
          },
        },
      ],
    }).compile();

    service = module.get<FinnhubApiService>(FinnhubApiService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should call getOrThrow for FINNHUB_API_KEY', () => {
      expect(getOrThrowMock).toHaveBeenCalledWith('FINNHUB_API_KEY');
    });

    it('should call get for FINNHUB_BASE_URL', () => {
      expect(getMock).toHaveBeenCalledWith('FINNHUB_BASE_URL');
    });

    it('should fall back to default base URL when config returns undefined', async () => {
      const moduleWithNoUrl: TestingModule = await Test.createTestingModule({
        providers: [
          FinnhubApiService,
          {
            provide: ConfigService,
            useValue: {
              getOrThrow: jest.fn().mockReturnValue('test-api-key'),
              get: jest.fn().mockReturnValue(undefined),
            },
          },
        ],
      }).compile();

      const svc = moduleWithNoUrl.get<FinnhubApiService>(FinnhubApiService);
      globalThis.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue(mockQuote),
      });

      await svc.getStockPrice('AAPL');

      expect(globalThis.fetch).toHaveBeenCalledWith(
        expect.stringContaining('https://finnhub.io/api/v1'),
      );
    });
  });

  describe('getStockPrice', () => {
    it('should return parsed quote data on success', async () => {
      globalThis.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue(mockQuote),
      });

      const result = await service.getStockPrice('AAPL');

      expect(result).toEqual(mockQuote);
    });

    it('should include symbol and token in the request URL', async () => {
      globalThis.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue(mockQuote),
      });

      await service.getStockPrice('AAPL');

      expect(globalThis.fetch).toHaveBeenCalledWith(
        expect.stringMatching(/symbol=AAPL.*token=test-api-key/),
      );
    });

    it('should URL-encode the symbol', async () => {
      globalThis.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue(mockQuote),
      });

      await service.getStockPrice('BRK.B');

      expect(globalThis.fetch).toHaveBeenCalledWith(
        expect.stringContaining('symbol=BRK.B'),
      );
    });

    it('should throw InternalServerErrorException when fetch throws', async () => {
      globalThis.fetch = jest
        .fn()
        .mockRejectedValue(new Error('Network failure'));

      await expect(service.getStockPrice('AAPL')).rejects.toThrow(
        InternalServerErrorException,
      );
      await expect(service.getStockPrice('AAPL')).rejects.toThrow(
        'Failed to reach Finnhub API: Network failure',
      );
    });

    it('should wrap non-Error rejections in InternalServerErrorException', async () => {
      globalThis.fetch = jest.fn().mockRejectedValue('string error');

      await expect(service.getStockPrice('AAPL')).rejects.toThrow(
        InternalServerErrorException,
      );
    });

    it('should throw InternalServerErrorException when response status is not ok', async () => {
      globalThis.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 403,
        statusText: 'Forbidden',
      });

      await expect(service.getStockPrice('AAPL')).rejects.toThrow(
        InternalServerErrorException,
      );
      await expect(service.getStockPrice('AAPL')).rejects.toThrow(
        'Finnhub API returned status 403',
      );
    });

    it('should throw InternalServerErrorException on 500 response', async () => {
      globalThis.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });

      await expect(service.getStockPrice('AAPL')).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });
});
