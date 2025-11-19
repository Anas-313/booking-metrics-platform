import { Injectable } from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';
import {
  AnomalyDetectionResult,
  CorrelationResult,
} from '../insights/interfaces/insight.interface';

@Injectable()
export class AnomalyDetectorService {
  constructor(private prisma: PrismaService) {}

  /**
   * Detect anomalies using statistical analysis (2.5 standard deviations)
   * Recent period: Last 6 hours
   * Baseline period: Previous 24 hours (excluding recent 6 hours)
   */
  async detectAnomalies(): Promise<AnomalyDetectionResult[]> {
    const now = new Date();
    const recentStart = new Date(now.getTime() - 6 * 60 * 60 * 1000); // 6 hours ago
    const baselineStart = new Date(now.getTime() - 30 * 60 * 60 * 1000); // 30 hours ago
    const baselineEnd = new Date(now.getTime() - 6 * 60 * 60 * 1000); // 6 hours ago

    const anomalies: AnomalyDetectionResult[] = [];

    // Get all unique pages
    const pages = await this.getUniquePages();

    for (const page of pages) {
      // Detect traffic anomalies (pageviews)
      const trafficAnomalies = await this.detectTrafficAnomalies(
        page,
        recentStart,
        baselineStart,
        baselineEnd,
      );
      anomalies.push(...trafficAnomalies);

      // Detect engagement anomalies (user actions)
      const engagementAnomalies = await this.detectEngagementAnomalies(
        page,
        recentStart,
        baselineStart,
        baselineEnd,
      );
      anomalies.push(...engagementAnomalies);

      // Detect performance anomalies
      const performanceAnomalies = await this.detectPerformanceAnomalies(
        page,
        recentStart,
        baselineStart,
        baselineEnd,
      );
      anomalies.push(...performanceAnomalies);
    }

    return anomalies;
  }

  /**
   * Detect anomalies at granular level (per page/device/referrer/region)
   */
  async detectGranularAnomalies(): Promise<AnomalyDetectionResult[]> {
    const now = new Date();
    const recentStart = new Date(now.getTime() - 6 * 60 * 60 * 1000);
    const baselineStart = new Date(now.getTime() - 30 * 60 * 60 * 1000);
    const baselineEnd = new Date(now.getTime() - 6 * 60 * 60 * 1000);

    const anomalies: AnomalyDetectionResult[] = [];

    // Get all unique combinations
    const combinations = await this.getUniqueCombinations();

    for (const combo of combinations) {
      const trafficAnomalies = await this.detectTrafficAnomaliesGranular(
        combo,
        recentStart,
        baselineStart,
        baselineEnd,
      );
      anomalies.push(...trafficAnomalies);

      const engagementAnomalies = await this.detectEngagementAnomaliesGranular(
        combo,
        recentStart,
        baselineStart,
        baselineEnd,
      );
      anomalies.push(...engagementAnomalies);

      const performanceAnomalies = await this.detectPerformanceAnomaliesGranular(
        combo,
        recentStart,
        baselineStart,
        baselineEnd,
      );
      anomalies.push(...performanceAnomalies);
    }

    return anomalies;
  }

  /**
   * Detect traffic anomalies (aggregated by page)
   */
  private async detectTrafficAnomalies(
    page: string,
    recentStart: Date,
    baselineStart: Date,
    baselineEnd: Date,
  ): Promise<AnomalyDetectionResult[]> {
    const anomalies: AnomalyDetectionResult[] = [];

    // Get baseline data (aggregated by hour)
    const baselineData = await this.prisma.pageViewsHourly.findMany({
      where: {
        page,
        timestamp: {
          gte: baselineStart,
          lt: baselineEnd,
        },
      },
    });

    if (baselineData.length === 0) return anomalies;

    // Calculate baseline statistics (aggregate all hours)
    const baselineValues = baselineData.map((d) => d.viewCount);
    const baselineMean = this.calculateMean(baselineValues);
    const baselineStdDev = this.calculateStdDev(baselineValues, baselineMean);

    // Get recent data
    const recentData = await this.prisma.pageViewsHourly.findMany({
      where: {
        page,
        timestamp: {
          gte: recentStart,
        },
      },
    });

    // Check each recent hour for anomalies
    for (const recent of recentData) {
      const deviation = Math.abs(recent.viewCount - baselineMean);
      const threshold = 2.5 * baselineStdDev;

      if (deviation > threshold && baselineMean > 0) {
        const percentageChange =
          ((recent.viewCount - baselineMean) / baselineMean) * 100;

        anomalies.push({
          page: recent.page,
          metricType: 'Traffic',
          metric: 'PageViews',
          currentValue: recent.viewCount,
          baselineMean,
          baselineStdDev,
          percentageChange,
          timestamp: recent.timestamp,
          context: {
            deviceType: recent.deviceType,
            region: recent.region,
            referrer: recent.referrer,
            pageCategory: recent.pageCategory,
          },
        });
      }
    }

    return anomalies;
  }

