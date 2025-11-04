/**
 * Spring Boot REST API Generator
 * Generates modern Spring Boot 3.x controllers with comprehensive features
 */

import { ParsedAPI, Endpoint } from '../../types';
import { writeFile, ensureDir } from 'fs-extra';
import path from 'path';
import { logger } from '../../utils/logger';
import { trackPerformance } from '../../utils/monitoring';

export interface SpringBootOptions {
  packageName: string;
  groupId: string;
  artifactId: string;
  version: string;
  javaVersion: number;
  springBootVersion: string;
}

export async function generateSpringBoot(
  api: ParsedAPI,
  outputDir: string,
  options: SpringBootOptions
): Promise<void> {
  return trackPerformance('Spring Boot Generation', async () => {
    logger.info('Generating Spring Boot project', { packageName: options.packageName });

    const basePackage = options.packageName.replace(/\./g, '/');
    const srcDir = path.join(outputDir, 'src/main/java', basePackage);
    const resourcesDir = path.join(outputDir, 'src/main/resources');
    const testDir = path.join(outputDir, 'src/test/java', basePackage);

    // Create directory structure
    await ensureDir(srcDir);
    await ensureDir(resourcesDir);
    await ensureDir(testDir);

    // Generate files
    await generatePomXml(outputDir, options);
    await generateApplicationProperties(resourcesDir);
    await generateApplicationClass(srcDir, options.packageName);
    await generateDTOs(api, path.join(srcDir, 'dto'), options.packageName);
    await generateControllers(api, path.join(srcDir, 'controller'), options.packageName);
    await generateServices(api, path.join(srcDir, 'service'), options.packageName);
    await generateExceptionHandler(path.join(srcDir, 'exception'), options.packageName);
    await generateConfiguration(path.join(srcDir, 'config'), options.packageName);
    await generateLoggingAspect(path.join(srcDir, 'aspect'), options.packageName);
    await generateMonitoringConfig(path.join(srcDir, 'config'), options.packageName);

    logger.info('Spring Boot project generated successfully');
  });
}

async function generatePomXml(outputDir: string, options: SpringBootOptions): Promise<void> {
  const content = `<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="http://maven.apache.org/POM/4.0.0
         https://maven.apache.org/xsd/maven-4.0.0.xsd">
    <modelVersion>4.0.0</modelVersion>

    <parent>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-parent</artifactId>
        <version>${options.springBootVersion}</version>
        <relativePath/>
    </parent>

    <groupId>${options.groupId}</groupId>
    <artifactId>${options.artifactId}</artifactId>
    <version>${options.version}</version>
    <name>${options.artifactId}</name>
    <description>Generated Spring Boot API from OpenAPI specification</description>

    <properties>
        <java.version>${options.javaVersion}</java.version>
        <maven.compiler.source>${options.javaVersion}</maven.compiler.source>
        <maven.compiler.target>${options.javaVersion}</maven.compiler.target>
        <project.build.sourceEncoding>UTF-8</project.build.sourceEncoding>
    </properties>

    <dependencies>
        <!-- Spring Boot Starters -->
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-web</artifactId>
        </dependency>
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-validation</artifactId>
        </dependency>
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-actuator</artifactId>
        </dependency>
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-aop</artifactId>
        </dependency>

        <!-- OpenAPI/Swagger -->
        <dependency>
            <groupId>org.springdoc</groupId>
            <artifactId>springdoc-openapi-starter-webmvc-ui</artifactId>
            <version>2.3.0</version>
        </dependency>

        <!-- Monitoring -->
        <dependency>
            <groupId>io.micrometer</groupId>
            <artifactId>micrometer-registry-prometheus</artifactId>
        </dependency>

        <!-- Lombok (optional but recommended) -->
        <dependency>
            <groupId>org.projectlombok</groupId>
            <artifactId>lombok</artifactId>
            <optional>true</optional>
        </dependency>

        <!-- Logging -->
        <dependency>
            <groupId>net.logstash.logback</groupId>
            <artifactId>logstash-logback-encoder</artifactId>
            <version>7.4</version>
        </dependency>

        <!-- Testing -->
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-test</artifactId>
            <scope>test</scope>
        </dependency>
    </dependencies>

    <build>
        <plugins>
            <plugin>
                <groupId>org.springframework.boot</groupId>
                <artifactId>spring-boot-maven-plugin</artifactId>
                <configuration>
                    <excludes>
                        <exclude>
                            <groupId>org.projectlombok</groupId>
                            <artifactId>lombok</artifactId>
                        </exclude>
                    </excludes>
                </configuration>
            </plugin>
        </plugins>
    </build>
</project>
`;

  await writeFile(path.join(outputDir, 'pom.xml'), content);
}

