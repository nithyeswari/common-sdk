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

program
  .command('generate-spring')
  .description('Generate Spring Boot REST API from OpenAPI spec')
  .requiredOption('-i, --input <path>', 'Path to OpenAPI specification file')
  .requiredOption('-o, --output <path>', 'Output directory')
  .option('-p, --package <name>', 'Java package name', 'com.example.api')
  .option('-g, --group-id <id>', 'Maven group ID', 'com.example')
  .option('-a, --artifact-id <id>', 'Maven artifact ID', 'api-service')
  .option('-v, --version <version>', 'Project version', '1.0.0')
  .option('--java-version <version>', 'Java version', '21')
  .option('--spring-boot-version <version>', 'Spring Boot version', '3.2.0')
  .action(async (options) => {
    const timer = new PerformanceTimer('Spring Boot Generation');

    try {
      console.log(chalk.blue('🍃 Generating Spring Boot project...\n'));

      const { generateSpringBoot } = require('./generators/java/spring-boot-generator');
      const { parseOpenAPISpec } = require('./parser/openapi-parser');

      const inputSpec = path.resolve(options.input);
      const outputDir = path.resolve(options.output);

      logger.info('Starting Spring Boot generation', { inputSpec, outputDir });

      const parsedAPI = await parseOpenAPISpec(inputSpec);

      await generateSpringBoot(parsedAPI, outputDir, {
        packageName: options.package,
        groupId: options.groupId,
        artifactId: options.artifactId,
        version: options.version,
        javaVersion: parseInt(options.javaVersion),
        springBootVersion: options.springBootVersion,
      });

      timer.end(true);

      console.log(chalk.green('\n✅ Spring Boot project generated successfully!'));
      console.log(chalk.gray(`Output directory: ${outputDir}\n`));
      console.log(chalk.cyan('To run the project:'));
      console.log(chalk.gray(`  cd ${outputDir}`));
      console.log(chalk.gray('  mvn spring-boot:run\n'));

      logger.info('Spring Boot generation completed', { duration: timer.elapsed() });
    } catch (error) {
      timer.end(false, error as Error);
      handleError(error as Error);
    }
  });

program
  .command('generate-all')
  .description('Generate ALL frameworks (React + Spring Boot + Quarkus) from OpenAPI spec')
  .requiredOption('-i, --input <path>', 'Path to OpenAPI specification file')
  .requiredOption('-o, --output <path>', 'Output directory')
  .option('-p, --package <name>', 'Java package name', 'com.example.api')
  .option('-g, --group-id <id>', 'Maven group ID', 'com.example')
  .option('-a, --artifact-id <id>', 'Maven artifact ID', 'api-service')
  .option('--module-name <name>', 'React module name', 'api')
  .option('--skip-react', 'Skip React generation', false)
  .option('--skip-spring', 'Skip Spring Boot generation', false)
  .option('--skip-quarkus', 'Skip Quarkus generation', false)
  .option('--quarkus-reactive', 'Generate reactive Quarkus code', false)
  .action(async (options) => {
    const timer = new PerformanceTimer('Full Stack Generation');

    try {
      console.log(chalk.blue.bold('\n🚀 Generating FULL STACK from OpenAPI spec...\n'));

      const { parseOpenAPISpec } = require('./parser/openapi-parser');
      const inputSpec = path.resolve(options.input);
      const outputDir = path.resolve(options.output);

      logger.info('Starting full stack generation', {
        inputSpec,
        outputDir,
        skipReact: options.skipReact,
        skipSpring: options.skipSpring,
        skipQuarkus: options.skipQuarkus
      });

      // Parse OpenAPI spec once
      const parsedAPI = await parseOpenAPISpec(inputSpec);

      // Generate React (frontend)
      if (!options.skipReact) {
        console.log(chalk.cyan('\n📱 [1/3] Generating React + RTK Query...\n'));
        const reactDir = path.join(outputDir, 'frontend-react');
        await generateSDK({
          inputSpec,
          outputDir: reactDir,
          moduleName: options.moduleName,
          modernOnly: true,
        });
        console.log(chalk.green(`✅ React generated: ${reactDir}`));
      }

      // Generate Spring Boot (backend)
      if (!options.skipSpring) {
        console.log(chalk.cyan('\n🍃 [2/3] Generating Spring Boot...\n'));
        const { generateSpringBoot } = require('./generators/java/spring-boot-generator');
        const springDir = path.join(outputDir, 'backend-spring');
        await generateSpringBoot(parsedAPI, springDir, {
          packageName: options.package,
          groupId: options.groupId,
          artifactId: options.artifactId + '-spring',
          version: '1.0.0',
          javaVersion: 21,
          springBootVersion: '3.2.0',
        });
        console.log(chalk.green(`✅ Spring Boot generated: ${springDir}`));
      }

      // Generate Quarkus (backend alternative)
      if (!options.skipQuarkus) {
        console.log(chalk.cyan('\n⚡ [3/3] Generating Quarkus...\n'));
        const { generateQuarkus } = require('./generators/java/quarkus-generator');
        const quarkusDir = path.join(outputDir, 'backend-quarkus');
        await generateQuarkus(parsedAPI, quarkusDir, {
          packageName: options.package,
          groupId: options.groupId,
          artifactId: options.artifactId + '-quarkus',
          version: '1.0.0',
          javaVersion: 21,
          quarkusVersion: '3.6.0',
          reactive: options.quarkusReactive,
        });
        console.log(chalk.green(`✅ Quarkus generated: ${quarkusDir}`));
      }

      timer.end(true);

      console.log(chalk.green.bold('\n🎉 FULL STACK GENERATION COMPLETE!\n'));
      console.log(chalk.gray('Output directory structure:'));
      console.log(chalk.gray(`${outputDir}/`));
      if (!options.skipReact) console.log(chalk.gray(`  ├── frontend-react/     # React + RTK Query`));
      if (!options.skipSpring) console.log(chalk.gray(`  ├── backend-spring/     # Spring Boot 3.x`));
      if (!options.skipQuarkus) console.log(chalk.gray(`  └── backend-quarkus/    # Quarkus 3.x${options.quarkusReactive ? ' (Reactive)' : ''}`));

      console.log(chalk.cyan('\n📚 Quick Start:\n'));
      if (!options.skipReact) {
        console.log(chalk.gray('React (Frontend):'));
        console.log(chalk.white(`  cd ${path.join(outputDir, 'frontend-react')}`));
        console.log(chalk.white('  npm install && npm start\n'));
      }
      if (!options.skipSpring) {
        console.log(chalk.gray('Spring Boot (Backend):'));
        console.log(chalk.white(`  cd ${path.join(outputDir, 'backend-spring')}`));
        console.log(chalk.white('  mvn spring-boot:run\n'));
      }
      if (!options.skipQuarkus) {
        console.log(chalk.gray('Quarkus (Backend Alternative):'));
        console.log(chalk.white(`  cd ${path.join(outputDir, 'backend-quarkus')}`));
        console.log(chalk.white('  mvn quarkus:dev\n'));
      }

      logger.info('Full stack generation completed', {
        duration: timer.elapsed(),
        outputDir
      });
    } catch (error) {
      timer.end(false, error as Error);
      handleError(error as Error);
    }
  });

