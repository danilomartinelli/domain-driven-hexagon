#!/usr/bin/env node

/**
 * Comprehensive Upgrade Testing Framework
 *
 * This script provides automated testing for dependency upgrades,
 * including performance monitoring, regression detection, and rollback validation.
 */

const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const util = require('util');

class UpgradeTestingFramework {
    constructor() {
        this.metricsDir = path.join(process.cwd(), 'upgrade-metrics');
        this.resultsFile = path.join(this.metricsDir, 'test-results.json');
        this.baselineFile = path.join(this.metricsDir, 'baseline.json');

        // Ensure metrics directory exists
        if (!fs.existsSync(this.metricsDir)) {
            fs.mkdirSync(this.metricsDir, { recursive: true });
        }
    }

    /**
     * Create baseline measurements before upgrades
     */
    async createBaseline() {
        console.log('📊 Creating performance and functionality baseline...');

        const baseline = {
            timestamp: new Date().toISOString(),
            performance: await this.measurePerformance(),
            bundleSize: await this.measureBundleSize(),
            testCoverage: await this.measureTestCoverage(),
            dependencies: await this.getDependencyVersions(),
            memoryUsage: await this.measureMemoryUsage(),
            apiHealth: await this.measureApiHealth()
        };

        fs.writeFileSync(this.baselineFile, JSON.stringify(baseline, null, 2));
        console.log('✅ Baseline created successfully');

        return baseline;
    }

    /**
     * Run comprehensive upgrade validation tests
     */
    async validateUpgrade(phase = 'unknown') {
        console.log(`🧪 Running upgrade validation for phase: ${phase}`);

        const results = {
            phase,
            timestamp: new Date().toISOString(),
            success: true,
            tests: {},
            performance: {},
            comparison: {},
            errors: []
        };

        try {
            // Core functionality tests
            results.tests.unit = await this.runUnitTests();
            results.tests.integration = await this.runIntegrationTests();
            results.tests.e2e = await this.runE2ETests();
            results.tests.database = await this.runDatabaseTests();

            // Build and lint validation
            results.tests.build = await this.validateBuild();
            results.tests.lint = await this.validateLinting();
            results.tests.dependencies = await this.validateDependencies();

            // Performance measurements
            results.performance = await this.measurePerformance();
            results.bundleSize = await this.measureBundleSize();
            results.memoryUsage = await this.measureMemoryUsage();
            results.apiHealth = await this.measureApiHealth();

            // Compare with baseline if exists
            if (fs.existsSync(this.baselineFile)) {
                const baseline = JSON.parse(fs.readFileSync(this.baselineFile, 'utf8'));
                results.comparison = await this.compareWithBaseline(results, baseline);
            }

            // Authentication-specific tests for Phase 2
            if (phase === '2' || phase === 'phase-2') {
                results.tests.authentication = await this.runAuthenticationTests();
                results.tests.jwt = await this.runJwtTests();
                results.tests.configuration = await this.runConfigurationTests();
            }

            // Security-specific tests for Phase 3
            if (phase === '3' || phase === 'phase-3') {
                results.tests.security = await this.runSecurityTests();
                results.tests.passwordHashing = await this.runPasswordHashingTests();
                results.tests.domSanitization = await this.runDomSanitizationTests();
            }

        } catch (error) {
            results.success = false;
            results.errors.push({
                type: 'validation_error',
                message: error.message,
                stack: error.stack
            });
        }

        // Save results
        fs.writeFileSync(this.resultsFile, JSON.stringify(results, null, 2));

        // Generate report
        await this.generateReport(results);

        return results;
    }

    /**
     * Measure application performance metrics
     */
    async measurePerformance() {
        console.log('⏱️  Measuring performance metrics...');

        try {
            // Start application
            const appProcess = spawn('npm', ['run', 'start:dev'], {
                stdio: 'pipe',
                detached: false
            });

            // Wait for app to start
            await this.waitForAppStart();

            const performanceMetrics = {
                startupTime: await this.measureStartupTime(),
                apiResponseTime: await this.measureApiResponseTime(),
                healthCheckTime: await this.measureHealthCheckTime(),
                graphqlResponseTime: await this.measureGraphqlResponseTime()
            };

            // Kill the app
            appProcess.kill('SIGTERM');

            return performanceMetrics;
        } catch (error) {
            console.error('❌ Performance measurement failed:', error.message);
            return { error: error.message };
        }
    }

