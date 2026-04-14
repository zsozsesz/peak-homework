export const STOCK_QUEUE = 'stock-price';

export const UPDATE_ALL_SYMBOLS_JOB = 'update-all-symbols';
export const UPDATE_SYMBOL_PRICE_JOB = 'update-symbol-price';

export interface UpdateSymbolPriceJobData {
  symbol: string;
}
