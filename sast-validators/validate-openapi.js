#!/usr/bin/env node

/**
 * Standalone OpenAPI SAST Validator
 * Validates CO2 tracking and API call tracking extensions
 *
 * Usage:
 *   node validate-openapi.js <spec-file.yaml>
 *   node validate-openapi.js --all
 *   node validate-openapi.js --help
 */

const fs = require('fs');
const path = require('path');

// Configuration
const CONFIG = {
  CO2_THRESHOLD: 50,              // Maximum grams CO2 per request
  CO2_WARNING_THRESHOLD: 30,      // Warning threshold
  MINIMUM_TRACKING_COVERAGE: 80,  // Minimum % of endpoints with tracking
  REQUIRE_CONSOLIDATED_TRACKING: true,  // All consolidated endpoints must have tracking
  FAIL_ON_WARNINGS: false         // Fail validation on warnings
};

// Colors for terminal output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

class OpenAPIValidator {
  constructor(config) {
    this.config = config;
    this.results = {
      files: [],
      summary: {
        totalFiles: 0,
        totalEndpoints: 0,
        trackedEndpoints: 0,
        consolidatedEndpoints: 0,
        co2TrackedEndpoints: 0,
        errors: 0,
        warnings: 0
      }
    };
  }

  log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
  }

  validateFile(filePath) {
    this.log(`\n📄 Validating: ${filePath}`, 'cyan');

    let content;
    try {
      const fileContent = fs.readFileSync(filePath, 'utf8');

      // Simple YAML parser (for basic OpenAPI specs)
      if (filePath.endsWith('.yaml') || filePath.endsWith('.yml')) {
        content = this.parseYAML(fileContent);
      } else if (filePath.endsWith('.json')) {
        content = JSON.parse(fileContent);
      } else {
        this.log(`⚠️  Skipping unsupported file format`, 'yellow');
        return null;
      }
    } catch (err) {
      this.log(`❌ Error reading file: ${err.message}`, 'red');
      this.results.summary.errors++;
      return null;
    }

    if (!content.paths) {
      this.log(`⚠️  No paths found in spec`, 'yellow');
      return null;
    }

    const fileResults = {
      path: filePath,
      endpoints: [],
      errors: [],
      warnings: []
    };

    Object.entries(content.paths).forEach(([path, methods]) => {
      Object.entries(methods).forEach(([method, operation]) => {
        if (typeof operation !== 'object') return;

        const endpoint = {
          path,
          method: method.toUpperCase(),
          checks: {}
        };

        this.results.summary.totalEndpoints++;

        // Check for consolidation
        const isConsolidated = !!operation['x-consolidation'];
        if (isConsolidated) {
          this.results.summary.consolidatedEndpoints++;
          endpoint.consolidated = true;
        }

        // Validate CO2 tracking
        this.validateCO2Tracking(operation, endpoint, fileResults);

        // Validate API call tracking
        this.validateAPITracking(operation, endpoint, fileResults, isConsolidated);

        fileResults.endpoints.push(endpoint);
      });
    });

    this.results.files.push(fileResults);
    this.results.summary.totalFiles++;

    // Print file summary
    if (fileResults.errors.length > 0) {
      this.log(`❌ ${fileResults.errors.length} error(s) found`, 'red');
      fileResults.errors.forEach(err => this.log(`   ${err}`, 'red'));
    }
    if (fileResults.warnings.length > 0) {
      this.log(`⚠️  ${fileResults.warnings.length} warning(s) found`, 'yellow');
      fileResults.warnings.forEach(warn => this.log(`   ${warn}`, 'yellow'));
    }
    if (fileResults.errors.length === 0 && fileResults.warnings.length === 0) {
      this.log(`✅ All checks passed`, 'green');
    }

    return fileResults;
  }

  validateCO2Tracking(operation, endpoint, fileResults) {
    const co2Impact = operation['x-co2-impact'];

    if (!co2Impact) {
      endpoint.checks.co2 = 'missing';
      fileResults.warnings.push(`${endpoint.method} ${endpoint.path}: Missing x-co2-impact extension`);
      this.results.summary.warnings++;
      return;
    }

    this.results.summary.co2TrackedEndpoints++;

    if (!co2Impact.enabled) {
      endpoint.checks.co2 = 'disabled';
      fileResults.warnings.push(`${endpoint.method} ${endpoint.path}: CO2 tracking is disabled`);
      this.results.summary.warnings++;
      return;
    }

    const co2Value = co2Impact.estimatedGramsPerRequest;
    endpoint.checks.co2 = co2Value;

    if (co2Value > this.config.CO2_THRESHOLD) {
      endpoint.checks.co2Status = 'error';
      fileResults.errors.push(
        `${endpoint.method} ${endpoint.path}: CO2 ${co2Value}g exceeds threshold ${this.config.CO2_THRESHOLD}g`
      );
      this.results.summary.errors++;

      // Check for mitigation strategies
      if (!co2Impact.mitigationStrategies || co2Impact.mitigationStrategies.length === 0) {
        fileResults.errors.push(
          `${endpoint.method} ${endpoint.path}: High CO2 impact requires mitigation strategies`
        );
        this.results.summary.errors++;
      }
    } else if (co2Value > this.config.CO2_WARNING_THRESHOLD) {
      endpoint.checks.co2Status = 'warning';
      fileResults.warnings.push(
        `${endpoint.method} ${endpoint.path}: CO2 ${co2Value}g exceeds warning threshold ${this.config.CO2_WARNING_THRESHOLD}g`
      );
      this.results.summary.warnings++;
    } else {
      endpoint.checks.co2Status = 'pass';
    }

    // Validate calculation method
    const validMethods = ['cloud-carbon-coefficients', 'green-web-foundation', 'custom'];
    if (!validMethods.includes(co2Impact.calculationMethod)) {
      fileResults.warnings.push(
        `${endpoint.method} ${endpoint.path}: Invalid or missing calculation method`
      );
      this.results.summary.warnings++;
    }
  }

  validateAPITracking(operation, endpoint, fileResults, isConsolidated) {
    const tracking = operation['x-api-call-tracking'];

    if (!tracking) {
      endpoint.checks.tracking = 'missing';

      if (isConsolidated && this.config.REQUIRE_CONSOLIDATED_TRACKING) {
        fileResults.errors.push(
          `${endpoint.method} ${endpoint.path}: Consolidated endpoint missing required x-api-call-tracking`
        );
        this.results.summary.errors++;
      } else {
        fileResults.warnings.push(
          `${endpoint.method} ${endpoint.path}: Missing x-api-call-tracking extension`
        );
        this.results.summary.warnings++;
      }
      return;
    }

    this.results.summary.trackedEndpoints++;

    if (!tracking.enabled) {
      endpoint.checks.tracking = 'disabled';
      fileResults.warnings.push(`${endpoint.method} ${endpoint.path}: API tracking is disabled`);
      this.results.summary.warnings++;
      return;
    }

    endpoint.checks.tracking = 'enabled';

    // Validate groupBy includes correlationId
    if (!tracking.groupBy || !tracking.groupBy.includes('correlationId')) {
      fileResults.errors.push(
        `${endpoint.method} ${endpoint.path}: API tracking must group by 'correlationId'`
      );
      this.results.summary.errors++;
    }

    // Validate implementation
    if (!tracking.implementation) {
      fileResults.errors.push(
        `${endpoint.method} ${endpoint.path}: API tracking missing implementation details`
      );
      this.results.summary.errors++;
      return;
    }

    const impl = tracking.implementation;

    // Validate method
    if (!['logging', 'metrics'].includes(impl.method)) {
      fileResults.errors.push(
        `${endpoint.method} ${endpoint.path}: Invalid tracking method '${impl.method}'`
      );
      this.results.summary.errors++;
    }

    // Validate correlation ID header
    if (!impl.correlationIdHeader || !impl.correlationIdHeader.startsWith('X-')) {
      fileResults.errors.push(
        `${endpoint.method} ${endpoint.path}: correlationIdHeader must start with 'X-'`
      );
      this.results.summary.errors++;
    }

    // Validate logging configuration
    if (impl.method === 'logging') {
      if (!impl.logFormat || !impl.logFormat.template) {
        fileResults.errors.push(
          `${endpoint.method} ${endpoint.path}: Logging method requires logFormat.template`
        );
        this.results.summary.errors++;
      }

      if (!impl.logLevel) {
        fileResults.warnings.push(
          `${endpoint.method} ${endpoint.path}: logLevel not specified`
        );
        this.results.summary.warnings++;
      }
    }

    // Validate metrics configuration
    if (impl.metrics && impl.metrics.enabled) {
      if (!impl.metrics.endpoint) {
        fileResults.errors.push(
          `${endpoint.method} ${endpoint.path}: Metrics enabled but endpoint not specified`
        );
        this.results.summary.errors++;
      }

      if (!impl.metrics.counters || impl.metrics.counters.length === 0) {
        fileResults.warnings.push(
          `${endpoint.method} ${endpoint.path}: No metrics counters defined`
        );
        this.results.summary.warnings++;
      }
    }

    // Validate aggregation
    if (impl.aggregation && impl.aggregation.enabled && !impl.aggregation.query) {
      fileResults.errors.push(
        `${endpoint.method} ${endpoint.path}: Aggregation enabled but query not specified`
      );
      this.results.summary.errors++;
    }
  }

  printSummary() {
    const { summary } = this.results;

    this.log('\n' + '='.repeat(60), 'cyan');
    this.log('📊 VALIDATION SUMMARY', 'cyan');
    this.log('='.repeat(60), 'cyan');

    this.log(`\nFiles Validated: ${summary.totalFiles}`);
    this.log(`Total Endpoints: ${summary.totalEndpoints}`);
    this.log(`Consolidated Endpoints: ${summary.consolidatedEndpoints}`);

    const trackingCoverage = summary.totalEndpoints > 0
      ? (summary.trackedEndpoints / summary.totalEndpoints * 100).toFixed(2)
      : 0;

    const co2Coverage = summary.totalEndpoints > 0
      ? (summary.co2TrackedEndpoints / summary.totalEndpoints * 100).toFixed(2)
      : 0;

    this.log(`\nAPI Tracking Coverage: ${trackingCoverage}% (${summary.trackedEndpoints}/${summary.totalEndpoints})`);
    this.log(`CO2 Tracking Coverage: ${co2Coverage}% (${summary.co2TrackedEndpoints}/${summary.totalEndpoints})`);

    this.log(`\nErrors: ${summary.errors}`, summary.errors > 0 ? 'red' : 'green');
    this.log(`Warnings: ${summary.warnings}`, summary.warnings > 0 ? 'yellow' : 'green');

    const hasFailed = summary.errors > 0 ||
                      (this.config.FAIL_ON_WARNINGS && summary.warnings > 0) ||
                      (parseFloat(trackingCoverage) < this.config.MINIMUM_TRACKING_COVERAGE);

    if (hasFailed) {
      this.log('\n❌ VALIDATION FAILED', 'red');
      return false;
    } else {
      this.log('\n✅ VALIDATION PASSED', 'green');
      return true;
    }
  }

  parseYAML(content) {
    // Very basic YAML parser for OpenAPI specs
    // In production, use a proper YAML library like js-yaml
    try {
      // This is a simplified parser - in real use, install and use js-yaml
      const lines = content.split('\n');
      const result = { paths: {} };
      let currentPath = null;
      let currentMethod = null;
      let indent = 0;

      // Note: This is a placeholder. For production use:
      // const yaml = require('js-yaml');
      // return yaml.load(content);

      return JSON.parse(JSON.stringify(result));
    } catch (err) {
      throw new Error('YAML parsing failed. Please install js-yaml: npm install js-yaml');
    }
  }
}

