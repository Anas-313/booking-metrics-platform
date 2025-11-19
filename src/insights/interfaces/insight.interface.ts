export interface BusinessInsight {
  type: string;
  metric: string;
  page: string;
  change: string;
  businessInsight: string;
  suggestedAction: string;
  impactScore: number;
  detectedAt: string;
  context?: {
    deviceType?: string;
    region?: string;
    referrer?: string;
    [key: string]: any;
  };
}

export interface AnomalyDetectionResult {
  page: string;
  metricType: string;
  metric: string;
  currentValue: number;
  baselineMean: number;
  baselineStdDev: number;
  percentageChange: number;
  timestamp: Date;
  context: {
    deviceType?: string;
    region?: string;
    referrer?: string;
    pageCategory?: string;
  };
}

export interface CorrelationResult {
  primaryAnomaly: AnomalyDetectionResult;
  correlatedMetrics: {
    metric: string;
    value: number;
    change: number;
    correlation: string; // e.g., "traffic_up_conversions_down"
  }[];
}