  /**
   * Detect engagement anomalies (aggregated by page)
   */
  private async detectEngagementAnomalies(
    page: string,
    recentStart: Date,
    baselineStart: Date,
    baselineEnd: Date,
  ): Promise<AnomalyDetectionResult[]> {
    const anomalies: AnomalyDetectionResult[] = [];

    // Check session duration
    const sessionAnomalies = await this.detectMetricAnomaly(
      page,
      recentStart,
      baselineStart,
      baselineEnd,
      'avgSessionDuration',
      'UserActions',
      'Session Duration',
      (data) => data.avgSessionDuration,
    );
    anomalies.push(...sessionAnomalies);

    // Check bounce rate
    const bounceAnomalies = await this.detectMetricAnomaly(
      page,
      recentStart,
      baselineStart,
      baselineEnd,
      'bounceRate',
      'Engagement',
      'Bounce Rate',
      (data) => data.bounceRate,
    );
    anomalies.push(...bounceAnomalies);

    // Check conversion rate
    const conversionAnomalies = await this.detectMetricAnomaly(
      page,
      recentStart,
      baselineStart,
      baselineEnd,
      'conversionRate',
      'Conversion',
      'Conversion Rate',
      (data) => data.conversionRate,
    );
    anomalies.push(...conversionAnomalies);

    return anomalies;
  }

  /**
   * Detect performance anomalies
   */
  private async detectPerformanceAnomalies(
    page: string,
    recentStart: Date,
    baselineStart: Date,
    baselineEnd: Date,
  ): Promise<AnomalyDetectionResult[]> {
    const anomalies: AnomalyDetectionResult[] = [];

    // Check load time
    const loadTimeAnomalies = await this.detectMetricAnomaly(
      page,
      recentStart,
      baselineStart,
      baselineEnd,
      'avgLoadTime',
      'Performance',
      'Load Time',
      (data) => data.avgLoadTime,
    );
    anomalies.push(...loadTimeAnomalies);

    // Check error rate
    const errorAnomalies = await this.detectMetricAnomaly(
      page,
      recentStart,
      baselineStart,
      baselineEnd,
      'errorRate',
      'Performance',
      'Error Rate',
      (data) => data.errorRate,
    );
    anomalies.push(...errorAnomalies);

    return anomalies;
  }

  /**
   * Generic method to detect anomalies for any metric
   */
  private async detectMetricAnomaly(
    page: string,
    recentStart: Date,
    baselineStart: Date,
    baselineEnd: Date,
    metricField: string,
    metricType: string,
    metricName: string,
    valueExtractor: (data: any) => number,
  ): Promise<AnomalyDetectionResult[]> {
    const anomalies: AnomalyDetectionResult[] = [];

    // Get baseline data
    let baselineData: any[];
    if (metricField.includes('Session') || metricField.includes('bounce') || metricField.includes('conversion')) {
      baselineData = await this.prisma.userActionsHourly.findMany({
        where: {
          page,
          timestamp: {
            gte: baselineStart,
            lt: baselineEnd,
          },
        },
      });
    } else {
      baselineData = await this.prisma.performanceHourly.findMany({
        where: {
          page,
          timestamp: {
            gte: baselineStart,
            lt: baselineEnd,
          },
        },
      });
    }

    if (baselineData.length === 0) return anomalies;

    const baselineValues = baselineData.map(valueExtractor);
    const baselineMean = this.calculateMean(baselineValues);
    const baselineStdDev = this.calculateStdDev(baselineValues, baselineMean);

    // Get recent data
    let recentData: any[];
    if (metricField.includes('Session') || metricField.includes('bounce') || metricField.includes('conversion')) {
      recentData = await this.prisma.userActionsHourly.findMany({
        where: {
          page,
          timestamp: {
            gte: recentStart,
          },
        },
      });
    } else {
      recentData = await this.prisma.performanceHourly.findMany({
        where: {
          page,
          timestamp: {
            gte: recentStart,
          },
        },
      });
    }

    for (const recent of recentData) {
      const currentValue = valueExtractor(recent);
      const deviation = Math.abs(currentValue - baselineMean);
      const threshold = 2.5 * baselineStdDev;

      if (deviation > threshold && baselineMean > 0) {
        const percentageChange = ((currentValue - baselineMean) / baselineMean) * 100;

        anomalies.push({
          page: recent.page,
          metricType,
          metric: metricName,
          currentValue,
          baselineMean,
          baselineStdDev,
          percentageChange,
          timestamp: recent.timestamp,
          context: {
            deviceType: recent.deviceType,
            region: recent.region,
            referrer: recent.referrer,
            pageCategory: recent.pageCategory,
          },
        });
      }
    }

    return anomalies;
  }

