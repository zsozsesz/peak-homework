import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';

interface FinnhubQuoteResponse {
  c: number; // Current price
  h: number; // High price of the day
  l: number; // Low price of the day
  o: number; // Open price of the day
  pc: number; // Previous close price
  t: number; // Timestamp (Unix)
}

@Injectable()
export class FinnhubApiService {
  private readonly logger = new Logger(FinnhubApiService.name);
  private readonly baseUrl: string;
  private readonly apiKey: string;

  constructor() {
    const key = process.env.FINNHUB_API_KEY;
    if (!key) {
      throw new Error('FINNHUB_API_KEY environment variable is not set');
    }
    this.apiKey = key;
    this.baseUrl = process.env.FINNHUB_BASE_URL ?? 'https://finnhub.io/api/v1';
  }

  async getStockPrice(symbol: string): Promise<number> {
    const url = `${this.baseUrl}/quote?symbol=${encodeURIComponent(symbol)}&token=${this.apiKey}`;

    let response: Response;
    try {
      response = await fetch(url);
      this.logger.log({
        message: 'Fetched stock price from Finnhub API',
        symbol,
        status: response.status,
      });
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error({
        message: 'Failed to reach Finnhub API',
        symbol,
        error: err.message,
      });
      throw new InternalServerErrorException(
        `Failed to reach Finnhub API: ${err.message}`,
      );
    }

    if (!response.ok) {
      this.logger.error({
        message: 'Finnhub API returned an error status',
        symbol,
        status: response.status,
        error: response.statusText,
      });
      throw new InternalServerErrorException(
        `Finnhub API returned status ${response.status}`,
      );
    }

    const data = (await response.json()) as FinnhubQuoteResponse;

    if (data.c === 0) {
      this.logger.warn({
        message: 'No price data available for symbol',
        symbol,
      });
      throw new InternalServerErrorException(
        `No price data available for symbol '${symbol}'`,
      );
    }

    return data.c;
  }
}
