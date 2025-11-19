import { Injectable } from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';

@Injectable()
export class AnalyticsService {
  constructor(private prisma: PrismaService) {}

  /**
   * Get raw aggregated data for testing/debugging
   */
  async getRawData(limit: number = 100) {
    const pageviews = await this.prisma.pageViewsHourly.findMany({
      take: limit,
      orderBy: { timestamp: 'desc' },
    });

    const userActions = await this.prisma.userActionsHourly.findMany({
      take: limit,
      orderBy: { timestamp: 'desc' },
    });

    const performance = await this.prisma.performanceHourly.findMany({
      take: limit,
      orderBy: { timestamp: 'desc' },
    });

    return {
      pageviews,
      userActions,
      performance,
    };
  }
}

