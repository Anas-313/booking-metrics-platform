import { Injectable } from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';
import { AnomalyDetectorService } from '../analytics/anomaly-detector.service';
import { BusinessInsight } from './interfaces/insight.interface';

@Injectable()
export class InsightsService {
  constructor(
    private prisma: PrismaService,
    private anomalyDetector: AnomalyDetectorService,
  ) {}

  /**
   * Generate business insights from detected anomalies
   */
  async generateBusinessInsights(): Promise<BusinessInsight[]> {
    // Detect anomalies (both aggregated and granular)
    const aggregatedAnomalies = await this.anomalyDetector.detectAnomalies();
    const granularAnomalies = await this.anomalyDetector.detectGranularAnomalies();
    
    // Combine and deduplicate
    const allAnomalies = [...aggregatedAnomalies, ...granularAnomalies];
    const uniqueAnomalies = this.deduplicateAnomalies(allAnomalies);

    // Analyze correlations
    const correlations = await this.anomalyDetector.analyzeCorrelations(uniqueAnomalies);

    // Generate insights
    const insights: BusinessInsight[] = [];

    for (const anomaly of uniqueAnomalies) {
      const insight = await this.generateInsightForAnomaly(anomaly, correlations);
      if (insight) {
        insights.push(insight);
      }
    }

    // Calculate impact scores and sort
    const scoredInsights = insights
      .map((insight) => ({
        ...insight,
        impactScore: this.calculateImpactScore(insight, uniqueAnomalies),
      }))
      .sort((a, b) => b.impactScore - a.impactScore);

    // Return top 5
    return scoredInsights.slice(0, 5);
  }

  /**
   * Generate insight for a single anomaly
   */
  private async generateInsightForAnomaly(
    anomaly: any,
    correlations: any[],
  ): Promise<BusinessInsight | null> {
    const correlation = correlations.find(
      (c) => c.primaryAnomaly.page === anomaly.page && 
             c.primaryAnomaly.timestamp.getTime() === anomaly.timestamp.getTime(),
    );

    const changeSign = anomaly.percentageChange >= 0 ? '+' : '';
    const change = `${changeSign}${anomaly.percentageChange.toFixed(0)}%`;

    // Determine insight type and generate appropriate insight
    if (anomaly.metricType === 'Traffic' && anomaly.metric === 'PageViews') {
      return this.generateTrafficInsight(anomaly, change, correlation);
    } else if (anomaly.metricType === 'Performance' && anomaly.metric === 'Load Time') {
      return this.generatePerformanceInsight(anomaly, change, correlation);
    } else if (anomaly.metricType === 'UserActions' && anomaly.metric === 'Session Duration') {
      return this.generateEngagementInsight(anomaly, change, correlation);
    } else if (anomaly.metricType === 'Conversion' && anomaly.metric === 'Conversion Rate') {
      return this.generateConversionInsight(anomaly, change, correlation);
    } else if (anomaly.metricType === 'Engagement' && anomaly.metric === 'Bounce Rate') {
      return this.generateBounceRateInsight(anomaly, change, correlation);
    } else if (anomaly.metricType === 'Performance' && anomaly.metric === 'Error Rate') {
      return this.generateErrorRateInsight(anomaly, change, correlation);
    }

    return null;
  }

  /**
   * Generate traffic surge insight
   */
  private generateTrafficInsight(
    anomaly: any,
    change: string,
    correlation: any,
  ): BusinessInsight {
    const referrer = anomaly.context?.referrer || 'Unknown';
    const region = anomaly.context?.region || 'All regions';

    let businessInsight = `Traffic ${anomaly.percentageChange > 0 ? 'surge' : 'drop'} of ${change} detected on ${anomaly.page}. `;
    let suggestedAction = '';

    if (anomaly.percentageChange > 0) {
      if (referrer === 'Instagram') {
        businessInsight += `Organic traffic spike from Instagram campaign — likely viral post engagement. Primary traffic from ${region}.`;
        suggestedAction = `Increase ad spend for ${region} audiences. Create follow-up content to maintain momentum.`;
      } else if (referrer === 'Google') {
        businessInsight += `Significant increase in organic search traffic. Page may have improved search ranking.`;
        suggestedAction = `Analyze SEO performance, ensure content quality, and consider increasing paid search budget.`;
      } else {
        businessInsight += `Traffic increase from ${referrer}. Monitor conversion rates to ensure quality traffic.`;
        suggestedAction = `Verify campaign performance and ensure sufficient inventory for increased demand.`;
      }

      // Check for negative correlation (traffic up but conversions down)
      if (correlation?.correlatedMetrics?.some((m: any) => m.correlation === 'traffic_up_conversions_down')) {
        businessInsight += ` However, conversion rate has dropped, indicating potential UX or pricing issues.`;
        suggestedAction += ` Review pricing competitiveness and checkout flow.`;
      }
    } else {
      businessInsight += `Significant drop in traffic from ${referrer}. Page may have lost visibility or interest has declined.`;
      suggestedAction = `Audit SEO performance, check for technical issues, and consider refreshing content or running paid campaigns.`;
    }

    return {
      type: anomaly.percentageChange > 0 ? 'Traffic Surge' : 'Traffic Drop',
      metric: 'PageViews',
      page: anomaly.page,
      change,
      businessInsight,
      suggestedAction,
      impactScore: 0, // Will be calculated later
      detectedAt: anomaly.timestamp.toISOString(),
      context: {
        referrer,
        region,
        deviceType: anomaly.context?.deviceType,
      },
    };
  }

