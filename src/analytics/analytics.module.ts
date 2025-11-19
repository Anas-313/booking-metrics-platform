import { Module } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { AnomalyDetectorService } from './anomaly-detector.service';

@Module({
  providers: [AnalyticsService, AnomalyDetectorService],
  exports: [AnalyticsService, AnomalyDetectorService],
})
export class AnalyticsModule {}

