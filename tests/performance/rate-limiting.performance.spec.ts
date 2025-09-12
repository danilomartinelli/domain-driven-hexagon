import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import * as request from 'supertest';
import { performance } from 'perf_hooks';
import { RateLimitConfig } from '@libs/security/rate-limiting.decorator';

/**
 * Performance tests for rate limiting functionality
 * Tests concurrent access patterns, throughput, and system behavior under load
 */
describe('Rate Limiting Performance Tests', () => {
  let app: INestApplication;
  let module: TestingModule;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [
        ThrottlerModule.forRoot([
          {
            name: 'default',
            ttl: 60000, // 1 minute
            limit: 100, // 100 requests per minute
          },
          {
            name: 'strict',
            ttl: 60000,
            limit: 10, // Strict limit for testing
          },
          {
            name: 'burst',
            ttl: 1000, // 1 second
            limit: 5, // Burst protection
          },
        ]),
      ],
      controllers: [],
      providers: [
        {
          provide: APP_GUARD,
          useClass: ThrottlerGuard,
        },
      ],
    }).compile();

    app = module.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Concurrent Access Performance', () => {
    it('should handle high concurrent request volume efficiently', async () => {
      const concurrency = 50;
      const requestsPerClient = 10;
      const totalRequests = concurrency * requestsPerClient;
      
      const startTime = performance.now();
      
      // Create concurrent clients
      const clientPromises = Array(concurrency).fill(0).map(async (_, clientIndex) => {
        const clientRequests = Array(requestsPerClient).fill(0).map((_, reqIndex) => 
          request(app.getHttpServer())
            .get(`/test?client=${clientIndex}&req=${reqIndex}`)
        );
        return Promise.all(clientRequests);
      });

      const results = await Promise.all(clientPromises);
      const endTime = performance.now();
      
      const flatResults = results.flat();
      const successfulRequests = flatResults.filter(res => res.status === 200);
      const rateLimitedRequests = flatResults.filter(res => res.status === 429);
      
      const totalTime = endTime - startTime;
      const throughput = successfulRequests.length / (totalTime / 1000); // requests per second
      
      console.log(`Performance Metrics:`);
      console.log(`- Total requests: ${totalRequests}`);
      console.log(`- Successful: ${successfulRequests.length}`);
      console.log(`- Rate limited: ${rateLimitedRequests.length}`);
      console.log(`- Total time: ${totalTime.toFixed(2)}ms`);
      console.log(`- Throughput: ${throughput.toFixed(2)} req/sec`);
      
      // Performance assertions
      expect(totalTime).toBeLessThan(5000); // Should complete within 5 seconds
      expect(throughput).toBeGreaterThan(50); // Should handle at least 50 req/sec
      expect(successfulRequests.length).toBeGreaterThan(0);
      expect(flatResults.length).toBe(totalRequests);
    });

    it('should maintain consistent response times under load', async () => {
      const requestCount = 100;
      const responseTimes: number[] = [];
      
      // Send requests sequentially to measure individual response times
      for (let i = 0; i < requestCount; i++) {
        const start = performance.now();
        
        const response = await request(app.getHttpServer())
          .get(`/test?iteration=${i}`);
        
        const end = performance.now();
        responseTimes.push(end - start);
        
        // Small delay to avoid overwhelming the system
        if (i % 10 === 0) {
          await new Promise(resolve => setTimeout(resolve, 10));
        }
      }
      
      const avgResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
      const maxResponseTime = Math.max(...responseTimes);
      const minResponseTime = Math.min(...responseTimes);
      const p95ResponseTime = responseTimes.sort((a, b) => a - b)[Math.floor(requestCount * 0.95)];
      
      console.log(`Response Time Metrics:`);
      console.log(`- Average: ${avgResponseTime.toFixed(2)}ms`);
      console.log(`- Min: ${minResponseTime.toFixed(2)}ms`);
      console.log(`- Max: ${maxResponseTime.toFixed(2)}ms`);
      console.log(`- P95: ${p95ResponseTime.toFixed(2)}ms`);
      
      // Response time assertions
      expect(avgResponseTime).toBeLessThan(100); // Average should be under 100ms
      expect(maxResponseTime).toBeLessThan(1000); // Max should be under 1 second
      expect(p95ResponseTime).toBeLessThan(200); // 95% should be under 200ms
    });

    it('should handle burst traffic patterns', async () => {
      const burstSize = 20;
      const burstCount = 5;
      const delayBetweenBursts = 1000; // 1 second
      
      const allResults: any[] = [];
      
      for (let burst = 0; burst < burstCount; burst++) {
        const burstStart = performance.now();
        
        // Send burst of requests
        const burstRequests = Array(burstSize).fill(0).map((_, i) =>
          request(app.getHttpServer())
            .get(`/test?burst=${burst}&req=${i}`)
        );
        
        const burstResults = await Promise.all(burstRequests);
        const burstEnd = performance.now();
        
        allResults.push(...burstResults);
        
        const burstSuccessful = burstResults.filter(res => res.status === 200).length;
        const burstRateLimited = burstResults.filter(res => res.status === 429).length;
        
        console.log(`Burst ${burst + 1}: ${burstSuccessful} successful, ${burstRateLimited} rate-limited (${(burstEnd - burstStart).toFixed(2)}ms)`);
        
        // Wait between bursts
        if (burst < burstCount - 1) {
          await new Promise(resolve => setTimeout(resolve, delayBetweenBursts));
        }
      }
      
      const totalSuccessful = allResults.filter(res => res.status === 200).length;
      const totalRateLimited = allResults.filter(res => res.status === 429).length;
      
      // Burst handling assertions
      expect(totalSuccessful).toBeGreaterThan(0);
      expect(totalRateLimited).toBeGreaterThan(0); // Some should be rate limited
      expect(allResults.length).toBe(burstSize * burstCount);
    });
  });

  describe('Memory and Resource Usage', () => {
    it('should not cause memory leaks under sustained load', async () => {
      const initialMemory = process.memoryUsage();
      const requestCount = 1000;
      const batchSize = 50;
      
      // Send requests in batches to control memory usage
      for (let batch = 0; batch < requestCount / batchSize; batch++) {
        const batchPromises = Array(batchSize).fill(0).map(() =>
          request(app.getHttpServer()).get('/test')
        );
        
        await Promise.all(batchPromises);
        
        // Force garbage collection every few batches if available
        if (batch % 5 === 0 && global.gc) {
          global.gc();
        }
      }
      
      // Force final garbage collection
      if (global.gc) {
        global.gc();
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      const finalMemory = process.memoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
      const memoryIncreaseMB = memoryIncrease / (1024 * 1024);
      
      console.log(`Memory Usage:`);
      console.log(`- Initial heap: ${(initialMemory.heapUsed / (1024 * 1024)).toFixed(2)}MB`);
      console.log(`- Final heap: ${(finalMemory.heapUsed / (1024 * 1024)).toFixed(2)}MB`);
      console.log(`- Increase: ${memoryIncreaseMB.toFixed(2)}MB`);
      
      // Memory leak assertions
      expect(memoryIncreaseMB).toBeLessThan(50); // Should not increase by more than 50MB
    });

    it('should handle rate limit storage efficiently', async () => {
      const uniqueIPs = 100;
      const requestsPerIP = 20;
      
      const startTime = performance.now();
      
      // Create requests from many different IP addresses
      const ipPromises = Array(uniqueIPs).fill(0).map(async (_, ipIndex) => {
        const ip = `192.168.1.${ipIndex + 1}`;
        
        const ipRequests = Array(requestsPerIP).fill(0).map(() =>
          request(app.getHttpServer())
            .get('/test')
            .set('X-Forwarded-For', ip)
        );
        
        return Promise.all(ipRequests);
      });
      
      const results = await Promise.all(ipPromises);
      const endTime = performance.now();
      
      const totalTime = endTime - startTime;
      const totalRequests = uniqueIPs * requestsPerIP;
      
      console.log(`Rate Limit Storage Test:`);
      console.log(`- Unique IPs: ${uniqueIPs}`);
      console.log(`- Requests per IP: ${requestsPerIP}`);
      console.log(`- Total requests: ${totalRequests}`);
      console.log(`- Total time: ${totalTime.toFixed(2)}ms`);
      
      // Storage efficiency assertions
      expect(totalTime).toBeLessThan(10000); // Should complete within 10 seconds
      expect(results.flat().length).toBe(totalRequests);
    });
  });

  describe('Rate Limit Algorithm Performance', () => {
    it('should demonstrate sliding window accuracy', async () => {
      const windowSize = 5000; // 5 seconds
      const requestLimit = 10;
      const testDuration = 15000; // 15 seconds
      
      const results: Array<{ timestamp: number; status: number }> = [];
      const startTime = performance.now();
      
      // Send requests at regular intervals
      while (performance.now() - startTime < testDuration) {
        const requestStart = performance.now();
        
        const response = await request(app.getHttpServer())
          .get('/test');
        
        results.push({
          timestamp: requestStart - startTime,
          status: response.status
        });
        
        // Wait 200ms between requests
        await new Promise(resolve => setTimeout(resolve, 200));
      }
      
      // Analyze sliding window behavior
      const windows = Math.floor(testDuration / windowSize);
      for (let window = 0; window < windows; window++) {
        const windowStart = window * windowSize;
        const windowEnd = windowStart + windowSize;
        
        const windowRequests = results.filter(r => 
          r.timestamp >= windowStart && r.timestamp < windowEnd
        );
        
        const successfulInWindow = windowRequests.filter(r => r.status === 200).length;
        const rateLimitedInWindow = windowRequests.filter(r => r.status === 429).length;
        
        console.log(`Window ${window + 1}: ${successfulInWindow} successful, ${rateLimitedInWindow} rate-limited`);
      }
      
      expect(results.length).toBeGreaterThan(0);
    });

    it('should handle different rate limiting strategies', async () => {
      const strategies = [
        { name: 'default', limit: 100, window: 60000 },
        { name: 'strict', limit: 10, window: 60000 },
        { name: 'burst', limit: 5, window: 1000 },
      ];
      
      for (const strategy of strategies) {
        const startTime = performance.now();
        
        // Test each strategy with its limit + 5 requests
        const requestCount = strategy.limit + 5;
        const requests = Array(requestCount).fill(0).map(() =>
          request(app.getHttpServer())
            .get(`/test?strategy=${strategy.name}`)
        );
        
        const responses = await Promise.all(requests);
        const endTime = performance.now();
        
        const successful = responses.filter(r => r.status === 200).length;
        const rateLimited = responses.filter(r => r.status === 429).length;
        
        console.log(`Strategy ${strategy.name}:`);
        console.log(`- Limit: ${strategy.limit}, Sent: ${requestCount}`);
        console.log(`- Successful: ${successful}, Rate-limited: ${rateLimited}`);
        console.log(`- Time: ${(endTime - startTime).toFixed(2)}ms`);
        
        expect(successful).toBeLessThanOrEqual(strategy.limit);
        expect(rateLimited).toBeGreaterThan(0);
      }
    });
  });

  describe('Scalability Tests', () => {
    it('should maintain performance with increasing load', async () => {
      const loadLevels = [10, 50, 100, 200];
      const results: Array<{ load: number; throughput: number; avgResponseTime: number }> = [];
      
      for (const load of loadLevels) {
        const startTime = performance.now();
        const responseTimes: number[] = [];
        
        // Create concurrent requests
        const promises = Array(load).fill(0).map(async () => {
          const reqStart = performance.now();
          const response = await request(app.getHttpServer()).get('/test');
          const reqEnd = performance.now();
          
          responseTimes.push(reqEnd - reqStart);
          return response;
        });
        
        const responses = await Promise.all(promises);
        const endTime = performance.now();
        
        const totalTime = endTime - startTime;
        const successful = responses.filter(r => r.status === 200).length;
        const throughput = successful / (totalTime / 1000);
        const avgResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
        
        results.push({ load, throughput, avgResponseTime });
        
        console.log(`Load Level ${load}:`);
        console.log(`- Throughput: ${throughput.toFixed(2)} req/sec`);
        console.log(`- Avg Response Time: ${avgResponseTime.toFixed(2)}ms`);
        
        // Wait between tests
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      // Analyze scalability
      for (let i = 1; i < results.length; i++) {
        const current = results[i];
        const previous = results[i - 1];
        
        // Throughput should not degrade significantly
        const throughputRatio = current.throughput / previous.throughput;
        const responseTimeRatio = current.avgResponseTime / previous.avgResponseTime;
        
        expect(throughputRatio).toBeGreaterThan(0.5); // At least 50% of previous throughput
        expect(responseTimeRatio).toBeLessThan(3); // Response time shouldn't triple
      }
    });

    it('should handle gradual load increase gracefully', async () => {
      const maxConcurrency = 100;
      const stepSize = 10;
      const stepDuration = 2000; // 2 seconds per step
      
      let currentLoad = 0;
      const loadResults: Array<{ time: number; load: number; successful: number; rateLimited: number }> = [];
      
      const testStart = performance.now();
      
      while (currentLoad <= maxConcurrency) {
        const stepStart = performance.now();
        
        // Create requests for current load level
        const promises = Array(currentLoad).fill(0).map(() =>
          request(app.getHttpServer()).get('/test')
        );
        
        const responses = await Promise.all(promises);
        
        const successful = responses.filter(r => r.status === 200).length;
        const rateLimited = responses.filter(r => r.status === 429).length;
        
        loadResults.push({
          time: stepStart - testStart,
          load: currentLoad,
          successful,
          rateLimited
        });
        
        console.log(`Load ${currentLoad}: ${successful} successful, ${rateLimited} rate-limited`);
        
        currentLoad += stepSize;
        
        // Wait for next step
        await new Promise(resolve => setTimeout(resolve, stepDuration));
      }
      
      // Analyze graceful degradation
      const totalSteps = loadResults.length;
      expect(totalSteps).toBeGreaterThan(0);
      
      // System should continue responding even under high load
      const lastResult = loadResults[loadResults.length - 1];
      expect(lastResult.successful + lastResult.rateLimited).toBe(lastResult.load);
    });
  });

  describe('Edge Case Performance', () => {
    it('should handle rapid sequential requests from single client', async () => {
      const requestCount = 100;
      const results: number[] = [];
      
      const startTime = performance.now();
      
      // Send requests as fast as possible
      for (let i = 0; i < requestCount; i++) {
        const reqStart = performance.now();
        const response = await request(app.getHttpServer()).get('/test');
        const reqEnd = performance.now();
        
        results.push(response.status);
        
        // No delay between requests - test rapid succession
      }
      
      const endTime = performance.now();
      const totalTime = endTime - startTime;
      
      const successful = results.filter(status => status === 200).length;
      const rateLimited = results.filter(status => status === 429).length;
      
      console.log(`Rapid Sequential Test:`);
      console.log(`- Total requests: ${requestCount}`);
      console.log(`- Successful: ${successful}`);
      console.log(`- Rate limited: ${rateLimited}`);
      console.log(`- Total time: ${totalTime.toFixed(2)}ms`);
      console.log(`- Rate: ${(requestCount / (totalTime / 1000)).toFixed(2)} req/sec`);
      
      expect(successful + rateLimited).toBe(requestCount);
      expect(totalTime).toBeLessThan(30000); // Should complete within 30 seconds
    });

    it('should maintain accuracy under time boundary conditions', async () => {
      // Test behavior exactly at rate limit window boundaries
      const windowSize = 1000; // 1 second window
      const limit = 5;
      
      // Send limit number of requests quickly
      const firstBatch = Array(limit).fill(0).map(() =>
        request(app.getHttpServer()).get('/test')
      );
      
      const firstResults = await Promise.all(firstBatch);
      const firstSuccessful = firstResults.filter(r => r.status === 200).length;
      
      console.log(`First batch: ${firstSuccessful} successful out of ${limit}`);
      
      // Wait for window to reset
      await new Promise(resolve => setTimeout(resolve, windowSize + 100));
      
      // Send another batch
      const secondBatch = Array(limit).fill(0).map(() =>
        request(app.getHttpServer()).get('/test')
      );
      
      const secondResults = await Promise.all(secondBatch);
      const secondSuccessful = secondResults.filter(r => r.status === 200).length;
      
      console.log(`Second batch: ${secondSuccessful} successful out of ${limit}`);
      
      // Both batches should have similar success rates
      expect(Math.abs(firstSuccessful - secondSuccessful)).toBeLessThanOrEqual(2);
    });
  });
});