  /**
   * Generate performance degradation insight
   */
  private generatePerformanceInsight(
    anomaly: any,
    change: string,
    correlation: any,
  ): BusinessInsight {
    const deviceType = anomaly.context?.deviceType || 'All devices';
    const loadTimeSeconds = (anomaly.currentValue / 1000).toFixed(1);

    let businessInsight = `Performance degradation detected: ${deviceType} load time increased by ${change} (now ${loadTimeSeconds}s). `;
    let suggestedAction = '';

    if (deviceType === 'Mobile') {
      businessInsight += `Mobile load time significantly increased. Images may be unoptimized affecting conversion.`;
      suggestedAction = `Optimize images for mobile (WebP format, lazy loading), check CDN performance, and review recent code deployments.`;
    } else {
      businessInsight += `Load time increase may be impacting user experience and conversions.`;
      suggestedAction = `Check server performance, optimize assets, review CDN configuration, and investigate recent deployments.`;
    }

    // Check for correlation with bounce rate
    if (correlation?.correlatedMetrics?.some((m: any) => m.correlation === 'load_time_up_bounce_rate_up')) {
      const bounceChange = correlation.correlatedMetrics.find((m: any) => m.correlation === 'load_time_up_bounce_rate_up');
      businessInsight += ` Bounce rate increased by ${bounceChange.change.toFixed(0)}% in correlation, confirming performance impact.`;
      suggestedAction += ` Priority: Fix performance issues immediately to prevent further engagement loss.`;
    }

    return {
      type: 'Performance Issue',
      metric: 'Load Time',
      page: anomaly.page,
      change,
      businessInsight,
      suggestedAction,
      impactScore: 0,
      detectedAt: anomaly.timestamp.toISOString(),
      context: {
        deviceType,
        bounceRateIncrease: correlation?.correlatedMetrics?.find((m: any) => m.correlation === 'load_time_up_bounce_rate_up')?.change?.toFixed(0) + '%',
      },
    };
  }

  /**
   * Generate engagement drop insight
   */
  private generateEngagementInsight(
    anomaly: any,
    change: string,
    correlation: any,
  ): BusinessInsight {
    const page = anomaly.page;
    const sessionDurationMinutes = (anomaly.currentValue / 60).toFixed(1);

    let businessInsight = `Engagement drop detected: Average session duration decreased by ${change} (now ${sessionDurationMinutes} minutes). `;
    let suggestedAction = '';

    if (page.includes('checkout')) {
      businessInsight += `Users dropping off during checkout. Possible payment gateway issue or confusing checkout flow.`;
      suggestedAction = `Immediately verify Razorpay integration, check error logs, and consider A/B testing a simplified checkout process.`;
    } else {
      businessInsight += `Users spending less time on page. Content may not be engaging or page may have usability issues.`;
      suggestedAction = `Review page content, check for broken elements, improve CTAs, and analyze user flow.`;
    }

    return {
      type: 'Engagement Drop',
      metric: 'Session Duration',
      page,
      change,
      businessInsight,
      suggestedAction,
      impactScore: 0,
      detectedAt: anomaly.timestamp.toISOString(),
      context: {
        deviceType: anomaly.context?.deviceType,
        region: anomaly.context?.region,
      },
    };
  }

  /**
   * Generate conversion drop insight
   */
  private generateConversionInsight(
    anomaly: any,
    change: string,
    correlation: any,
  ): BusinessInsight {
    const page = anomaly.page;
    const conversionRate = anomaly.currentValue.toFixed(2);

    let businessInsight = `Conversion rate dropped by ${change} (now ${conversionRate}%). `;
    let suggestedAction = '';

    // Check if traffic increased but conversions decreased
    if (correlation?.correlatedMetrics?.some((m: any) => m.correlation === 'traffic_up_conversions_down')) {
      businessInsight += `High traffic but low conversions. Possible pricing, availability, or trust issues.`;
      suggestedAction = `Review package pricing competitiveness, ensure availability is shown correctly, and add more customer reviews/testimonials.`;
    } else {
      businessInsight += `Conversion rate decline may indicate pricing issues, lack of trust, or technical problems.`;
      suggestedAction = `Review pricing strategy, add trust signals (reviews, badges), verify booking flow, and check for errors.`;
    }

    return {
      type: 'Conversion Drop',
      metric: 'Conversion Rate',
      page,
      change,
      businessInsight,
      suggestedAction,
      impactScore: 0,
      detectedAt: anomaly.timestamp.toISOString(),
      context: {
        referrer: anomaly.context?.referrer,
        deviceType: anomaly.context?.deviceType,
      },
    };
  }