// CLI Interface
function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes('--help')) {
    console.log(`
OpenAPI SAST Validator - CO2 and API Tracking

Usage:
  node validate-openapi.js <spec-file.yaml>    Validate a single spec
  node validate-openapi.js --all                Validate all specs in directory
  node validate-openapi.js --help               Show this help

Environment Variables:
  CO2_THRESHOLD=50                              Maximum CO2 grams per request
  CO2_WARNING_THRESHOLD=30                      Warning threshold
  MINIMUM_TRACKING_COVERAGE=80                  Minimum tracking coverage %
  FAIL_ON_WARNINGS=false                        Fail on warnings

Example:
  node validate-openapi.js ./test-api-spec.yaml
  CO2_THRESHOLD=30 node validate-openapi.js --all
    `);
    process.exit(0);
  }

  // Override config from environment
  const config = { ...CONFIG };
  if (process.env.CO2_THRESHOLD) config.CO2_THRESHOLD = parseInt(process.env.CO2_THRESHOLD);
  if (process.env.CO2_WARNING_THRESHOLD) config.CO2_WARNING_THRESHOLD = parseInt(process.env.CO2_WARNING_THRESHOLD);
  if (process.env.MINIMUM_TRACKING_COVERAGE) config.MINIMUM_TRACKING_COVERAGE = parseInt(process.env.MINIMUM_TRACKING_COVERAGE);
  if (process.env.FAIL_ON_WARNINGS) config.FAIL_ON_WARNINGS = process.env.FAIL_ON_WARNINGS === 'true';

  const validator = new OpenAPIValidator(config);

  if (args.includes('--all')) {
    console.log('🔍 Scanning for OpenAPI specs...');
    // In production, use glob to find all YAML files
    console.log('Note: Install glob package for --all support: npm install glob');
    process.exit(1);
  } else {
    const specFile = args[0];
    if (!fs.existsSync(specFile)) {
      console.error(`❌ File not found: ${specFile}`);
      process.exit(1);
    }

    validator.validateFile(specFile);
    const passed = validator.printSummary();
    process.exit(passed ? 0 : 1);
  }
}

if (require.main === module) {
  main();
}

module.exports = OpenAPIValidator;