async function generateApplicationProperties(resourcesDir: string): Promise<void> {
  const content = `# Server Configuration
server.port=8080
server.shutdown=graceful
spring.lifecycle.timeout-per-shutdown-phase=20s

# Application Configuration
spring.application.name=api-service

# Logging Configuration
logging.level.root=INFO
logging.level.${'{'}package${'}'}=DEBUG
logging.pattern.console=%d{yyyy-MM-dd HH:mm:ss} - %msg%n
logging.pattern.file=%d{yyyy-MM-dd HH:mm:ss} [%thread] %-5level %logger{36} - %msg%n

# Actuator Configuration
management.endpoints.web.exposure.include=health,metrics,prometheus,info
management.endpoint.health.show-details=always
management.metrics.export.prometheus.enabled=true

# OpenAPI/Swagger Configuration
springdoc.api-docs.path=/api-docs
springdoc.swagger-ui.path=/swagger-ui.html
springdoc.swagger-ui.operationsSorter=method

# Exception Handling
server.error.include-message=always
server.error.include-binding-errors=always
server.error.include-stacktrace=on_param
server.error.include-exception=false

# Jackson Configuration
spring.jackson.default-property-inclusion=non_null
spring.jackson.serialization.write-dates-as-timestamps=false
`;

  await writeFile(path.join(resourcesDir, 'application.properties'), content);
}

async function generateApplicationClass(srcDir: string, packageName: string): Promise<void> {
  const className = 'Application';
  const content = `package ${packageName};

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.EnableAspectJAutoProxy;

/**
 * Main application class
 * Generated from OpenAPI specification
 */
@SpringBootApplication
@EnableAspectJAutoProxy
public class ${className} {
    public static void main(String[] args) {
        SpringApplication.run(${className}.class, args);
    }
}
`;

  await writeFile(path.join(srcDir, `${className}.java`), content);
}

async function generateDTOs(
  api: ParsedAPI,
  outputDir: string,
  packageName: string
): Promise<void> {
  await ensureDir(outputDir);

  // Generate DTOs from schemas
  for (const schema of api.schemas) {
    const className = capitalize(schema.name);
    const content = generateDTOClass(className, schema.schema, packageName);
    await writeFile(path.join(outputDir, `${className}.java`), content);
  }
}

function generateDTOClass(className: string, schema: any, packageName: string): string {
  const properties = schema.properties || {};
  const required = schema.required || [];

  let content = `package ${packageName}.dto;

import lombok.Data;
import lombok.Builder;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import jakarta.validation.constraints.*;
import com.fasterxml.jackson.annotation.JsonProperty;
import java.time.LocalDateTime;
import java.util.List;

/**
 * ${schema.description || className + ' DTO'}
 * Generated from OpenAPI specification
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ${className} {
`;

  // Generate fields
  for (const [propName, propSchema] of Object.entries(properties)) {
    const prop = propSchema as any;
    const javaType = mapOpenAPITypeToJava(prop);
    const isRequired = required.includes(propName);

    // Add validation annotations
    if (isRequired) {
      content += `    @NotNull(message = "${propName} is required")\n`;
    }
    if (prop.minLength) {
      content += `    @Size(min = ${prop.minLength})\n`;
    }
    if (prop.maxLength) {
      content += `    @Size(max = ${prop.maxLength})\n`;
    }
    if (prop.pattern) {
      content += `    @Pattern(regexp = "${prop.pattern}")\n`;
    }
    if (prop.format === 'email') {
      content += `    @Email\n`;
    }

    content += `    @JsonProperty("${propName}")\n`;
    content += `    private ${javaType} ${toCamelCase(propName)};\n\n`;
  }

  content += `}\n`;

  return content;
}

async function generateControllers(
  api: ParsedAPI,
  outputDir: string,
  packageName: string
): Promise<void> {
  await ensureDir(outputDir);

  // Group endpoints by tag/resource
  const grouped = groupEndpointsByTag(api.endpoints);

  for (const [tag, endpoints] of Object.entries(grouped)) {
    const className = capitalize(tag) + 'Controller';
    const content = generateControllerClass(className, endpoints, packageName);
    await writeFile(path.join(outputDir, `${className}.java`), content);
  }
}