program
  .command('generate-quarkus')
  .description('Generate Quarkus REST API from OpenAPI spec')
  .requiredOption('-i, --input <path>', 'Path to OpenAPI specification file')
  .requiredOption('-o, --output <path>', 'Output directory')
  .option('-p, --package <name>', 'Java package name', 'com.example.api')
  .option('-g, --group-id <id>', 'Maven group ID', 'com.example')
  .option('-a, --artifact-id <id>', 'Maven artifact ID', 'api-service')
  .option('-v, --version <version>', 'Project version', '1.0.0')
  .option('--java-version <version>', 'Java version', '21')
  .option('--quarkus-version <version>', 'Quarkus version', '3.6.0')
  .option('--reactive', 'Generate reactive (Mutiny) code', false)
  .action(async (options) => {
    const timer = new PerformanceTimer('Quarkus Generation');

    try {
      console.log(chalk.blue('⚡ Generating Quarkus project...\n'));

      const { generateQuarkus } = require('./generators/java/quarkus-generator');
      const { parseOpenAPISpec } = require('./parser/openapi-parser');

      const inputSpec = path.resolve(options.input);
      const outputDir = path.resolve(options.output);

      logger.info('Starting Quarkus generation', { inputSpec, outputDir, reactive: options.reactive });

      const parsedAPI = await parseOpenAPISpec(inputSpec);

      await generateQuarkus(parsedAPI, outputDir, {
        packageName: options.package,
        groupId: options.groupId,
        artifactId: options.artifactId,
        version: options.version,
        javaVersion: parseInt(options.javaVersion),
        quarkusVersion: options.quarkusVersion,
        reactive: options.reactive,
      });

      timer.end(true);

      console.log(chalk.green('\n✅ Quarkus project generated successfully!'));
      console.log(chalk.gray(`Output directory: ${outputDir}\n`));
      console.log(chalk.cyan('To run the project:'));
      console.log(chalk.gray(`  cd ${outputDir}`));
      console.log(chalk.gray('  mvn quarkus:dev\n'));

      logger.info('Quarkus generation completed', { duration: timer.elapsed() });
    } catch (error) {
      timer.end(false, error as Error);
      handleError(error as Error);
    }
  });

