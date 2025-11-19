import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Generate 48 hours of mock data with 2-3 intentional anomalies
 */
async function seedDatabase(): Promise<void> {
  console.log('Starting database seed...');

  try {
    // Clear existing data
    await prisma.businessInsight.deleteMany();
    await prisma.performanceHourly.deleteMany();
    await prisma.userActionsHourly.deleteMany();
    await prisma.pageViewsHourly.deleteMany();

    const pages = [
      { path: '/coorg-adventure-trek', category: 'Adventure' },
      { path: '/maldives-packages', category: 'Beach' },
      { path: '/ladakh-bike-trip', category: 'Adventure' },
      { path: '/goa-beach-resort', category: 'Beach' },
      { path: '/rajasthan-heritage-tour', category: 'Heritage' },
      { path: '/kerala-backwaters', category: 'Hill Station' },
      { path: '/manali-snow-adventure', category: 'Adventure' },
      { path: '/andaman-diving', category: 'Wildlife' },
      { path: '/uttarakhand-trekking', category: 'Trekking' },
      { path: '/kashmir-houseboat', category: 'Hill Station' },
      { path: '/checkout', category: 'Checkout' },
    ];

    const referrers = ['Instagram', 'Google', 'Facebook', 'Direct', 'Email'];
    const referrerWeights = [0.2, 0.35, 0.15, 0.2, 0.1]; // Distribution percentages
    const devices = ['Mobile', 'Desktop', 'Tablet'];
    const deviceWeights = [0.6, 0.35, 0.05];
    const regions = ['South India', 'North India', 'International'];
    const regionWeights = [0.3, 0.4, 0.3];

    const now = new Date();
    const hoursToGenerate = 48;

    // Generate data for each hour
    for (let i = hoursToGenerate; i >= 0; i--) {
      const timestamp = new Date(now.getTime() - i * 60 * 60 * 1000);
      timestamp.setMinutes(0, 0, 0);

      for (const page of pages) {
        for (let j = 0; j < referrers.length; j++) {
          const referrer = referrers[j];
          const referrerWeight = referrerWeights[j];

          for (let k = 0; k < devices.length; k++) {
            const device = devices[k];
            const deviceWeight = deviceWeights[k];

            for (let l = 0; l < regions.length; l++) {
              const region = regions[l];
              const regionWeight = regionWeights[l];

              // Base values with some randomness
              const baseViews = getRandomInt(50, 500);
              const views = Math.round(
                baseViews * referrerWeight * deviceWeight * regionWeight,
              );

              // Create intentional anomalies in recent 6 hours
              let viewCount = views;
              let loadTime = getRandomInt(800, 2000); // milliseconds
              let sessionDuration = getRandomInt(120, 300); // seconds
              let bounceRate = getRandomInt(20, 50); // percentage
              let conversionRate = getRandomInt(200, 500) / 100; // percentage (2-5%)
              let errorRate = getRandomInt(0, 2); // percentage

              // Anomaly 1: Traffic surge on coorg-adventure-trek (Instagram, recent 6 hours)
              if (
                page.path === '/coorg-adventure-trek' &&
                referrer === 'Instagram' &&
                region === 'South India' &&
                i <= 6 &&
                i >= 4
              ) {
                viewCount = Math.round(views * 4.4); // +340% increase
              }

              // Anomaly 2: Performance degradation on maldives-packages (Mobile, recent 6 hours)
              if (
                page.path === '/maldives-packages' &&
                device === 'Mobile' &&
                i <= 6 &&
                i >= 5
              ) {
                loadTime = Math.round(loadTime * 2.5); // +150% increase
                bounceRate = Math.round(bounceRate * 1.25); // +25% increase
              }

              // Anomaly 3: Session duration drop on checkout (recent 6 hours)
              if (page.path === '/checkout' && i <= 6 && i >= 4) {
                sessionDuration = Math.round(sessionDuration * 0.55); // -45% decrease
              }

              // Anomaly 4: Conversion rate drop on ladakh-bike-trip (recent 6 hours)
              if (page.path === '/ladakh-bike-trip' && i <= 6 && i >= 3) {
                conversionRate = conversionRate * 0.62; // -38% decrease
              }

              // Create pageviews record
              if (viewCount > 0) {
                await prisma.pageViewsHourly.create({
                  data: {
                    timestamp,
                    page: page.path,
                    pageCategory: page.category,
                    viewCount,
                    referrer,
                    deviceType: device,
                    region,
                  },
                });
              }

              // Create user actions record (every 3rd combination to reduce data)
              if (j % 3 === 0 && k % 2 === 0) {
                const conversionCount = Math.round(
                  (viewCount * conversionRate) / 100,
                );

                await prisma.userActionsHourly.create({
                  data: {
                    timestamp,
                    page: page.path,
                    pageCategory: page.category,
                    avgSessionDuration: sessionDuration,
                    bounceRate,
                    conversionRate,
                    conversionCount,
                    deviceType: device,
                    referrer,
                    region,
                  },
                });
              }

              // Create performance record (every 3rd combination)
              if (j % 3 === 0 && k % 2 === 0) {
                await prisma.performanceHourly.create({
                  data: {
                    timestamp,
                    page: page.path,
                    pageCategory: page.category,
                    avgLoadTime: loadTime,
                    errorRate,
                    deviceType: device,
                    region,
                  },
                });
              }
            }
          }
        }
      }
    }

    console.log('Database seed completed successfully!');
  } catch (error) {
    console.error('Seed failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

function getRandomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Run the seed
seedDatabase()
  .then(() => {
    console.log('Seed process completed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Seed process failed:', error);
    process.exit(1);
  });