  /**
   * Detect granular anomalies (per page/device/referrer/region combination)
   */
  private async detectTrafficAnomaliesGranular(
    combo: { page: string; deviceType?: string; referrer?: string; region?: string },
    recentStart: Date,
    baselineStart: Date,
    baselineEnd: Date,
  ): Promise<AnomalyDetectionResult[]> {
    const where: any = {
      page: combo.page,
      timestamp: {
        gte: baselineStart,
        lt: baselineEnd,
      },
    };
    if (combo.deviceType) where.deviceType = combo.deviceType;
    if (combo.referrer) where.referrer = combo.referrer;
    if (combo.region) where.region = combo.region;

    const baselineData = await this.prisma.pageViewsHourly.findMany({ where });
    if (baselineData.length === 0) return [];

    const baselineValues = baselineData.map((d) => d.viewCount);
    const baselineMean = this.calculateMean(baselineValues);
    const baselineStdDev = this.calculateStdDev(baselineValues, baselineMean);

    const recentWhere: any = {
      page: combo.page,
      timestamp: { gte: recentStart },
    };
    if (combo.deviceType) recentWhere.deviceType = combo.deviceType;
    if (combo.referrer) recentWhere.referrer = combo.referrer;
    if (combo.region) recentWhere.region = combo.region;

    const recentData = await this.prisma.pageViewsHourly.findMany({ where: recentWhere });
    const anomalies: AnomalyDetectionResult[] = [];

    for (const recent of recentData) {
      const deviation = Math.abs(recent.viewCount - baselineMean);
      const threshold = 2.5 * baselineStdDev;

      if (deviation > threshold && baselineMean > 0) {
        const percentageChange = ((recent.viewCount - baselineMean) / baselineMean) * 100;
        anomalies.push({
          page: recent.page,
          metricType: 'Traffic',
          metric: 'PageViews',
          currentValue: recent.viewCount,
          baselineMean,
          baselineStdDev,
          percentageChange,
          timestamp: recent.timestamp,
          context: {
            deviceType: recent.deviceType,
            region: recent.region,
            referrer: recent.referrer,
            pageCategory: recent.pageCategory,
          },
        });
      }
    }

    return anomalies;
  }

  private async detectEngagementAnomaliesGranular(
    combo: { page: string; deviceType?: string; referrer?: string; region?: string },
    recentStart: Date,
    baselineStart: Date,
    baselineEnd: Date,
  ): Promise<AnomalyDetectionResult[]> {
    // Similar implementation for granular engagement anomalies
    // For brevity, focusing on aggregated detection first
    return [];
  }

  private async detectPerformanceAnomaliesGranular(
    combo: { page: string; deviceType?: string; referrer?: string; region?: string },
    recentStart: Date,
    baselineStart: Date,
    baselineEnd: Date,
  ): Promise<AnomalyDetectionResult[]> {
    // Similar implementation for granular performance anomalies
    return [];
  }