function generateControllerClass(
  className: string,
  endpoints: Endpoint[],
  packageName: string
): string {
  const resourcePath = '/' + className.replace('Controller', '').toLowerCase();

  let content = `package ${packageName}.controller;

import ${packageName}.dto.*;
import ${packageName}.service.*;
import ${packageName}.exception.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.validation.annotation.Validated;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;

/**
 * REST controller for ${className.replace('Controller', '')} operations
 * Generated from OpenAPI specification
 */
@Slf4j
@RestController
@RequestMapping("${resourcePath}")
@RequiredArgsConstructor
@Validated
@Tag(name = "${className.replace('Controller', '')}", description = "${className.replace('Controller', '')} API")
public class ${className} {

    private final ${className.replace('Controller', '')}Service service;

`;

  // Generate controller methods
  for (const endpoint of endpoints) {
    content += generateControllerMethod(endpoint);
  }

  content += `}\n`;

  return content;
}

function generateControllerMethod(endpoint: Endpoint): string {
  const methodName = toCamelCase(endpoint.operationId || endpoint.path);
  const httpMethod = endpoint.method.toLowerCase();
  const springAnnotation = getSpringHttpAnnotation(endpoint.method);
  const pathParams = endpoint.parameters.filter(p => p.in === 'path');
  const queryParams = endpoint.parameters.filter(p => p.in === 'query');

  let method = `    /**
     * ${endpoint.summary || endpoint.operationId}
     * ${endpoint.description || ''}
     */
    @Operation(summary = "${endpoint.summary || endpoint.operationId}")
    @ApiResponses(value = {
        @ApiResponse(responseCode = "200", description = "Successful operation"),
        @ApiResponse(responseCode = "400", description = "Invalid input"),
        @ApiResponse(responseCode = "500", description = "Internal server error")
    })
    @${springAnnotation}("${endpoint.path.replace(/{/g, '{').replace(/}/g, '}')}")
    public ResponseEntity<?> ${methodName}(
`;

  // Add parameters
  const params: string[] = [];

  pathParams.forEach(param => {
    params.push(`            @PathVariable("${param.name}") ${mapTypeToJava(param.type)} ${toCamelCase(param.name)}`);
  });

  queryParams.forEach(param => {
    const required = param.required ? 'true' : 'false';
    params.push(`            @RequestParam(value = "${param.name}", required = ${required}) ${mapTypeToJava(param.type)} ${toCamelCase(param.name)}`);
  });

  if (endpoint.requestBody && (httpMethod === 'post' || httpMethod === 'put' || httpMethod === 'patch')) {
    params.push(`            @Valid @RequestBody Object requestBody`);
  }

  method += params.join(',\n') + '\n    ) {\n';
  method += `        log.debug("${methodName} called with parameters");\n`;
  method += `        var result = service.${methodName}(${params.map(p => {
    const paramName = p.split(' ').pop();
    return paramName;
  }).join(', ')});\n`;
  method += `        return ResponseEntity.ok(result);\n`;
  method += `    }\n\n`;

  return method;
}

function getSpringHttpAnnotation(method: string): string {
  const map: Record<string, string> = {
    GET: 'GetMapping',
    POST: 'PostMapping',
    PUT: 'PutMapping',
    DELETE: 'DeleteMapping',
    PATCH: 'PatchMapping',
  };
  return map[method.toUpperCase()] || 'RequestMapping';
}

async function generateServices(
  api: ParsedAPI,
  outputDir: string,
  packageName: string
): Promise<void> {
  await ensureDir(outputDir);

  const grouped = groupEndpointsByTag(api.endpoints);

  for (const [tag, endpoints] of Object.entries(grouped)) {
    const className = capitalize(tag) + 'Service';
    const content = generateServiceClass(className, endpoints, packageName);
    await writeFile(path.join(outputDir, `${className}.java`), content);
  }
}

function generateServiceClass(
  className: string,
  endpoints: Endpoint[],
  packageName: string
): string {
  return `package ${packageName}.service;

import ${packageName}.dto.*;
import ${packageName}.exception.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Service layer for ${className.replace('Service', '')} operations
 * Generated from OpenAPI specification
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ${className} {

    // TODO: Inject repositories or external API clients here

    ${endpoints.map(e => generateServiceMethod(e)).join('\n')}
}
`;
}

