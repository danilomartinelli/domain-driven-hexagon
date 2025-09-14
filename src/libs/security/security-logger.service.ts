import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { EnvValidatorService } from './env-validator.service';

/**
 * Security event types for monitoring and alerting
 */
export interface SecurityEvent {
  type: SecurityEventType;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  details: Record<string, any>;
  timestamp: Date;
  correlationId?: string;
}

export type SecurityEventType =
  | 'REQUEST_VALIDATION_FAILED'
  | 'SLOW_REQUEST'
  | 'AUTH_FAILURE'
  | 'SERVER_ERROR'
  | 'SENSITIVE_ENDPOINT_ACCESS'
  | 'UNUSUALLY_FAST_RESPONSE'
  | 'SECURITY_ERROR'
  | 'VALIDATION_ERROR'
  | 'SUSPICIOUS_ACTIVITY'
  | 'RATE_LIMIT_EXCEEDED'
  | 'XSS_ATTEMPT'
  | 'SQL_INJECTION_ATTEMPT'
  | 'SUSPICIOUS_USER_AGENT'
  | 'MALICIOUS_IP_DETECTED'
  | 'FILE_UPLOAD_VIOLATION'
  | 'CSRF_TOKEN_MISMATCH';

/**
 * Security logging and monitoring service
 * Provides centralized security event logging with threat detection
 */
@Injectable()
export class SecurityLogger {
  private readonly logger = new Logger(SecurityLogger.name);
  private readonly securityEventsBuffer: SecurityEvent[] = [];
  private readonly maxBufferSize = 1000;
  private readonly suspiciousPatterns = new Map<string, number>();
  private readonly ipReputationCache = new Map<
    string,
    { score: number; lastUpdate: Date }
  >();

  constructor(
    private readonly eventEmitter: EventEmitter2,
    private readonly envValidator: EnvValidatorService,
  ) {
    // Start periodic security analysis
    this.startSecurityAnalysis();
  }

  /**
   * Log security event with threat analysis
   */
  logSecurityEvent(event: SecurityEvent): void {
    try {
      // Enrich event with additional context
      const enrichedEvent = this.enrichSecurityEvent(event);

      // Add to buffer for pattern analysis
      this.addToBuffer(enrichedEvent);

      // Log based on severity
      this.logBySeverity(enrichedEvent);

      // Emit event for real-time monitoring
      this.eventEmitter.emit('security.event', enrichedEvent);

      // Check for immediate threats
      this.checkForImmediateThreats(enrichedEvent);
    } catch (error) {
      // Don't let security logging failures break the application
      this.logger.error('Security logging failed', error);
    }
  }

  /**
   * Log multiple security events in batch
   */
  logSecurityEvents(events: SecurityEvent[]): void {
    events.forEach((event) => this.logSecurityEvent(event));
  }

  /**
   * Enrich security event with additional context
   */
  private enrichSecurityEvent(event: SecurityEvent): SecurityEvent {
    const enriched = { ...event };

    // Add correlation ID if not present
    if (!enriched.correlationId) {
      enriched.correlationId = this.generateCorrelationId();
    }

    // Add environment context
    enriched.details = {
      ...enriched.details,
      environment: this.envValidator.get('NODE_ENV'),
      timestamp: event.timestamp.toISOString(),
    };

    // Add IP reputation if IP is present
    if (enriched.details.ip) {
      const reputation = this.getIpReputation(enriched.details.ip);
      if (reputation.score < 50) {
        enriched.details.ipReputation = 'SUSPICIOUS';
        enriched.severity = this.escalateSeverity(enriched.severity);
      }
    }

    // Add geographic context if available
    if (enriched.details.ip) {
      enriched.details.geoContext = this.getGeoContext(enriched.details.ip);
    }

    return enriched;
  }

