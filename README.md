# Business Insight Engine for Travel Booking Analytics

A NestJS backend application that analyzes booking and performance data to detect anomalies and generate actionable business insights for travel booking platforms.

## Project Overview

This system provides automated anomaly detection and business insight generation for travel booking platforms. It analyzes hourly aggregated data including pageviews, user actions, and performance metrics to identify unusual patterns and provide actionable recommendations.

## Technology Stack

- **Framework**: NestJS 11
- **ORM**: Prisma 6
- **Database**: PostgreSQL
- **Language**: TypeScript
- **Package Manager**: Yarn
- **Caching**: NestJS Cache Manager

## Prerequisites

- Node.js (v18 or higher)
- PostgreSQL database
- Yarn package manager

## Setup Instructions

### 1. Install Dependencies

```bash
yarn install
```

### 2. Database Configuration

Create a `.env` file in the root directory with your database connection string:

```env
DATABASE_URL="postgresql://username:password@localhost:5432/insight_engine?schema=public"
PORT=3000
```

### 3. Database Migration

Run Prisma migrations to create the database schema:

```bash
npx prisma migrate dev --name init
```

This will create the following tables:
- `pageviews_hourly` - Hourly aggregated pageview data
- `useractions_hourly` - Hourly user action metrics
- `performance_hourly` - Hourly performance metrics
- `business_insights` - Stored generated insights (bonus feature)

### 4. Generate Prisma Client

```bash
npx prisma generate
```

### 5. Seed Database

Populate the database with 48 hours of mock data including 2-3 intentional anomalies:

```bash
yarn seed
```

**Note**: The seed script is a standalone Node.js script located at `scripts/seed.ts`. It uses PrismaClient directly and doesn't require the NestJS application to be running.

This will generate:
- 48 hours of hourly data
- 10-12 different travel package pages
- Realistic traffic patterns (50-500 views per hour)
- 2-3 intentional anomalies in recent 6 hours:
  - Traffic surge: +340% spike on `/coorg-adventure-trek` (Instagram)
  - Performance degradation: +150% load time on `/maldives-packages` (Mobile)
  - Session duration drop: -45% on `/checkout`
  - Conversion rate drop: -38% on `/ladakh-bike-trip`

### 6. Run the Application

```bash
# Development mode
yarn start:dev

# Production mode
yarn build
yarn start:prod
```

The server will start on `http://localhost:3000` (or the port specified in `.env`).

## API Documentation

### Get Business Insights

**Endpoint**: `GET /api/insights/business`

**Description**: Returns top 5 business insights sorted by impact score. Results are cached for 15 minutes.

**Response Format**:

```json
{
  "success": true,
  "timestamp": "2025-11-19T10:30:00Z",
  "cachedUntil": "2025-11-19T10:45:00Z",
  "insights": [
    {
      "type": "Traffic Surge",
      "metric": "PageViews",
      "page": "/coorg-adventure-trek",
      "change": "+340%",
      "businessInsight": "Traffic surge of +340% detected on /coorg-adventure-trek. Organic traffic spike from Instagram campaign — likely viral post engagement. Primary traffic from South India.",
      "suggestedAction": "Increase ad spend for South India audiences. Create follow-up content to maintain momentum.",
      "impactScore": 85,
      "detectedAt": "2025-11-19T07:00:00Z",
      "context": {
        "referrer": "Instagram",
        "region": "South India",
        "deviceType": "Mobile"
      }
    }
    // ... up to 5 insights
  ]
}
```

**Insight Types**:
- `Traffic Surge` / `Traffic Drop` - Unusual pageview patterns
- `Performance Issue` - Load time or error rate anomalies
- `Engagement Drop` - Session duration or bounce rate issues
- `Conversion Drop` - Conversion rate anomalies

**Caching**: Results are cached for 15 minutes to avoid redundant calculations.

## Database Schema

### `pageviews_hourly`

Stores hourly aggregated pageview data.

| Field | Type | Description |
|-------|------|-------------|
| id | Int | Primary key |
| timestamp | DateTime | Hour bucket |
| page | String | Page path (e.g., "/coorg-adventure-trek") |
| pageCategory | String | Category (e.g., "Adventure", "Beach") |
| viewCount | Int | Number of pageviews |
| referrer | String | Traffic source (Instagram, Google, Facebook, Direct, Email) |
| deviceType | String | Device type (Mobile, Desktop, Tablet) |
| region | String | Geographic region |
| createdAt | DateTime | Record creation timestamp |

