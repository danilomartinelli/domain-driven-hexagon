/**
 * Custom Jest matchers for performance testing
 * Provides specialized assertions for refactored component performance validation
 */

declare global {
  namespace jest {
    interface Matchers<R> {
      toBeWithinPerformanceThreshold(threshold: number, unit?: 'ms' | 'μs'): R;
      toHaveMemoryUsageLessThan(limitMB: number): R;
      toHaveCacheHitRateAbove(rate: number): R;
      toShowPerformanceImprovement(baseline: number, minimumImprovement: number): R;
      toCompleteWithinTimeLimit(timeLimit: number): R;
    }
  }
}

expect.extend({
  /**
   * Assert that a performance measurement is within acceptable threshold
   */
  toBeWithinPerformanceThreshold(received: number, threshold: number, unit = 'ms') {
    const unitMultiplier = unit === 'μs' ? 1000 : 1;
    const adjustedThreshold = threshold * unitMultiplier;
    const adjustedReceived = received * (unit === 'μs' ? 1000 : 1);

    const pass = adjustedReceived <= adjustedThreshold;

    return {
      message: () => 
        pass
          ? `Expected performance ${adjustedReceived}${unit} to exceed threshold ${adjustedThreshold}${unit}`
          : `Expected performance ${adjustedReceived}${unit} to be within threshold ${adjustedThreshold}${unit}`,
      pass,
    };
  },

  /**
   * Assert that memory usage is below specified limit
   */
  toHaveMemoryUsageLessThan(received: number, limitMB: number) {
    const receivedMB = received / (1024 * 1024);
    const pass = receivedMB < limitMB;

    return {
      message: () =>
        pass
          ? `Expected memory usage ${receivedMB.toFixed(2)}MB to exceed limit ${limitMB}MB`
          : `Expected memory usage ${receivedMB.toFixed(2)}MB to be less than ${limitMB}MB`,
      pass,
    };
  },

  /**
   * Assert that cache hit rate meets expectations
   */
  toHaveCacheHitRateAbove(received: number, rate: number) {
    const pass = received > rate;

    return {
      message: () =>
        pass
          ? `Expected cache hit rate ${(received * 100).toFixed(2)}% to be below ${(rate * 100).toFixed(2)}%`
          : `Expected cache hit rate ${(received * 100).toFixed(2)}% to be above ${(rate * 100).toFixed(2)}%`,
      pass,
    };
  },

  /**
   * Assert that performance shows improvement over baseline
   */
  toShowPerformanceImprovement(received: number, baseline: number, minimumImprovement: number) {
    const actualImprovement = ((baseline - received) / baseline) * 100;
    const pass = actualImprovement >= minimumImprovement;

    return {
      message: () =>
        pass
          ? `Expected performance improvement ${actualImprovement.toFixed(2)}% to be less than minimum ${minimumImprovement}%`
          : `Expected performance improvement ${actualImprovement.toFixed(2)}% to be at least ${minimumImprovement}%`,
      pass,
    };
  },

  /**
   * Assert that operation completes within time limit
   */
  toCompleteWithinTimeLimit(received: number, timeLimit: number) {
    const pass = received <= timeLimit;

    return {
      message: () =>
        pass
          ? `Expected operation time ${received.toFixed(2)}ms to exceed limit ${timeLimit}ms`
          : `Expected operation to complete within ${timeLimit}ms, but took ${received.toFixed(2)}ms`,
      pass,
    };
  },
});

// Performance testing utilities
export const performanceMatchers = {
  /**
   * Create a performance benchmark baseline
   */
  createBaseline(name: string, value: number, unit = 'ms') {
    (global as any).__performanceBaselines = (global as any).__performanceBaselines || {};
    (global as any).__performanceBaselines[name] = { value, unit, timestamp: Date.now() };
  },

  /**
   * Get a performance baseline
   */
  getBaseline(name: string) {
    const baselines = (global as any).__performanceBaselines || {};
    return baselines[name];
  },

  /**
   * Assert against stored baseline
   */
  expectToImproveBaseline(currentValue: number, baselineName: string, minimumImprovement: number) {
    const baseline = this.getBaseline(baselineName);
    if (!baseline) {
      throw new Error(`Performance baseline "${baselineName}" not found`);
    }

    expect(currentValue).toShowPerformanceImprovement(baseline.value, minimumImprovement);
  },

  /**
   * Record performance metrics for reporting
   */
  recordMetric(name: string, value: number, unit = 'ms', metadata: any = {}) {
    (global as any).__performanceMetrics = (global as any).__performanceMetrics || [];
    (global as any).__performanceMetrics.push({
      name,
      value,
      unit,
      metadata,
      timestamp: Date.now(),
      testSuite: expect.getState().currentTestName || 'unknown',
    });
  },

  /**
   * Get all recorded metrics
   */
  getRecordedMetrics() {
    return (global as any).__performanceMetrics || [];
  },

  /**
   * Generate performance summary report
   */
  generateSummaryReport() {
    const metrics = this.getRecordedMetrics();
    const baselines = (global as any).__performanceBaselines || {};

    return {
      totalTests: metrics.length,
      baselines: Object.keys(baselines).length,
      metrics: metrics.reduce((acc: any, metric: any) => {
        if (!acc[metric.name]) {
          acc[metric.name] = {
            count: 0,
            total: 0,
            min: Infinity,
            max: -Infinity,
            unit: metric.unit,
          };
        }
        
        acc[metric.name].count++;
        acc[metric.name].total += metric.value;
        acc[metric.name].min = Math.min(acc[metric.name].min, metric.value);
        acc[metric.name].max = Math.max(acc[metric.name].max, metric.value);
        acc[metric.name].average = acc[metric.name].total / acc[metric.name].count;
        
        return acc;
      }, {}),
      generatedAt: new Date().toISOString(),
    };
  },
};

// Setup global performance tracking
beforeAll(() => {
  (global as any).__performanceBaselines = {};
  (global as any).__performanceMetrics = [];
});

// Cleanup and generate report after all tests
afterAll(() => {
  if (process.env.GENERATE_PERFORMANCE_REPORT) {
    const report = performanceMatchers.generateSummaryReport();
    console.log('\n📊 Performance Test Summary Report:');
    console.log('=====================================');
    console.log(`Total performance tests: ${report.totalTests}`);
    console.log(`Performance baselines: ${report.baselines}`);
    console.log('\nMetrics Summary:');
    
    Object.entries(report.metrics).forEach(([name, data]: [string, any]) => {
      console.log(`\n${name}:`);
      console.log(`  Average: ${data.average.toFixed(3)}${data.unit}`);
      console.log(`  Min: ${data.min.toFixed(3)}${data.unit}`);
      console.log(`  Max: ${data.max.toFixed(3)}${data.unit}`);
      console.log(`  Count: ${data.count}`);
    });
    
    console.log('\n=====================================\n');
  }
});