  /**
   * Log event based on severity level
   */
  private logBySeverity(event: SecurityEvent): void {
    const logMessage = `Security Event: ${event.type}`;
    const logData = {
      type: event.type,
      severity: event.severity,
      details: event.details,
      correlationId: event.correlationId,
    };

    switch (event.severity) {
      case 'CRITICAL':
        this.logger.error(`[CRITICAL] ${logMessage}`, logData);
        break;
      case 'HIGH':
        this.logger.error(`[HIGH] ${logMessage}`, logData);
        break;
      case 'MEDIUM':
        this.logger.warn(`[MEDIUM] ${logMessage}`, logData);
        break;
      case 'LOW':
        this.logger.log(`[LOW] ${logMessage}`, logData);
        break;
    }

    // Additional logging for production monitoring
    if (
      this.envValidator.get('NODE_ENV') === 'production' &&
      (event.severity === 'HIGH' || event.severity === 'CRITICAL')
    ) {
      // In production, you might want to send to external monitoring service
      this.sendToSecurityMonitoring(event);
    }
  }

  /**
   * Add event to buffer for pattern analysis
   */
  private addToBuffer(event: SecurityEvent): void {
    this.securityEventsBuffer.push(event);

    // Maintain buffer size
    if (this.securityEventsBuffer.length > this.maxBufferSize) {
      this.securityEventsBuffer.shift();
    }
  }

  /**
   * Check for immediate security threats
   */
  private checkForImmediateThreats(event: SecurityEvent): void {
    // Check for multiple auth failures from same IP
    if (event.type === 'AUTH_FAILURE' && event.details.ip) {
      const recentFailures = this.getRecentEventsByType(
        'AUTH_FAILURE',
        5 * 60 * 1000,
      ); // 5 minutes
      const ipFailures = recentFailures.filter(
        (e) => e.details.ip === event.details.ip,
      );

      if (ipFailures.length >= 5) {
        this.logSecurityEvent({
          type: 'MALICIOUS_IP_DETECTED',
          severity: 'HIGH',
          details: {
            ip: event.details.ip,
            failureCount: ipFailures.length,
            timeWindow: '5 minutes',
            originalEvent: event,
          },
          timestamp: new Date(),
        });
      }
    }

    // Check for rapid-fire requests (potential DDoS)
    if (event.details.ip) {
      const recentEvents = this.getRecentEventsByIp(
        event.details.ip,
        60 * 1000,
      ); // 1 minute
      if (recentEvents.length > 100) {
        this.logSecurityEvent({
          type: 'RATE_LIMIT_EXCEEDED',
          severity: 'HIGH',
          details: {
            ip: event.details.ip,
            eventCount: recentEvents.length,
            timeWindow: '1 minute',
            potentialDDoS: true,
          },
          timestamp: new Date(),
        });
      }
    }

    // Check for SQL injection attempts
    if (
      event.details.url &&
      this.containsSqlInjectionPatterns(event.details.url)
    ) {
      this.logSecurityEvent({
        type: 'SQL_INJECTION_ATTEMPT',
        severity: 'CRITICAL',
        details: {
          ...event.details,
          attackType: 'SQL_INJECTION',
          originalEvent: event,
        },
        timestamp: new Date(),
      });
    }

    // Check for XSS attempts
    const xssFields = ['url', 'userAgent', 'referer'];
    for (const field of xssFields) {
      if (
        event.details[field] &&
        this.containsXssPatterns(event.details[field])
      ) {
        this.logSecurityEvent({
          type: 'XSS_ATTEMPT',
          severity: 'HIGH',
          details: {
            ...event.details,
            attackType: 'XSS',
            affectedField: field,
            originalEvent: event,
          },
          timestamp: new Date(),
        });
        break;
      }
    }
  }

  /**
   * Get recent events by type
   */
  private getRecentEventsByType(
    type: SecurityEventType,
    timeWindow: number,
  ): SecurityEvent[] {
    const cutoff = new Date(Date.now() - timeWindow);
    return this.securityEventsBuffer.filter(
      (event) => event.type === type && event.timestamp >= cutoff,
    );
  }

  /**
   * Get recent events by IP
   */
  private getRecentEventsByIp(ip: string, timeWindow: number): SecurityEvent[] {
    const cutoff = new Date(Date.now() - timeWindow);
    return this.securityEventsBuffer.filter(
      (event) => event.details.ip === ip && event.timestamp >= cutoff,
    );
  }

