#!/usr/bin/env node

import { Command } from 'commander';
import { generateSDK } from './generator';
import chalk from 'chalk';
import path from 'path';
import { logger, PerformanceTimer } from './utils/logger';
import { setupGlobalErrorHandlers, handleError, validateOrThrow } from './utils/error-handler';
import { ErrorCode, createError } from './utils/error-codes';
import { monitoring, getHealthStatus } from './utils/monitoring';
import * as fs from 'fs-extra';

// Setup global error handlers
setupGlobalErrorHandlers();

const program = new Command();

program
  .name('openapi-redux-gen')
  .description('Generate Redux-based client SDK from OpenAPI specification')
  .version('1.0.0')
  .option('--debug', 'Enable debug logging', false)
  .option('--log-level <level>', 'Set log level (error, warn, info, debug)', 'info')
  .hook('preAction', (thisCommand) => {
    const opts = thisCommand.opts();
    if (opts.debug) {
      process.env.DEBUG = 'true';
      logger.setLevel('debug' as any);
    } else if (opts.logLevel) {
      logger.setLevel(opts.logLevel as any);
    }
  });

program
  .command('generate')
  .description('Generate SDK from OpenAPI spec')
  .requiredOption('-i, --input <path>', 'Path to OpenAPI specification file (JSON or YAML)')
  .requiredOption('-o, --output <path>', 'Output directory for generated SDK')
  .option('-n, --name <name>', 'Module name for the generated SDK', 'api')
  .option('-b, --base-url <url>', 'Base URL for API requests (overrides spec)')
  .option('--modern-only', 'Generate only modern RTK Query API (skip legacy async thunks)', false)
  .option('--legacy-only', 'Generate only legacy Redux with async thunks', false)
  .action(async (options) => {
    const timer = new PerformanceTimer('SDK Generation');

    try {
      logger.info('Starting SDK generation', {
        input: options.input,
        output: options.output,
        moduleName: options.name,
      });

      console.log(chalk.blue('🚀 Starting SDK generation...\n'));

      // Validate input file exists
      const inputSpec = path.resolve(options.input);
      validateOrThrow(
        await fs.pathExists(inputSpec),
        ErrorCode.FILE_NOT_FOUND,
        `Input file not found: ${inputSpec}`,
        { inputPath: inputSpec }
      );

      const outputDir = path.resolve(options.output);

      logger.debug('Resolved paths', { inputSpec, outputDir });

      // Validate conflicting options
      if (options.modernOnly && options.legacyOnly) {
        throw createError(
          ErrorCode.INVALID_ARGUMENT,
          'Cannot use both --modern-only and --legacy-only flags',
          undefined,
          { modernOnly: options.modernOnly, legacyOnly: options.legacyOnly }
        );
      }

      // Generate SDK
      await generateSDK({
        inputSpec,
        outputDir,
        moduleName: options.name,
        baseURL: options.baseUrl,
        modernOnly: options.modernOnly,
        legacyOnly: options.legacyOnly,
      });

      timer.end(true);

      console.log(chalk.green('\n✅ SDK generated successfully!'));
      console.log(chalk.gray(`Output directory: ${outputDir}\n`));

      logger.info('SDK generation completed successfully', {
        outputDir,
        duration: timer.elapsed(),
      });

      // Show metrics in debug mode
      if (process.env.DEBUG === 'true') {
        console.log(monitoring.getMetricsSummary());
      }
    } catch (error) {
      timer.end(false, error as Error);
      handleError(error as Error);
    }
  });

program
  .command('health')
  .description('Check health status and view metrics')
  .action(() => {
    try {
      const health = getHealthStatus();

      console.log(chalk.blue('\n=== Health Status ===\n'));

      const statusColor =
        health.status === 'healthy' ? chalk.green :
        health.status === 'degraded' ? chalk.yellow :
        chalk.red;

      console.log(`Status: ${statusColor(health.status.toUpperCase())}`);
      console.log(`Timestamp: ${health.timestamp.toISOString()}\n`);

      console.log(monitoring.getMetricsSummary());

      logger.info('Health check performed', { status: health.status });
    } catch (error) {
      handleError(error as Error);
    }
  });

program
  .command('clear-metrics')
  .description('Clear all collected metrics')
  .action(() => {
    try {
      monitoring.clear();
      console.log(chalk.green('✅ Metrics cleared successfully'));
      logger.info('Metrics cleared');
    } catch (error) {
      handleError(error as Error);
    }
  });

program.parse();