### `useractions_hourly`

Stores hourly user action metrics.

| Field | Type | Description |
|-------|------|-------------|
| id | Int | Primary key |
| timestamp | DateTime | Hour bucket |
| page | String | Page path |
| pageCategory | String | Category |
| avgSessionDuration | Float | Average session duration in seconds |
| bounceRate | Float | Bounce rate percentage (0-100) |
| conversionRate | Float | Conversion rate percentage (0-100) |
| conversionCount | Int | Actual number of bookings |
| deviceType | String | Device type |
| referrer | String | Traffic source |
| region | String | Geographic region |
| createdAt | DateTime | Record creation timestamp |

### `performance_hourly`

Stores hourly performance metrics.

| Field | Type | Description |
|-------|------|-------------|
| id | Int | Primary key |
| timestamp | DateTime | Hour bucket |
| page | String | Page path |
| pageCategory | String | Category |
| avgLoadTime | Float | Average load time in milliseconds |
| errorRate | Float | Error rate percentage (0-100) |
| deviceType | String | Device type |
| region | String | Geographic region |
| createdAt | DateTime | Record creation timestamp |

### `business_insights`

Stores generated insights (bonus feature).

| Field | Type | Description |
|-------|------|-------------|
| id | Int | Primary key |
| metricType | String | Insight type (e.g., "Traffic Surge") |
| page | String | Page path |
| insightText | String | Human-readable description |
| suggestedAction | String | Actionable recommendation |
| impactScore | Float | Business impact score (0-100) |
| timestamp | DateTime | When anomaly was detected |
| createdAt | DateTime | Record creation timestamp |

## Assumptions and Reasoning

### Domain Assumptions

1. **Conversion Rate Baseline**: A healthy conversion rate for travel packages is 2-5%. Drops below 1% are considered critical and require immediate attention.

2. **Session Duration**: Average session for package browsing should be 3-5 minutes. Drops below 2 minutes indicate engagement issues that may impact conversions.

3. **Load Time**: Mobile load times above 3 seconds significantly impact bounce rate (based on industry standards). Desktop load times above 2 seconds are concerning.

4. **Traffic Spikes**: Social media traffic spikes (especially Instagram) are positive if conversion rate remains stable or increases. If conversion rate drops during traffic spikes, it indicates quality or UX issues.

5. **Bounce Rate**: Bounce rates above 50% for product pages indicate content mismatch or poor user experience. Bounce rates above 70% are critical.

### Statistical Threshold Selection

**Why 2.5 Standard Deviations?**

- **Statistical Significance**: 2.5σ captures approximately 98.76% of normal distribution, flagging only the most significant outliers
- **Balance**: More sensitive than 3σ (99.73%), less noisy than 2σ (95.45%)
- **Business Context**: For hourly data, 2.5σ provides good balance between detecting real issues and avoiding false positives

### Impact Scoring Logic

Impact score is calculated using weighted components:

1. **Magnitude (30% weight)**: Percentage deviation from baseline
   - Formula: `min(|percentageChange| / 5, 100)`
   - Normalizes large percentage changes to 0-100 scale

2. **Criticality (40% weight)**: Metric importance to business
   - Conversion/Error metrics: 90 points (highest priority)
   - Performance/Engagement metrics: 70 points (medium-high)
   - Traffic metrics: 60 points (medium)

3. **Recency (30% weight)**: How recent the anomaly is
   - Formula: `max(0, 100 - hoursAgo * 10)`
   - Decreases 10 points per hour since detection
   - Recent anomalies score higher

**Final Score**: `(magnitude * 0.3) + (criticality * 0.4) + (recency * 0.3)`

### Insight Generation Reasoning

1. **Traffic Surge Insights**: 
   - Instagram traffic spikes suggest viral content → recommend capitalizing on momentum
   - Google traffic increases suggest SEO improvement → recommend maintaining quality
   - Traffic up but conversions down → flag pricing/UX issues

2. **Performance Insights**:
   - Mobile load time increases → prioritize mobile optimization
   - Correlation with bounce rate → confirm performance impact
   - Error rate spikes → immediate technical investigation needed