    /**
     * Measure bundle size
     */
    async measureBundleSize() {
        console.log('📦 Measuring bundle size...');

        try {
            execSync('npm run build', { stdio: 'pipe' });

            const distPath = path.join(process.cwd(), 'dist');
            const bundleSize = this.getDirectorySize(distPath);

            return {
                totalSize: bundleSize,
                mainJs: this.getFileSize(path.join(distPath, 'main.js')),
                sizeInMB: (bundleSize / 1024 / 1024).toFixed(2)
            };
        } catch (error) {
            console.error('❌ Bundle size measurement failed:', error.message);
            return { error: error.message };
        }
    }

    /**
     * Measure test coverage
     */
    async measureTestCoverage() {
        console.log('🧪 Measuring test coverage...');

        try {
            const output = execSync('npm run test:cov', {
                encoding: 'utf8',
                stdio: 'pipe'
            });

            // Parse Jest coverage output
            const coverageMatch = output.match(/All files\s+\|\s+([\d.]+)\s+\|\s+([\d.]+)\s+\|\s+([\d.]+)\s+\|\s+([\d.]+)/);

            if (coverageMatch) {
                return {
                    statements: parseFloat(coverageMatch[1]),
                    branches: parseFloat(coverageMatch[2]),
                    functions: parseFloat(coverageMatch[3]),
                    lines: parseFloat(coverageMatch[4])
                };
            }

            return { error: 'Could not parse coverage data' };
        } catch (error) {
            console.error('❌ Test coverage measurement failed:', error.message);
            return { error: error.message };
        }
    }

    /**
     * Get current dependency versions
     */
    async getDependencyVersions() {
        const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
        return {
            dependencies: packageJson.dependencies,
            devDependencies: packageJson.devDependencies
        };
    }

    /**
     * Run unit tests
     */
    async runUnitTests() {
        console.log('🔬 Running unit tests...');

        try {
            execSync('npm test', { stdio: 'pipe' });
            return { success: true, message: 'Unit tests passed' };
        } catch (error) {
            return {
                success: false,
                message: 'Unit tests failed',
                details: error.message
            };
        }
    }

    /**
     * Run integration tests
     */
    async runIntegrationTests() {
        console.log('🔗 Running integration tests...');

        try {
            execSync('npm run test:database', { stdio: 'pipe' });
            return { success: true, message: 'Integration tests passed' };
        } catch (error) {
            return {
                success: false,
                message: 'Integration tests failed',
                details: error.message
            };
        }
    }

    /**
     * Run E2E tests
     */
    async runE2ETests() {
        console.log('🎭 Running E2E tests...');

        try {
            execSync('npm run test:e2e', { stdio: 'pipe' });
            return { success: true, message: 'E2E tests passed' };
        } catch (error) {
            return {
                success: false,
                message: 'E2E tests failed',
                details: error.message
            };
        }
    }

    /**
     * Run database tests
     */
    async runDatabaseTests() {
        console.log('🗄️  Running database tests...');

        try {
            // Test database connectivity
            execSync('npm run migration:status', { stdio: 'pipe' });

            // Run database-specific tests
            execSync('npm run test:database', { stdio: 'pipe' });

            return { success: true, message: 'Database tests passed' };
        } catch (error) {
            return {
                success: false,
                message: 'Database tests failed',
                details: error.message
            };
        }
    }

    /**
     * Validate build process
     */
    async validateBuild() {
        console.log('🏗️  Validating build process...');

        try {
            execSync('npm run build', { stdio: 'pipe' });
            return { success: true, message: 'Build successful' };
        } catch (error) {
            return {
                success: false,
                message: 'Build failed',
                details: error.message
            };
        }
    }

    /**
     * Validate linting
     */
    async validateLinting() {
        console.log('🔍 Validating code linting...');

        try {
            execSync('npm run lint', { stdio: 'pipe' });
            return { success: true, message: 'Linting passed' };
        } catch (error) {
            return {
                success: false,
                message: 'Linting failed',
                details: error.message
            };
        }
    }

    /**
     * Validate dependency architecture
     */
    async validateDependencies() {
        console.log('🏛️  Validating dependency architecture...');

        try {
            execSync('npm run deps:validate', { stdio: 'pipe' });
            return { success: true, message: 'Dependency validation passed' };
        } catch (error) {
            return {
                success: false,
                message: 'Dependency validation failed',
                details: error.message
            };
        }
    }

    /**
     * Run authentication-specific tests
     */
    async runAuthenticationTests() {
        console.log('🔐 Running authentication tests...');

        try {
            // Run auth-specific test patterns
            execSync('npm test -- --testNamePattern="auth|Auth|authentication"', { stdio: 'pipe' });
            return { success: true, message: 'Authentication tests passed' };
        } catch (error) {
            return {
                success: false,
                message: 'Authentication tests failed',
                details: error.message
            };
        }
    }

