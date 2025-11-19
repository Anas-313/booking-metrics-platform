export class BusinessInsightResponseDto {
  type: string;
  metric: string;
  page: string;
  change: string;
  businessInsight: string;
  suggestedAction: string;
  impactScore: number;
  detectedAt: string;
  context?: Record<string, any>;
}

export class InsightsResponseDto {
  success: boolean;
  timestamp: string;
  cachedUntil?: string;
  insights: BusinessInsightResponseDto[];
}

