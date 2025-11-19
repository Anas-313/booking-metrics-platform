import { Controller, Get, UseInterceptors } from '@nestjs/common';
import { CacheInterceptor, CacheTTL } from '@nestjs/cache-manager';
import { InsightsService } from './insights.service';
import { InsightsResponseDto } from './dto/business-insight.dto';

@Controller('insights')
@UseInterceptors(CacheInterceptor)
export class InsightsController {
  constructor(private readonly insightsService: InsightsService) {}

  @Get('business')
  @CacheTTL(900) // 15 minutes in seconds
  async getBusinessInsights(): Promise<InsightsResponseDto> {
    const insights = await this.insightsService.generateBusinessInsights();

    // Store insights in database (bonus feature) - only if insights exist
    if (insights.length > 0) {
      try {
        await this.insightsService.storeInsights(insights);
      } catch (error) {
        // Log error but don't fail the request
        console.error('Failed to store insights:', error);
      }
    }

    const now = new Date();
    const cachedUntil = new Date(now.getTime() + 15 * 60 * 1000); // 15 minutes from now

    return {
      success: true,
      timestamp: now.toISOString(),
      cachedUntil: cachedUntil.toISOString(),
      insights: insights.map((insight) => ({
        type: insight.type,
        metric: insight.metric,
        page: insight.page,
        change: insight.change,
        businessInsight: insight.businessInsight,
        suggestedAction: insight.suggestedAction,
        impactScore: insight.impactScore,
        detectedAt: insight.detectedAt,
        context: insight.context,
      })),
    };
  }
}

