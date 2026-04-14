-- CreateTable
CREATE TABLE "StockSymbol" (
    "id" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastCheckedAt" TIMESTAMP(3),

    CONSTRAINT "StockSymbol_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockPrice" (
    "id" TEXT NOT NULL,
    "stockSymbolId" TEXT NOT NULL,
    "price" DECIMAL(12,4) NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockPrice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StockSymbol_symbol_key" ON "StockSymbol"("symbol");

-- CreateIndex
CREATE INDEX "StockSymbol_isActive_idx" ON "StockSymbol"("isActive");

-- CreateIndex
CREATE INDEX "StockPrice_stockSymbolId_fetchedAt_idx" ON "StockPrice"("stockSymbolId", "fetchedAt" DESC);

-- AddForeignKey
ALTER TABLE "StockPrice" ADD CONSTRAINT "StockPrice_stockSymbolId_fkey" FOREIGN KEY ("stockSymbolId") REFERENCES "StockSymbol"("id") ON DELETE CASCADE ON UPDATE CASCADE;