    /**
     * Run JWT-specific tests
     */
    async runJwtTests() {
        console.log('🎫 Running JWT tests...');

        try {
            execSync('npm test -- --testNamePattern="jwt|JWT|token"', { stdio: 'pipe' });
            return { success: true, message: 'JWT tests passed' };
        } catch (error) {
            return {
                success: false,
                message: 'JWT tests failed',
                details: error.message
            };
        }
    }

    /**
     * Run configuration tests
     */
    async runConfigurationTests() {
        console.log('⚙️  Running configuration tests...');

        try {
            execSync('npm test -- --testNamePattern="config|Config|configuration"', { stdio: 'pipe' });
            return { success: true, message: 'Configuration tests passed' };
        } catch (error) {
            return {
                success: false,
                message: 'Configuration tests failed',
                details: error.message
            };
        }
    }

    /**
     * Run security tests
     */
    async runSecurityTests() {
        console.log('🛡️  Running security tests...');

        try {
            // Check for vulnerabilities
            execSync('npm audit --audit-level=high', { stdio: 'pipe' });

            // Run security-related tests
            execSync('npm test -- --testNamePattern="security|Security|sanitiz"', { stdio: 'pipe' });

            return { success: true, message: 'Security tests passed' };
        } catch (error) {
            return {
                success: false,
                message: 'Security tests failed',
                details: error.message
            };
        }
    }

    /**
     * Run password hashing tests
     */
    async runPasswordHashingTests() {
        console.log('🔒 Running password hashing tests...');

        try {
            execSync('npm test -- --testNamePattern="password|Password|hash|bcrypt"', { stdio: 'pipe' });
            return { success: true, message: 'Password hashing tests passed' };
        } catch (error) {
            return {
                success: false,
                message: 'Password hashing tests failed',
                details: error.message
            };
        }
    }

    /**
     * Run DOM sanitization tests
     */
    async runDomSanitizationTests() {
        console.log('🧹 Running DOM sanitization tests...');

        try {
            execSync('npm test -- --testNamePattern="dom|DOM|sanitiz|purify"', { stdio: 'pipe' });
            return { success: true, message: 'DOM sanitization tests passed' };
        } catch (error) {
            return {
                success: false,
                message: 'DOM sanitization tests failed',
                details: error.message
            };
        }
    }

    /**
     * Compare current metrics with baseline
     */
    async compareWithBaseline(current, baseline) {
        console.log('📊 Comparing with baseline...');

        const comparison = {
            performance: this.comparePerformance(current.performance, baseline.performance),
            bundleSize: this.compareBundleSize(current.bundleSize, baseline.bundleSize),
            coverage: this.compareCoverage(current.testCoverage, baseline.testCoverage),
            memoryUsage: this.compareMemoryUsage(current.memoryUsage, baseline.memoryUsage)
        };

        return comparison;
    }

    /**
     * Compare performance metrics
     */
    comparePerformance(current, baseline) {
        if (!current || !baseline || current.error || baseline.error) {
            return { status: 'error', message: 'Performance data unavailable' };
        }

        const thresholds = {
            startupTime: 1.1,    // 10% threshold
            apiResponseTime: 1.2, // 20% threshold
            healthCheckTime: 1.1,
            graphqlResponseTime: 1.2
        };

        const results = {};

        for (const [metric, threshold] of Object.entries(thresholds)) {
            const currentValue = current[metric];
            const baselineValue = baseline[metric];

            if (currentValue && baselineValue) {
                const ratio = currentValue / baselineValue;
                results[metric] = {
                    current: currentValue,
                    baseline: baselineValue,
                    ratio: ratio.toFixed(2),
                    status: ratio <= threshold ? 'pass' : 'degraded',
                    change: ((ratio - 1) * 100).toFixed(1) + '%'
                };
            }
        }

        return results;
    }

    /**
     * Compare bundle size
     */
    compareBundleSize(current, baseline) {
        if (!current || !baseline || current.error || baseline.error) {
            return { status: 'error', message: 'Bundle size data unavailable' };
        }

        const ratio = current.totalSize / baseline.totalSize;
        const threshold = 1.05; // 5% increase threshold

        return {
            current: current.sizeInMB + ' MB',
            baseline: baseline.sizeInMB + ' MB',
            ratio: ratio.toFixed(2),
            status: ratio <= threshold ? 'pass' : 'increased',
            change: ((ratio - 1) * 100).toFixed(1) + '%'
        };
    }

