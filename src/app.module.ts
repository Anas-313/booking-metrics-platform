import { Module } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from 'prisma/prisma.module';
import { InsightsModule } from './insights/insights.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { SeedModule } from './seed/seed.module';

@Module({
  imports: [
    PrismaModule,
    CacheModule.register({
      isGlobal: true, // Make cache available to all modules
      ttl: 900, // 15 minutes in seconds
      max: 100, // maximum number of items in cache
    }),
    InsightsModule,
    AnalyticsModule,
    SeedModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