program
  .command('generate-spring-client')
  .description('Generate Spring Boot REST Client SDK from OpenAPI spec')
  .requiredOption('-i, --input <path>', 'Path to OpenAPI specification file')
  .requiredOption('-o, --output <path>', 'Output directory')
  .option('-p, --package <name>', 'Java package name', 'com.example.api.client')
  .option('-g, --group-id <id>', 'Maven group ID', 'com.example')
  .option('-a, --artifact-id <id>', 'Maven artifact ID', 'api-client')
  .option('-v, --version <version>', 'Project version', '1.0.0')
  .option('--java-version <version>', 'Java version', '21')
  .option('--spring-boot-version <version>', 'Spring Boot version', '3.2.0')
  .option('--use-rest-template', 'Use RestTemplate instead of WebClient', false)
  .action(async (options) => {
    const timer = new PerformanceTimer('Spring Client Generation');

    try {
      console.log(chalk.blue('🔌 Generating Spring Boot REST Client SDK...\n'));

      const { generateSpringClient } = require('./generators/java/spring-client-generator');
      const { parseOpenAPISpec } = require('./parser/openapi-parser');

      const inputSpec = path.resolve(options.input);
      const outputDir = path.resolve(options.output);

      logger.info('Starting Spring Client generation', { inputSpec, outputDir });

      const parsedAPI = await parseOpenAPISpec(inputSpec);

      await generateSpringClient(parsedAPI, outputDir, {
        packageName: options.package,
        groupId: options.groupId,
        artifactId: options.artifactId,
        version: options.version,
        javaVersion: parseInt(options.javaVersion),
        springBootVersion: options.springBootVersion,
        useWebClient: !options.useRestTemplate,
      });

      timer.end(true);

      console.log(chalk.green('\n✅ Spring Boot Client SDK generated successfully!'));
      console.log(chalk.gray(`Output directory: ${outputDir}\n`));
      console.log(chalk.cyan('Usage in your microservice:'));
      console.log(chalk.gray(`  // Inject the client`));
      console.log(chalk.gray(`  @Autowired`));
      console.log(chalk.gray(`  private PetsClient petsClient;\n`));
      console.log(chalk.gray(`  // Use it`));
      console.log(chalk.gray(`  var pets = petsClient.listPets(10, "dog");\n`));

      logger.info('Spring Client generation completed', { duration: timer.elapsed() });
    } catch (error) {
      timer.end(false, error as Error);
      handleError(error as Error);
    }
  });

program
  .command('generate-quarkus-client')
  .description('Generate Quarkus REST Client SDK from OpenAPI spec')
  .requiredOption('-i, --input <path>', 'Path to OpenAPI specification file')
  .requiredOption('-o, --output <path>', 'Output directory')
  .option('-p, --package <name>', 'Java package name', 'com.example.api.client')
  .option('-g, --group-id <id>', 'Maven group ID', 'com.example')
  .option('-a, --artifact-id <id>', 'Maven artifact ID', 'api-client')
  .option('-v, --version <version>', 'Project version', '1.0.0')
  .option('--java-version <version>', 'Java version', '21')
  .option('--quarkus-version <version>', 'Quarkus version', '3.6.0')
  .option('--reactive', 'Generate reactive (Mutiny) client', false)
  .action(async (options) => {
    const timer = new PerformanceTimer('Quarkus Client Generation');

    try {
      console.log(chalk.blue('🔌 Generating Quarkus REST Client SDK...\n'));

      const { generateQuarkusClient } = require('./generators/java/quarkus-client-generator');
      const { parseOpenAPISpec } = require('./parser/openapi-parser');

      const inputSpec = path.resolve(options.input);
      const outputDir = path.resolve(options.output);

      logger.info('Starting Quarkus Client generation', { inputSpec, outputDir, reactive: options.reactive });

      const parsedAPI = await parseOpenAPISpec(inputSpec);

      await generateQuarkusClient(parsedAPI, outputDir, {
        packageName: options.package,
        groupId: options.groupId,
        artifactId: options.artifactId,
        version: options.version,
        javaVersion: parseInt(options.javaVersion),
        quarkusVersion: options.quarkusVersion,
        reactive: options.reactive,
      });

      timer.end(true);

      console.log(chalk.green('\n✅ Quarkus REST Client SDK generated successfully!'));
      console.log(chalk.gray(`Output directory: ${outputDir}\n`));
      console.log(chalk.cyan('Usage in your microservice:'));
      console.log(chalk.gray(`  // Inject the client`));
      console.log(chalk.gray(`  @Inject`));
      console.log(chalk.gray(`  @RestClient`));
      console.log(chalk.gray(`  PetsClient petsClient;\n`));
      console.log(chalk.gray(`  // Use it`));
      console.log(chalk.gray(`  var pets = petsClient.listPets(10, "dog");\n`));

      logger.info('Quarkus Client generation completed', { duration: timer.elapsed() });
    } catch (error) {
      timer.end(false, error as Error);
      handleError(error as Error);
    }
  });

program.parse();