    /**
     * Compare test coverage
     */
    compareCoverage(current, baseline) {
        if (!current || !baseline || current.error || baseline.error) {
            return { status: 'error', message: 'Coverage data unavailable' };
        }

        const metrics = ['statements', 'branches', 'functions', 'lines'];
        const results = {};

        for (const metric of metrics) {
            const currentValue = current[metric];
            const baselineValue = baseline[metric];

            if (currentValue !== undefined && baselineValue !== undefined) {
                const diff = currentValue - baselineValue;
                results[metric] = {
                    current: currentValue + '%',
                    baseline: baselineValue + '%',
                    difference: diff.toFixed(1) + '%',
                    status: diff >= -1 ? 'pass' : 'decreased' // Allow 1% decrease
                };
            }
        }

        return results;
    }

    /**
     * Generate comprehensive test report
     */
    async generateReport(results) {
        console.log('📋 Generating test report...');

        const reportPath = path.join(this.metricsDir, `upgrade-report-${results.phase}-${Date.now()}.md`);

        let report = `# Upgrade Validation Report - Phase ${results.phase}\n\n`;
        report += `**Generated**: ${results.timestamp}\n`;
        report += `**Overall Status**: ${results.success ? '✅ PASSED' : '❌ FAILED'}\n\n`;

        // Test Results Summary
        report += `## Test Results Summary\n\n`;
        report += `| Test Category | Status | Details |\n`;
        report += `|---------------|--------|----------|\n`;

        for (const [category, result] of Object.entries(results.tests)) {
            const status = result.success ? '✅ PASS' : '❌ FAIL';
            const details = result.message || 'No details';
            report += `| ${category} | ${status} | ${details} |\n`;
        }

        // Performance Comparison
        if (results.comparison && results.comparison.performance) {
            report += `\n## Performance Comparison\n\n`;
            report += `| Metric | Current | Baseline | Change | Status |\n`;
            report += `|--------|---------|----------|--------|--------|\n`;

            for (const [metric, data] of Object.entries(results.comparison.performance)) {
                if (data.current) {
                    const status = data.status === 'pass' ? '✅' : '⚠️';
                    report += `| ${metric} | ${data.current}ms | ${data.baseline}ms | ${data.change} | ${status} |\n`;
                }
            }
        }

        // Bundle Size Comparison
        if (results.comparison && results.comparison.bundleSize) {
            report += `\n## Bundle Size Comparison\n\n`;
            const bundleData = results.comparison.bundleSize;
            const status = bundleData.status === 'pass' ? '✅' : '⚠️';
            report += `- **Current**: ${bundleData.current}\n`;
            report += `- **Baseline**: ${bundleData.baseline}\n`;
            report += `- **Change**: ${bundleData.change}\n`;
            report += `- **Status**: ${status}\n`;
        }

        // Errors
        if (results.errors && results.errors.length > 0) {
            report += `\n## Errors\n\n`;
            for (const error of results.errors) {
                report += `### ${error.type}\n`;
                report += `${error.message}\n\n`;
                if (error.stack) {
                    report += `\`\`\`\n${error.stack}\n\`\`\`\n\n`;
                }
            }
        }

        // Recommendations
        report += `\n## Recommendations\n\n`;
        if (results.success) {
            report += `✅ **All tests passed!** The upgrade appears to be successful.\n\n`;
            report += `Next steps:\n`;
            report += `- Monitor application in development environment\n`;
            report += `- Deploy to staging for further validation\n`;
            report += `- Consider proceeding to next upgrade phase\n`;
        } else {
            report += `❌ **Some tests failed.** Review the failures above before proceeding.\n\n`;
            report += `Recommended actions:\n`;
            report += `- Fix failing tests\n`;
            report += `- Review breaking changes in migration guides\n`;
            report += `- Consider rolling back if issues are severe\n`;
        }

        fs.writeFileSync(reportPath, report);

        console.log(`📋 Report generated: ${reportPath}`);
        console.log('\n' + report);

        return reportPath;
    }

    // Helper methods
    async waitForAppStart(timeout = 15000) {
        const start = Date.now();
        while (Date.now() - start < timeout) {
            try {
                const response = await this.makeRequest('http://localhost:3000/health');
                if (response) return true;
            } catch (e) {
                // App not ready yet
            }
            await this.sleep(1000);
        }
        throw new Error('Application failed to start within timeout');
    }

    async measureStartupTime() {
        const start = Date.now();
        await this.waitForAppStart();
        return Date.now() - start;
    }

