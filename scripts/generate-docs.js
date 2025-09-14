#!/usr/bin/env node

/**
 * Documentation Generation Script
 *
 * This script generates comprehensive documentation for the Domain-Driven Hexagon project.
 * It analyzes the codebase and generates API documentation, architecture diagrams, and more.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('📚 Starting documentation generation...\n');

/**
 * Configuration for documentation generation
 */
const config = {
  sourceDir: './src',
  docsDir: './docs',
  outputDir: './docs/generated',
  apiDir: './docs/api',
  architectureDir: './docs/architecture',
};

/**
 * Utility functions
 */
const utils = {
  ensureDir: (dir) => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  },

  log: (message, emoji = '📝') => {
    console.log(`${emoji} ${message}`);
  },

  error: (message) => {
    console.error(`❌ ${message}`);
    process.exit(1);
  },

  success: (message) => {
    console.log(`✅ ${message}`);
  },

  exec: (command, options = {}) => {
    try {
      return execSync(command, { encoding: 'utf8', ...options });
    } catch (error) {
      utils.error(`Failed to execute: ${command}\n${error.message}`);
    }
  }
};

/**
 * Code analysis functions
 */
const analyzer = {
  /**
   * Find all TypeScript files in the source directory
   */
  findTypeScriptFiles: (dir) => {
    const files = [];

    function traverse(currentDir) {
      const entries = fs.readdirSync(currentDir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(currentDir, entry.name);

        if (entry.isDirectory() && !entry.name.includes('node_modules')) {
          traverse(fullPath);
        } else if (entry.isFile() && entry.name.endsWith('.ts') && !entry.name.endsWith('.spec.ts')) {
          files.push(fullPath);
        }
      }
    }

    traverse(dir);
    return files;
  },

  /**
   * Extract API endpoints from controllers
   */
  extractEndpoints: () => {
    utils.log('Analyzing API endpoints...');

    const files = analyzer.findTypeScriptFiles(config.sourceDir);
    const endpoints = [];

    for (const file of files) {
      if (!file.includes('controller')) continue;

      const content = fs.readFileSync(file, 'utf8');

      // Extract HTTP methods and routes
      const methodMatches = content.match(/@(Get|Post|Put|Delete|Patch)\(.*?\)/g);
      const controllerMatch = content.match(/@Controller\(['"]([^'"]*)['"]\)/);

      if (methodMatches && controllerMatch) {
        const basePath = controllerMatch[1];

        methodMatches.forEach(match => {
          const methodMatch = match.match(/@(Get|Post|Put|Delete|Patch)\((['"`])?(.*?)\2?\)/);
          if (methodMatch) {
            const method = methodMatch[1].toUpperCase();
            const route = methodMatch[3] || '';
            const fullPath = `/${basePath}${route.startsWith('/') ? route : '/' + route}`.replace('//', '/');

            endpoints.push({
              method,
              path: fullPath,
              file: file.replace(config.sourceDir + '/', ''),
              controller: path.basename(file, '.ts')
            });
          }
        });
      }
    }

    return endpoints;
  },

  /**
   * Extract domain entities and value objects
   */
  extractDomainModel: () => {
    utils.log('Analyzing domain model...');

    const files = analyzer.findTypeScriptFiles(config.sourceDir);
    const domainModel = {
      entities: [],
      valueObjects: [],
      events: [],
      services: []
    };

    for (const file of files) {
      const content = fs.readFileSync(file, 'utf8');
      const fileName = path.basename(file, '.ts');

      // Extract entities
      if (file.includes('/domain/') && file.includes('.entity.ts')) {
        const classMatch = content.match(/export class (\w+Entity)/);
        if (classMatch) {
          domainModel.entities.push({
            name: classMatch[1],
            file: file.replace(config.sourceDir + '/', ''),
            module: file.split('/modules/')[1]?.split('/')[0] || 'unknown'
          });
        }
      }

      // Extract value objects
      if (file.includes('/value-objects/') && file.includes('.value-object.ts')) {
        const classMatch = content.match(/export class (\w+)/);
        if (classMatch) {
          domainModel.valueObjects.push({
            name: classMatch[1],
            file: file.replace(config.sourceDir + '/', ''),
            module: file.split('/modules/')[1]?.split('/')[0] || 'unknown'
          });
        }
      }

      // Extract domain events
      if (file.includes('/events/') && file.includes('.domain-event.ts')) {
        const classMatch = content.match(/export class (\w+Event)/);
        if (classMatch) {
          domainModel.events.push({
            name: classMatch[1],
            file: file.replace(config.sourceDir + '/', ''),
            module: file.split('/modules/')[1]?.split('/')[0] || 'unknown'
          });
        }
      }

      // Extract domain services
      if (file.includes('/domain/') && file.includes('.service.ts')) {
        const classMatch = content.match(/export class (\w+Service)/);
        if (classMatch) {
          domainModel.services.push({
            name: classMatch[1],
            file: file.replace(config.sourceDir + '/', ''),
            module: file.split('/modules/')[1]?.split('/')[0] || 'unknown'
          });
        }
      }
    }

    return domainModel;
  },

  /**
   * Calculate documentation coverage
   */
  calculateDocCoverage: () => {
    utils.log('Calculating documentation coverage...');

    const files = analyzer.findTypeScriptFiles(config.sourceDir);
    const coverage = {
      total: 0,
      documented: 0,
      files: []
    };

    for (const file of files) {
      const content = fs.readFileSync(file, 'utf8');
      const fileName = path.basename(file, '.ts');

      const classMatches = content.match(/export class \w+/g) || [];
      const interfaceMatches = content.match(/export interface \w+/g) || [];
      const functionMatches = content.match(/export (function|const) \w+/g) || [];

      const totalExports = classMatches.length + interfaceMatches.length + functionMatches.length;
      const docComments = (content.match(/\/\*\*/g) || []).length;

      if (totalExports > 0) {
        coverage.total += totalExports;
        coverage.documented += Math.min(docComments, totalExports);

        coverage.files.push({
          file: file.replace(config.sourceDir + '/', ''),
          total: totalExports,
          documented: Math.min(docComments, totalExports),
          percentage: Math.round((Math.min(docComments, totalExports) / totalExports) * 100)
        });
      }
    }

    coverage.percentage = coverage.total > 0 ? Math.round((coverage.documented / coverage.total) * 100) : 0;

    return coverage;
  }
};

/**
 * Documentation generators
 */
const generators = {
  /**
   * Generate API documentation summary
   */
  generateApiSummary: (endpoints) => {
    utils.log('Generating API summary...');

    const summary = {
      totalEndpoints: endpoints.length,
      byMethod: {},
      byModule: {}
    };

    endpoints.forEach(endpoint => {
      // Count by HTTP method
      summary.byMethod[endpoint.method] = (summary.byMethod[endpoint.method] || 0) + 1;

      // Count by module
      const module = endpoint.file.split('/')[1] || 'unknown';
      summary.byModule[module] = (summary.byModule[module] || 0) + 1;
    });

    // Generate markdown
    let markdown = '# API Endpoints Summary\n\n';
    markdown += `Total Endpoints: **${summary.totalEndpoints}**\n\n`;

    markdown += '## By HTTP Method\n\n';
    Object.entries(summary.byMethod).forEach(([method, count]) => {
      markdown += `- **${method}**: ${count} endpoints\n`;
    });

    markdown += '\n## By Module\n\n';
    Object.entries(summary.byModule).forEach(([module, count]) => {
      markdown += `- **${module}**: ${count} endpoints\n`;
    });

    markdown += '\n## All Endpoints\n\n';
    markdown += '| Method | Path | Controller |\n';
    markdown += '|--------|------|------------|\n';

    endpoints.forEach(endpoint => {
      markdown += `| ${endpoint.method} | ${endpoint.path} | ${endpoint.controller} |\n`;
    });

    return markdown;
  },

  /**
   * Generate domain model documentation
   */
  generateDomainModelDoc: (domainModel) => {
    utils.log('Generating domain model documentation...');

    let markdown = '# Domain Model Overview\n\n';

    markdown += `This document provides an overview of the domain model components.\n\n`;

    // Entities
    markdown += `## Entities (${domainModel.entities.length})\n\n`;
    if (domainModel.entities.length > 0) {
      markdown += '| Entity | Module | File |\n';
      markdown += '|--------|--------|------|\n';
      domainModel.entities.forEach(entity => {
        markdown += `| ${entity.name} | ${entity.module} | ${entity.file} |\n`;
      });
    } else {
      markdown += 'No entities found.\n';
    }

    // Value Objects
    markdown += `\n## Value Objects (${domainModel.valueObjects.length})\n\n`;
    if (domainModel.valueObjects.length > 0) {
      markdown += '| Value Object | Module | File |\n';
      markdown += '|--------------|--------|------|\n';
      domainModel.valueObjects.forEach(vo => {
        markdown += `| ${vo.name} | ${vo.module} | ${vo.file} |\n`;
      });
    } else {
      markdown += 'No value objects found.\n';
    }

    // Domain Events
    markdown += `\n## Domain Events (${domainModel.events.length})\n\n`;
    if (domainModel.events.length > 0) {
      markdown += '| Event | Module | File |\n';
      markdown += '|-------|--------|------|\n';
      domainModel.events.forEach(event => {
        markdown += `| ${event.name} | ${event.module} | ${event.file} |\n`;
      });
    } else {
      markdown += 'No domain events found.\n';
    }

    // Domain Services
    markdown += `\n## Domain Services (${domainModel.services.length})\n\n`;
    if (domainModel.services.length > 0) {
      markdown += '| Service | Module | File |\n';
      markdown += '|---------|--------|------|\n';
      domainModel.services.forEach(service => {
        markdown += `| ${service.name} | ${service.module} | ${service.file} |\n`;
      });
    } else {
      markdown += 'No domain services found.\n';
    }

    return markdown;
  },

  /**
   * Generate documentation coverage report
   */
  generateCoverageReport: (coverage) => {
    utils.log('Generating coverage report...');

    let markdown = '# Documentation Coverage Report\n\n';

    markdown += `**Overall Coverage: ${coverage.percentage}%** (${coverage.documented}/${coverage.total})\n\n`;

    if (coverage.percentage >= 80) {
      markdown += '🟢 **Excellent**: Documentation coverage is very good!\n\n';
    } else if (coverage.percentage >= 60) {
      markdown += '🟡 **Good**: Documentation coverage is decent, but could be improved.\n\n';
    } else {
      markdown += '🔴 **Needs Improvement**: Documentation coverage is low and should be improved.\n\n';
    }

    markdown += '## Coverage by File\n\n';
    markdown += '| File | Coverage | Documented | Total |\n';
    markdown += '|------|----------|------------|-------|\n';

    coverage.files
      .sort((a, b) => a.percentage - b.percentage)
      .forEach(file => {
        const icon = file.percentage >= 80 ? '🟢' : file.percentage >= 60 ? '🟡' : '🔴';
        markdown += `| ${icon} ${file.file} | ${file.percentage}% | ${file.documented} | ${file.total} |\n`;
      });

    return markdown;
  },

  /**
   * Generate module overview
   */
  generateModuleOverview: () => {
    utils.log('Generating module overview...');

    const modulesDir = path.join(config.sourceDir, 'modules');
    if (!fs.existsSync(modulesDir)) {
      return '# No modules found\n\nThe modules directory does not exist.';
    }

    const modules = fs.readdirSync(modulesDir, { withFileTypes: true })
      .filter(entry => entry.isDirectory())
      .map(entry => entry.name);

    let markdown = '# Modules Overview\n\n';
    markdown += `This project contains ${modules.length} business modules:\n\n`;

    modules.forEach(moduleName => {
      const modulePath = path.join(modulesDir, moduleName);

      markdown += `## ${moduleName.charAt(0).toUpperCase() + moduleName.slice(1)} Module\n\n`;

      // Check for standard directories
      const standardDirs = ['commands', 'queries', 'domain', 'database', 'dtos', 'application'];
      const existingDirs = [];

      standardDirs.forEach(dir => {
        if (fs.existsSync(path.join(modulePath, dir))) {
          existingDirs.push(dir);
        }
      });

      if (existingDirs.length > 0) {
        markdown += `**Structure**: ${existingDirs.join(', ')}\n\n`;
      }

      // Count files
      const files = analyzer.findTypeScriptFiles(modulePath);
      markdown += `**Files**: ${files.length} TypeScript files\n\n`;

      // Check for module file
      const moduleFile = path.join(modulePath, `${moduleName}.module.ts`);
      if (fs.existsSync(moduleFile)) {
        markdown += `**Module Definition**: ✅ \`${moduleName}.module.ts\`\n\n`;
      } else {
        markdown += `**Module Definition**: ❌ Missing \`${moduleName}.module.ts\`\n\n`;
      }
    });

    return markdown;
  }
};

/**
 * Main documentation generation function
 */
async function generateDocumentation() {
  try {
    // Ensure output directories exist
    utils.ensureDir(config.outputDir);

    // 1. Extract data from codebase
    utils.log('Step 1: Analyzing codebase...', '🔍');
    const endpoints = analyzer.extractEndpoints();
    const domainModel = analyzer.extractDomainModel();
    const coverage = analyzer.calculateDocCoverage();

    utils.success(`Found ${endpoints.length} API endpoints`);
    utils.success(`Found ${domainModel.entities.length} entities, ${domainModel.valueObjects.length} value objects`);
    utils.success(`Documentation coverage: ${coverage.percentage}%`);

    // 2. Generate documentation files
    utils.log('Step 2: Generating documentation files...', '📄');

    // API Summary
    const apiSummary = generators.generateApiSummary(endpoints);
    fs.writeFileSync(path.join(config.outputDir, 'api-summary.md'), apiSummary);

    // Domain Model Overview
    const domainModelDoc = generators.generateDomainModelDoc(domainModel);
    fs.writeFileSync(path.join(config.outputDir, 'domain-model-overview.md'), domainModelDoc);

    // Coverage Report
    const coverageReport = generators.generateCoverageReport(coverage);
    fs.writeFileSync(path.join(config.outputDir, 'documentation-coverage.md'), coverageReport);

    // Module Overview
    const moduleOverview = generators.generateModuleOverview();
    fs.writeFileSync(path.join(config.outputDir, 'modules-overview.md'), moduleOverview);

    // 3. Generate analysis summary
    const summaryData = {
      generated: new Date().toISOString(),
      statistics: {
        endpoints: endpoints.length,
        entities: domainModel.entities.length,
        valueObjects: domainModel.valueObjects.length,
        events: domainModel.events.length,
        services: domainModel.services.length,
        coveragePercentage: coverage.percentage,
        totalFiles: analyzer.findTypeScriptFiles(config.sourceDir).length
      },
      endpoints,
      domainModel,
      coverage
    };

    fs.writeFileSync(
      path.join(config.outputDir, 'analysis-summary.json'),
      JSON.stringify(summaryData, null, 2)
    );

    utils.success('Documentation generation completed!');

    // 4. Print summary
    console.log('\n📊 Generation Summary:');
    console.log(`   • API Endpoints: ${endpoints.length}`);
    console.log(`   • Domain Entities: ${domainModel.entities.length}`);
    console.log(`   • Value Objects: ${domainModel.valueObjects.length}`);
    console.log(`   • Domain Events: ${domainModel.events.length}`);
    console.log(`   • Coverage: ${coverage.percentage}%`);
    console.log(`   • Files Generated: 5`);
    console.log(`\n📁 Output Directory: ${config.outputDir}`);

  } catch (error) {
    utils.error(`Documentation generation failed: ${error.message}`);
  }
}

// CLI handling
if (require.main === module) {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
📚 Documentation Generation Script

Usage:
  node scripts/generate-docs.js [options]

Options:
  --help, -h     Show this help message
  --verbose, -v  Enable verbose output

Generated Files:
  • api-summary.md           - Overview of all API endpoints
  • domain-model-overview.md - Domain model components
  • documentation-coverage.md - Documentation coverage report
  • modules-overview.md       - Business modules overview
  • analysis-summary.json     - Raw analysis data

Examples:
  node scripts/generate-docs.js
  node scripts/generate-docs.js --verbose
`);
    process.exit(0);
  }

  if (args.includes('--verbose') || args.includes('-v')) {
    // Enable more detailed logging
    const originalLog = utils.log;
    utils.log = (message, emoji = '📝') => {
      console.log(`${emoji} [${new Date().toISOString()}] ${message}`);
    };
  }

  generateDocumentation();
}

module.exports = {
  analyzer,
  generators,
  generateDocumentation
};