3. **Engagement Insights**:
   - Checkout page drops → payment gateway or flow issues
   - General page drops → content or usability problems

4. **Conversion Insights**:
   - High traffic, low conversion → pricing, availability, or trust issues
   - General drops → pricing strategy or technical problems

### Data Patterns

**Mock Data Generation**:
- **Time Range**: 48 hours of hourly data
- **Pages**: 10-12 travel package pages covering different categories
- **Traffic Distribution**: 
  - Referrers: Instagram (20%), Google (35%), Facebook (15%), Direct (20%), Email (10%)
  - Devices: Mobile (60%), Desktop (35%), Tablet (5%)
  - Regions: South India (30%), North India (40%), International (30%)
- **Normal Traffic**: 50-500 views per hour per page
- **Anomalies**: Intentionally placed in recent 6 hours to test detection

## Architecture

### Module Structure

```
src/
├── main.ts                    # Application entry point
├── app.module.ts              # Root module
├── insights/                   # Insights module
│   ├── insights.module.ts
│   ├── insights.controller.ts # API endpoints
│   ├── insights.service.ts    # Business logic
│   ├── dto/                   # Data transfer objects
│   └── interfaces/             # TypeScript interfaces
├── analytics/                  # Analytics module
│   ├── analytics.module.ts
│   ├── analytics.service.ts   # Raw data access
│   └── anomaly-detector.service.ts # Anomaly detection logic
├── seed/                       # Seed module
│   ├── seed.module.ts
│   ├── seed.service.ts        # Mock data generation
│   └── seed.cli.ts            # CLI entry point
└── prisma/                     # Prisma configuration
    ├── schema.prisma          # Database schema
    ├── prisma.module.ts
    └── prisma.service.ts
```

### Anomaly Detection Flow

1. **Data Collection**: Fetch recent 6 hours and baseline 24 hours of data
2. **Statistical Analysis**: Calculate mean and standard deviation for each metric
3. **Anomaly Detection**: Flag values exceeding 2.5σ threshold
4. **Correlation Analysis**: Cross-table analysis to find related anomalies
5. **Insight Generation**: Convert anomalies to business insights with context
6. **Impact Scoring**: Calculate business impact scores
7. **Ranking**: Sort by impact score and return top 5

### Caching Strategy

- **Cache Duration**: 15 minutes (900 seconds)
- **Cache Key**: Endpoint path (`/api/insights/business`)
- **Cache Storage**: In-memory (NestJS Cache Manager)
- **Rationale**: Insights don't change frequently, caching reduces database load

## Testing

### Manual Testing Steps

1. **Seed Data Validation**:
   ```bash
   yarn seed
   ```
   Verify 48 hours of data exists in database.

2. **Anomaly Detection Test**:
   ```bash
   curl http://localhost:3000/api/insights/business
   ```
   Should return 5 insights with intentional anomalies detected.

3. **Cache Test**:
   - Call endpoint twice within 15 minutes
   - Second call should use cached result (faster response)

4. **Empty Data Test**:
   - Clear database tables
   - Call endpoint
   - Should return empty insights array with success: true

## Development

### Available Scripts

- `yarn start:dev` - Start development server with hot reload
- `yarn build` - Build for production
- `yarn start:prod` - Run production build
- `yarn seed` - Seed database with mock data (standalone Node.js script)
- `yarn lint` - Run ESLint
- `yarn test` - Run unit tests
- `yarn test:e2e` - Run end-to-end tests

### Code Quality Standards

- **TypeScript**: Strict typing for all functions and DTOs
- **NestJS Conventions**: Proper use of decorators, dependency injection, modules
- **Error Handling**: Try-catch blocks with proper error messages
- **Comments**: Complex logic (especially statistical calculations) is documented
- **Modular Design**: Separation of concerns (detection, insight generation, scoring)

## Future Enhancements

- [ ] Real-time anomaly detection via webhooks
- [ ] Email/Slack notifications for critical insights
- [ ] Historical trend analysis
- [ ] Machine learning-based anomaly detection
- [ ] Dashboard UI for visualization
- [ ] Custom alert thresholds per metric
- [ ] Multi-tenant support

## License

UNLICENSED

## Support

For issues or questions, please refer to the project documentation or create an issue in the repository.
