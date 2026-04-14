import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { StockModule } from './stock/stock.module.js';

@Module({
  imports: [PrismaModule, StockModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