function generateServiceMethod(endpoint: Endpoint): string {
  const methodName = toCamelCase(endpoint.operationId || endpoint.path);

  return `    /**
     * ${endpoint.summary || endpoint.operationId}
     */
    @Transactional
    public Object ${methodName}(/* Add parameters */) {
        log.info("Executing ${methodName}");
        // TODO: Implement business logic
        throw new UnsupportedOperationException("${methodName} not implemented");
    }
`;
}

async function generateExceptionHandler(outputDir: string, packageName: string): Promise<void> {
  await ensureDir(outputDir);

  const content = `package ${packageName}.exception;

import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.context.request.WebRequest;
import jakarta.validation.ConstraintViolationException;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;

/**
 * Global exception handler
 * Handles all exceptions and returns structured error responses
 */
@Slf4j
@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(MethodArgumentNotValidException.class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    public ResponseEntity<ErrorResponse> handleValidationException(
            MethodArgumentNotValidException ex, WebRequest request) {
        log.error("Validation error", ex);

        Map<String, String> errors = new HashMap<>();
        ex.getBindingResult().getFieldErrors().forEach(error ->
            errors.put(error.getField(), error.getDefaultMessage())
        );

        ErrorResponse response = ErrorResponse.builder()
            .timestamp(LocalDateTime.now())
            .status(HttpStatus.BAD_REQUEST.value())
            .error("Validation Failed")
            .message("Input validation failed")
            .errors(errors)
            .path(request.getDescription(false))
            .build();

        return ResponseEntity.badRequest().body(response);
    }

    @ExceptionHandler(ConstraintViolationException.class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    public ResponseEntity<ErrorResponse> handleConstraintViolation(
            ConstraintViolationException ex, WebRequest request) {
        log.error("Constraint violation", ex);

        ErrorResponse response = ErrorResponse.builder()
            .timestamp(LocalDateTime.now())
            .status(HttpStatus.BAD_REQUEST.value())
            .error("Constraint Violation")
            .message(ex.getMessage())
            .path(request.getDescription(false))
            .build();

        return ResponseEntity.badRequest().body(response);
    }

    @ExceptionHandler(ResourceNotFoundException.class)
    @ResponseStatus(HttpStatus.NOT_FOUND)
    public ResponseEntity<ErrorResponse> handleResourceNotFound(
            ResourceNotFoundException ex, WebRequest request) {
        log.error("Resource not found", ex);

        ErrorResponse response = ErrorResponse.builder()
            .timestamp(LocalDateTime.now())
            .status(HttpStatus.NOT_FOUND.value())
            .error("Not Found")
            .message(ex.getMessage())
            .path(request.getDescription(false))
            .build();

        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(response);
    }

    @ExceptionHandler(Exception.class)
    @ResponseStatus(HttpStatus.INTERNAL_SERVER_ERROR)
    public ResponseEntity<ErrorResponse> handleGlobalException(
            Exception ex, WebRequest request) {
        log.error("Internal server error", ex);

        ErrorResponse response = ErrorResponse.builder()
            .timestamp(LocalDateTime.now())
            .status(HttpStatus.INTERNAL_SERVER_ERROR.value())
            .error("Internal Server Error")
            .message("An unexpected error occurred")
            .path(request.getDescription(false))
            .build();

        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(response);
    }
}
`;

  await writeFile(path.join(outputDir, 'GlobalExceptionHandler.java'), content);

  // Generate ErrorResponse DTO
  const errorResponseContent = `package ${packageName}.exception;

import lombok.Builder;
import lombok.Data;
import java.time.LocalDateTime;
import java.util.Map;

@Data
@Builder
public class ErrorResponse {
    private LocalDateTime timestamp;
    private int status;
    private String error;
    private String message;
    private String path;
    private Map<String, String> errors;
}
`;

  await writeFile(path.join(outputDir, 'ErrorResponse.java'), errorResponseContent);

  // Generate ResourceNotFoundException
  const notFoundContent = `package ${packageName}.exception;

public class ResourceNotFoundException extends RuntimeException {
    public ResourceNotFoundException(String message) {
        super(message);
    }
}
`;

  await writeFile(path.join(outputDir, 'ResourceNotFoundException.java'), notFoundContent);
}