  /**
   * Check for SQL injection patterns
   */
  private containsSqlInjectionPatterns(input: string): boolean {
    const sqlPatterns = [
      /union\s+select/i,
      /drop\s+table/i,
      /insert\s+into/i,
      /delete\s+from/i,
      /update\s+set/i,
      /or\s+1\s*=\s*1/i,
      /'\s*or\s*'/i,
      /information_schema/i,
      /pg_tables/i,
      /version\(\)/i,
    ];

    return sqlPatterns.some((pattern) => pattern.test(input));
  }

  /**
   * Check for XSS patterns
   */
  private containsXssPatterns(input: string): boolean {
    const xssPatterns = [
      /<script/i,
      /javascript:/i,
      /on\w+\s*=/i,
      /<iframe/i,
      /eval\s*\(/i,
      /alert\s*\(/i,
      /document\.cookie/i,
      /window\.location/i,
    ];

    return xssPatterns.some((pattern) => pattern.test(input));
  }

  /**
   * Get IP reputation score (simplified implementation)
   */
  private getIpReputation(ip: string): { score: number; lastUpdate: Date } {
    const cached = this.ipReputationCache.get(ip);
    const now = new Date();

    // Cache for 1 hour
    if (cached && now.getTime() - cached.lastUpdate.getTime() < 3600000) {
      return cached;
    }

    // Simple reputation scoring based on observed behavior
    const recentEvents = this.getRecentEventsByIp(ip, 24 * 60 * 60 * 1000); // 24 hours
    const suspiciousEvents = recentEvents.filter((event) =>
      ['AUTH_FAILURE', 'SECURITY_ERROR', 'VALIDATION_ERROR'].includes(
        event.type,
      ),
    );

    let score = 100; // Start with good reputation
    score -= suspiciousEvents.length * 5; // Deduct for suspicious activity
    score = Math.max(0, Math.min(100, score)); // Clamp between 0-100

    const reputation = { score, lastUpdate: now };
    this.ipReputationCache.set(ip, reputation);

    return reputation;
  }

  /**
   * Get geographic context (simplified implementation)
   */
  private getGeoContext(ip: string): string {
    // In a real implementation, this would use a GeoIP service
    // For now, return a placeholder
    if (
      ip.startsWith('10.') ||
      ip.startsWith('192.168.') ||
      ip.startsWith('127.')
    ) {
      return 'INTERNAL';
    }
    return 'EXTERNAL';
  }

  /**
   * Escalate severity level
   */
  private escalateSeverity(
    currentSeverity: SecurityEvent['severity'],
  ): SecurityEvent['severity'] {
    const severityMap: Record<
      SecurityEvent['severity'],
      SecurityEvent['severity']
    > = {
      LOW: 'MEDIUM',
      MEDIUM: 'HIGH',
      HIGH: 'CRITICAL',
      CRITICAL: 'CRITICAL',
    };

    return severityMap[currentSeverity];
  }

  /**
   * Generate correlation ID
   */
  private generateCorrelationId(): string {
    return `sec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Send to external security monitoring service
   */
  private sendToSecurityMonitoring(event: SecurityEvent): void {
    // In production, this would send to services like:
    // - SIEM (Security Information and Event Management)
    // - Security monitoring dashboards
    // - Alert systems
    // - Threat intelligence platforms

    this.logger.debug('Sending to security monitoring service', {
      type: event.type,
      severity: event.severity,
      correlationId: event.correlationId,
    });
  }

  /**
   * Start periodic security analysis
   */
  private startSecurityAnalysis(): void {
    // Run security analysis every 5 minutes
    setInterval(
      () => {
        this.performPeriodicAnalysis();
      },
      5 * 60 * 1000,
    );
  }

  /**
   * Perform periodic security analysis
   */
  private performPeriodicAnalysis(): void {
    try {
      const now = new Date();
      const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      // Get events from last 24 hours
      const recentEvents = this.securityEventsBuffer.filter(
        (event) => event.timestamp >= last24Hours,
      );

      // Analyze patterns
      const patterns = this.analyzeSecurityPatterns(recentEvents);

      // Generate security summary
      this.generateSecuritySummary(patterns);

      // Clean old cache entries
      this.cleanupCaches();
    } catch (error) {
      this.logger.error('Periodic security analysis failed', error);
    }
  }

  /**
   * Analyze security patterns
   */
  private analyzeSecurityPatterns(events: SecurityEvent[]): any {
    const analysis = {
      totalEvents: events.length,
      eventTypes: {} as Record<string, number>,
      topIps: {} as Record<string, number>,
      severityDistribution: {} as Record<string, number>,
      anomalies: [] as string[],
    };

    events.forEach((event) => {
      // Count event types
      analysis.eventTypes[event.type] =
        (analysis.eventTypes[event.type] || 0) + 1;

      // Count IPs
      if (event.details.ip) {
        analysis.topIps[event.details.ip] =
          (analysis.topIps[event.details.ip] || 0) + 1;
      }

      // Count severity
      analysis.severityDistribution[event.severity] =
        (analysis.severityDistribution[event.severity] || 0) + 1;
    });

    // Detect anomalies
    const avgEventsPerHour = events.length / 24;
    if (avgEventsPerHour > 100) {
      analysis.anomalies.push('High event volume detected');
    }

    const criticalEvents = events.filter(
      (e) => e.severity === 'CRITICAL',
    ).length;
    if (criticalEvents > 10) {
      analysis.anomalies.push('High number of critical events');
    }

    return analysis;
  }

  /**
   * Generate security summary
   */
  private generateSecuritySummary(patterns: any): void {
    this.logger.log('Security Summary (24h)', {
      totalEvents: patterns.totalEvents,
      criticalEvents: patterns.severityDistribution['CRITICAL'] || 0,
      highEvents: patterns.severityDistribution['HIGH'] || 0,
      topEventTypes: Object.entries(patterns.eventTypes)
        .sort(([, a], [, b]) => (b as number) - (a as number))
        .slice(0, 5),
      anomalies: patterns.anomalies,
    });
  }

  /**
   * Clean up old cache entries
   */
  private cleanupCaches(): void {
    const now = new Date();
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours

    // Clean IP reputation cache
    this.ipReputationCache.forEach((data, ip) => {
      if (now.getTime() - data.lastUpdate.getTime() > maxAge) {
        this.ipReputationCache.delete(ip);
      }
    });
  }

  /**
   * Handle security events (called programmatically)
   */
  handleSecurityEvent(event: SecurityEvent): void {
    // Additional processing for security events can be done here
    // such as triggering alerts, updating threat intelligence, etc.
    if (event.severity === 'CRITICAL' || event.severity === 'HIGH') {
      // In a real implementation, this could trigger external alerts
      this.logger.warn('High/Critical security event detected', {
        type: event.type,
        severity: event.severity,
        correlationId: event.correlationId,
      });
    }
  }

  /**
   * Get security metrics for monitoring dashboards
   */
  getSecurityMetrics(): any {
    const now = new Date();
    const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const lastHour = new Date(now.getTime() - 60 * 60 * 1000);

    const events24h = this.securityEventsBuffer.filter(
      (e) => e.timestamp >= last24Hours,
    );
    const events1h = this.securityEventsBuffer.filter(
      (e) => e.timestamp >= lastHour,
    );

    return {
      events24h: events24h.length,
      events1h: events1h.length,
      critical24h: events24h.filter((e) => e.severity === 'CRITICAL').length,
      high24h: events24h.filter((e) => e.severity === 'HIGH').length,
      uniqueIps24h: new Set(events24h.map((e) => e.details.ip).filter(Boolean))
        .size,
      topThreats: Object.entries(
        events24h.reduce(
          (acc, event) => {
            acc[event.type] = (acc[event.type] || 0) + 1;
            return acc;
          },
          {} as Record<string, number>,
        ),
      )
        .sort(([, a], [, b]) => (b as number) - (a as number))
        .slice(0, 5),
    };
  }
}