  /**
   * Generate bounce rate insight
   */
  private generateBounceRateInsight(
    anomaly: any,
    change: string,
    correlation: any,
  ): BusinessInsight {
    const bounceRate = anomaly.currentValue.toFixed(1);

    let businessInsight = `Bounce rate increased by ${change} (now ${bounceRate}%). `;
    let suggestedAction = '';

    businessInsight += `Users leaving page quickly may indicate content mismatch, slow load times, or poor user experience.`;
    suggestedAction = `Improve page content relevance, optimize load times, enhance mobile experience, and review landing page design.`;

    return {
      type: 'Engagement Drop',
      metric: 'Bounce Rate',
      page: anomaly.page,
      change,
      businessInsight,
      suggestedAction,
      impactScore: 0,
      detectedAt: anomaly.timestamp.toISOString(),
      context: {
        deviceType: anomaly.context?.deviceType,
      },
    };
  }

  /**
   * Generate error rate insight
   */
  private generateErrorRateInsight(
    anomaly: any,
    change: string,
    correlation: any,
  ): BusinessInsight {
    const errorRate = anomaly.currentValue.toFixed(2);

    let businessInsight = `Error rate increased by ${change} (now ${errorRate}%). `;
    let suggestedAction = '';

    businessInsight += `Increased error rate indicates technical issues that may be preventing bookings and damaging user trust.`;
    suggestedAction = `Immediately check server logs, verify API endpoints, test payment gateway, and review recent deployments. Consider rolling back if recent changes were made.`;

    return {
      type: 'Performance Issue',
      metric: 'Error Rate',
      page: anomaly.page,
      change,
      businessInsight,
      suggestedAction,
      impactScore: 0,
      detectedAt: anomaly.timestamp.toISOString(),
      context: {
        deviceType: anomaly.context?.deviceType,
        region: anomaly.context?.region,
      },
    };
  }

  /**
   * Calculate impact score (30% magnitude, 40% criticality, 30% recency)
   */
  private calculateImpactScore(
    insight: BusinessInsight,
    allAnomalies: any[],
  ): number {
    // Find the anomaly that generated this insight
    const anomaly = allAnomalies.find(
      (a) => a.page === insight.page && 
             new Date(a.timestamp).toISOString() === insight.detectedAt,
    );

    if (!anomaly) return 50; // Default score

    // Magnitude component (30% weight)
    const magnitudeScore = Math.min(Math.abs(anomaly.percentageChange) / 5, 100); // Normalize to 0-100
    const magnitudeWeight = 0.3;

    // Criticality component (40% weight)
    let criticalityScore = 50; // Default
    if (insight.type.includes('Conversion') || insight.type.includes('Error')) {
      criticalityScore = 90; // High criticality
    } else if (insight.type.includes('Performance') || insight.type.includes('Engagement')) {
      criticalityScore = 70; // Medium-high criticality
    } else if (insight.type.includes('Traffic')) {
      criticalityScore = 60; // Medium criticality
    }
    const criticalityWeight = 0.4;

    // Recency component (30% weight)
    const now = new Date();
    const detectedAt = new Date(insight.detectedAt);
    const hoursAgo = (now.getTime() - detectedAt.getTime()) / (1000 * 60 * 60);
    const recencyScore = Math.max(0, 100 - hoursAgo * 10); // Decrease 10 points per hour
    const recencyWeight = 0.3;

    // Calculate weighted score
    const impactScore =
      magnitudeScore * magnitudeWeight +
      criticalityScore * criticalityWeight +
      recencyScore * recencyWeight;

    return Math.round(impactScore);
  }

  /**
   * Deduplicate anomalies (same page, metric, and timestamp)
   */
  private deduplicateAnomalies(anomalies: any[]): any[] {
    const seen = new Set<string>();
    const unique: any[] = [];

    for (const anomaly of anomalies) {
      const key = `${anomaly.page}-${anomaly.metric}-${anomaly.timestamp.getTime()}`;
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(anomaly);
      }
    }

    return unique;
  }

  /**
   * Store insights in database (bonus feature)
   */
  async storeInsights(insights: BusinessInsight[]): Promise<void> {
    for (const insight of insights) {
      await this.prisma.businessInsight.create({
        data: {
          metricType: insight.type,
          page: insight.page,
          insightText: insight.businessInsight,
          suggestedAction: insight.suggestedAction,
          impactScore: insight.impactScore,
          timestamp: new Date(insight.detectedAt),
        },
      });
    }
  }
}