async function generateConfiguration(outputDir: string, packageName: string): Promise<void> {
  await ensureDir(outputDir);

  const content = `package ${packageName}.config;

import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.info.Contact;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/**
 * Application configuration
 */
@Configuration
public class ApplicationConfig {

    @Bean
    public OpenAPI customOpenAPI() {
        return new OpenAPI()
            .info(new Info()
                .title("Generated API")
                .version("1.0.0")
                .description("API generated from OpenAPI specification")
                .contact(new Contact()
                    .name("API Support")
                    .email("support@example.com")));
    }

    @Bean
    public WebMvcConfigurer corsConfigurer() {
        return new WebMvcConfigurer() {
            @Override
            public void addCorsMappings(CorsRegistry registry) {
                registry.addMapping("/**")
                    .allowedOrigins("*")
                    .allowedMethods("GET", "POST", "PUT", "DELETE", "PATCH")
                    .allowedHeaders("*");
            }
        };
    }
}
`;

  await writeFile(path.join(outputDir, 'ApplicationConfig.java'), content);
}

async function generateLoggingAspect(outputDir: string, packageName: string): Promise<void> {
  await ensureDir(outputDir);

  const content = `package ${packageName}.aspect;

import lombok.extern.slf4j.Slf4j;
import org.aspectj.lang.ProceedingJoinPoint;
import org.aspectj.lang.annotation.Around;
import org.aspectj.lang.annotation.Aspect;
import org.springframework.stereotype.Component;
import java.util.Arrays;

/**
 * Logging aspect for automatic method logging
 */
@Slf4j
@Aspect
@Component
public class LoggingAspect {

    @Around("execution(* ${packageName}.controller..*(..))")
    public Object logControllerMethods(ProceedingJoinPoint joinPoint) throws Throwable {
        String methodName = joinPoint.getSignature().toShortString();
        log.debug("Entering: {} with args: {}", methodName, Arrays.toString(joinPoint.getArgs()));

        long start = System.currentTimeMillis();

        try {
            Object result = joinPoint.proceed();
            long duration = System.currentTimeMillis() - start;
            log.debug("Exiting: {} - Duration: {}ms", methodName, duration);
            return result;
        } catch (Exception ex) {
            log.error("Exception in: {} - {}", methodName, ex.getMessage());
            throw ex;
        }
    }

    @Around("execution(* ${packageName}.service..*(..))")
    public Object logServiceMethods(ProceedingJoinPoint joinPoint) throws Throwable {
        String methodName = joinPoint.getSignature().toShortString();
        long start = System.currentTimeMillis();

        try {
            Object result = joinPoint.proceed();
            long duration = System.currentTimeMillis() - start;
            log.info("Service method: {} completed in {}ms", methodName, duration);
            return result;
        } catch (Exception ex) {
            log.error("Service method: {} failed - {}", methodName, ex.getMessage());
            throw ex;
        }
    }
}
`;

  await writeFile(path.join(outputDir, 'LoggingAspect.java'), content);
}

async function generateMonitoringConfig(outputDir: string, packageName: string): Promise<void> {
  const content = `package ${packageName}.config;

import io.micrometer.core.aop.TimedAspect;
import io.micrometer.core.instrument.MeterRegistry;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Monitoring configuration with Micrometer
 */
@Configuration
public class MonitoringConfig {

    @Bean
    public TimedAspect timedAspect(MeterRegistry registry) {
        return new TimedAspect(registry);
    }
}
`;

  await writeFile(path.join(outputDir, 'MonitoringConfig.java'), content);
}

// Helper functions

function groupEndpointsByTag(endpoints: Endpoint[]): Record<string, Endpoint[]> {
  const grouped: Record<string, Endpoint[]> = {};

  for (const endpoint of endpoints) {
    const tag = endpoint.tags?.[0] || 'default';
    if (!grouped[tag]) {
      grouped[tag] = [];
    }
    grouped[tag].push(endpoint);
  }

  return grouped;
}

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function toCamelCase(str: string): string {
  return str
    .replace(/[^a-zA-Z0-9]+(.)/g, (_, chr) => chr.toUpperCase())
    .replace(/^./, (chr) => chr.toLowerCase());
}

function mapOpenAPITypeToJava(schema: any): string {
  if (schema.type === 'array') {
    const itemType = mapOpenAPITypeToJava(schema.items);
    return `List<${itemType}>`;
  }

  const typeMap: Record<string, string> = {
    string: schema.format === 'date-time' ? 'LocalDateTime' : 'String',
    number: 'Double',
    integer: schema.format === 'int64' ? 'Long' : 'Integer',
    boolean: 'Boolean',
    object: 'Object',
  };

  return typeMap[schema.type] || 'Object';
}

function mapTypeToJava(type: string): string {
  const typeMap: Record<string, string> = {
    string: 'String',
    number: 'Double',
    integer: 'Long',
    boolean: 'Boolean',
  };

  return typeMap[type] || 'String';
}