    async measureApiResponseTime() {
        const start = Date.now();
        await this.makeRequest('http://localhost:3000/api');
        return Date.now() - start;
    }

    async measureHealthCheckTime() {
        const start = Date.now();
        await this.makeRequest('http://localhost:3000/health');
        return Date.now() - start;
    }

    async measureGraphqlResponseTime() {
        const start = Date.now();
        await this.makeRequest('http://localhost:3000/graphql', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: '{ __schema { types { name } } }' })
        });
        return Date.now() - start;
    }

    async measureMemoryUsage() {
        const used = process.memoryUsage();
        return {
            rss: Math.round(used.rss / 1024 / 1024 * 100) / 100,
            heapTotal: Math.round(used.heapTotal / 1024 / 1024 * 100) / 100,
            heapUsed: Math.round(used.heapUsed / 1024 / 1024 * 100) / 100,
            external: Math.round(used.external / 1024 / 1024 * 100) / 100
        };
    }

    async measureApiHealth() {
        try {
            const healthResponse = await this.makeRequest('http://localhost:3000/health');
            return { status: 'healthy', response: healthResponse };
        } catch (error) {
            return { status: 'unhealthy', error: error.message };
        }
    }

    getDirectorySize(dirPath) {
        let totalSize = 0;

        function calculateSize(itemPath) {
            const stats = fs.statSync(itemPath);
            if (stats.isFile()) {
                totalSize += stats.size;
            } else if (stats.isDirectory()) {
                const items = fs.readdirSync(itemPath);
                items.forEach(item => {
                    calculateSize(path.join(itemPath, item));
                });
            }
        }

        if (fs.existsSync(dirPath)) {
            calculateSize(dirPath);
        }

        return totalSize;
    }

    getFileSize(filePath) {
        try {
            const stats = fs.statSync(filePath);
            return stats.size;
        } catch (error) {
            return 0;
        }
    }

    async makeRequest(url, options = {}) {
        // Simple HTTP request using fetch or node-fetch equivalent
        // This is a simplified implementation
        return new Promise((resolve, reject) => {
            const http = require('http');
            const urlObj = new URL(url);

            const req = http.request({
                hostname: urlObj.hostname,
                port: urlObj.port,
                path: urlObj.pathname,
                method: options.method || 'GET',
                headers: options.headers || {}
            }, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => resolve(data));
            });

            req.on('error', reject);

            if (options.body) {
                req.write(options.body);
            }

            req.end();
        });
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    compareMemoryUsage(current, baseline) {
        if (!current || !baseline) {
            return { status: 'error', message: 'Memory usage data unavailable' };
        }

        const threshold = 1.15; // 15% increase threshold
        const metrics = ['rss', 'heapTotal', 'heapUsed', 'external'];
        const results = {};

        for (const metric of metrics) {
            const currentValue = current[metric];
            const baselineValue = baseline[metric];

            if (currentValue && baselineValue) {
                const ratio = currentValue / baselineValue;
                results[metric] = {
                    current: currentValue + ' MB',
                    baseline: baselineValue + ' MB',
                    ratio: ratio.toFixed(2),
                    status: ratio <= threshold ? 'pass' : 'increased',
                    change: ((ratio - 1) * 100).toFixed(1) + '%'
                };
            }
        }

        return results;
    }
}

// CLI Interface
async function main() {
    const args = process.argv.slice(2);
    const command = args[0];
    const phase = args[1] || 'unknown';

    const tester = new UpgradeTestingFramework();

    try {
        switch (command) {
            case 'baseline':
                await tester.createBaseline();
                break;

            case 'validate':
                const results = await tester.validateUpgrade(phase);
                process.exit(results.success ? 0 : 1);
                break;

            case 'performance':
                const perfMetrics = await tester.measurePerformance();
                console.log('Performance Metrics:', JSON.stringify(perfMetrics, null, 2));
                break;

            default:
                console.log(`
Usage: node scripts/upgrade-testing.js <command> [phase]

Commands:
  baseline              Create performance baseline before upgrades
  validate <phase>      Run comprehensive validation for upgrade phase
  performance          Measure current performance metrics

Examples:
  node scripts/upgrade-testing.js baseline
  node scripts/upgrade-testing.js validate 1
  node scripts/upgrade-testing.js validate phase-2
  node scripts/upgrade-testing.js performance
                `);
                break;
        }
    } catch (error) {
        console.error('❌ Testing failed:', error.message);
        process.exit(1);
    }
}

// Run if called directly
if (require.main === module) {
    main();
}

module.exports = { UpgradeTestingFramework };