  /**
   * Perform correlation analysis (simple and cross-table)
   */
  async analyzeCorrelations(
    anomalies: AnomalyDetectionResult[],
  ): Promise<CorrelationResult[]> {
    const correlations: CorrelationResult[] = [];

    for (const anomaly of anomalies) {
      const correlated: CorrelationResult['correlatedMetrics'] = [];

      // Cross-table correlation: Check if traffic increase correlates with conversion drop
      if (anomaly.metricType === 'Traffic' && anomaly.percentageChange > 0) {
        const conversionData = await this.getConversionDataForPage(
          anomaly.page,
          anomaly.timestamp,
        );
        if (conversionData && conversionData.conversionRate < conversionData.baselineRate * 0.9) {
          correlated.push({
            metric: 'Conversion Rate',
            value: conversionData.conversionRate,
            change: ((conversionData.conversionRate - conversionData.baselineRate) / conversionData.baselineRate) * 100,
            correlation: 'traffic_up_conversions_down',
          });
        }
      }

      // Cross-table correlation: Check if load time increase correlates with bounce rate increase
      if (anomaly.metricType === 'Performance' && anomaly.metric === 'Load Time' && anomaly.percentageChange > 0) {
        const bounceData = await this.getBounceRateForPage(
          anomaly.page,
          anomaly.timestamp,
        );
        if (bounceData && bounceData.bounceRate > bounceData.baselineBounceRate * 1.1) {
          correlated.push({
            metric: 'Bounce Rate',
            value: bounceData.bounceRate,
            change: ((bounceData.bounceRate - bounceData.baselineBounceRate) / bounceData.baselineBounceRate) * 100,
            correlation: 'load_time_up_bounce_rate_up',
          });
        }
      }

      if (correlated.length > 0) {
        correlations.push({
          primaryAnomaly: anomaly,
          correlatedMetrics: correlated,
        });
      }
    }

    return correlations;
  }

  /**
   * Helper methods
   */
  private calculateMean(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((sum, val) => sum + val, 0) / values.length;
  }

  private calculateStdDev(values: number[], mean: number): number {
    if (values.length === 0) return 0;
    const variance =
      values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    return Math.sqrt(variance);
  }

  private async getUniquePages(): Promise<string[]> {
    const pages = await this.prisma.pageViewsHourly.findMany({
      select: { page: true },
      distinct: ['page'],
    });
    return pages.map((p) => p.page);
  }

  private async getUniqueCombinations(): Promise<
    Array<{ page: string; deviceType?: string; referrer?: string; region?: string }>
  > {
    // Get unique combinations for granular analysis
    // For now, return page-level combinations
    const pages = await this.getUniquePages();
    return pages.map((page) => ({ page }));
  }

  private async getConversionDataForPage(
    page: string,
    timestamp: Date,
  ): Promise<{ conversionRate: number; baselineRate: number } | null> {
    const hourStart = new Date(timestamp);
    hourStart.setMinutes(0, 0, 0);
    const hourEnd = new Date(hourStart.getTime() + 60 * 60 * 1000);

    const recent = await this.prisma.userActionsHourly.findFirst({
      where: {
        page,
        timestamp: {
          gte: hourStart,
          lt: hourEnd,
        },
      },
    });

    if (!recent) return null;

    const baselineStart = new Date(timestamp.getTime() - 30 * 60 * 60 * 1000);
    const baselineEnd = new Date(timestamp.getTime() - 6 * 60 * 60 * 1000);

    const baseline = await this.prisma.userActionsHourly.findMany({
      where: {
        page,
        timestamp: {
          gte: baselineStart,
          lt: baselineEnd,
        },
      },
    });

    const baselineRate = baseline.length > 0
      ? baseline.reduce((sum, d) => sum + d.conversionRate, 0) / baseline.length
      : recent.conversionRate;

    return {
      conversionRate: recent.conversionRate,
      baselineRate,
    };
  }

  private async getBounceRateForPage(
    page: string,
    timestamp: Date,
  ): Promise<{ bounceRate: number; baselineBounceRate: number } | null> {
    const hourStart = new Date(timestamp);
    hourStart.setMinutes(0, 0, 0);
    const hourEnd = new Date(hourStart.getTime() + 60 * 60 * 1000);

    const recent = await this.prisma.userActionsHourly.findFirst({
      where: {
        page,
        timestamp: {
          gte: hourStart,
          lt: hourEnd,
        },
      },
    });

    if (!recent) return null;

    const baselineStart = new Date(timestamp.getTime() - 30 * 60 * 60 * 1000);
    const baselineEnd = new Date(timestamp.getTime() - 6 * 60 * 60 * 1000);

    const baseline = await this.prisma.userActionsHourly.findMany({
      where: {
        page,
        timestamp: {
          gte: baselineStart,
          lt: baselineEnd,
        },
      },
    });

    const baselineBounceRate = baseline.length > 0
      ? baseline.reduce((sum, d) => sum + d.bounceRate, 0) / baseline.length
      : recent.bounceRate;

    return {
      bounceRate: recent.bounceRate,
      baselineBounceRate,
    };
  }
}

