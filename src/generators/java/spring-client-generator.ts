/**
 * Spring Boot WebClient-based Client SDK Generator
 * Generates type-safe REST client for microservice communication
 */

import { ParsedAPI, Endpoint } from '../../types';
import { writeFile, ensureDir } from 'fs-extra';
import path from 'path';
import { logger } from '../../utils/logger';
import { trackPerformance } from '../../utils/monitoring';

export interface SpringClientOptions {
  packageName: string;
  groupId: string;
  artifactId: string;
  version: string;
  javaVersion: number;
  springBootVersion: string;
  useWebClient?: boolean; // true = WebClient (reactive), false = RestTemplate
}

export async function generateSpringClient(
  api: ParsedAPI,
  outputDir: string,
  options: SpringClientOptions
): Promise<void> {
  return trackPerformance('Spring Client Generation', async () => {
    logger.info('Generating Spring Boot Client SDK', {
      packageName: options.packageName,
      reactive: options.useWebClient !== false
    });

    const basePackage = options.packageName.replace(/\./g, '/');
    const srcDir = path.join(outputDir, 'src/main/java', basePackage);
    const resourcesDir = path.join(outputDir, 'src/main/resources');
    const testDir = path.join(outputDir, 'src/test/java', basePackage);

    // Create directory structure
    await ensureDir(srcDir);
    await ensureDir(resourcesDir);
    await ensureDir(testDir);

    // Generate files
    await generateClientPomXml(outputDir, options);
    await generateClientApplicationProperties(resourcesDir);
    await generateClientDTOs(api, path.join(srcDir, 'dto'), options.packageName);
    await generateClientInterface(api, path.join(srcDir, 'client'), options.packageName, options.useWebClient !== false);
    await generateClientConfig(path.join(srcDir, 'config'), options.packageName, options.useWebClient !== false);
    await generateClientExceptionHandler(path.join(srcDir, 'exception'), options.packageName);

    logger.info('Spring Boot Client SDK generated successfully');
  });
}

async function generateClientPomXml(outputDir: string, options: SpringClientOptions): Promise<void> {
  const useWebClient = options.useWebClient !== false;

  const content = `<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="http://maven.apache.org/POM/4.0.0
         http://maven.apache.org/xsd/maven-4.0.0.xsd">
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
    <description>Spring Boot REST Client SDK</description>

    <properties>
        <java.version>${options.javaVersion}</java.version>
        <maven.compiler.source>${options.javaVersion}</maven.compiler.source>
        <maven.compiler.target>${options.javaVersion}</maven.compiler.target>
    </properties>

    <dependencies>
        ${useWebClient ? `
        <!-- Spring WebFlux for WebClient -->
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-webflux</artifactId>
        </dependency>
        ` : `
        <!-- Spring Web for RestTemplate -->
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-web</artifactId>
        </dependency>
        `}

        <!-- Validation -->
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-validation</artifactId>
        </dependency>

        <!-- Jackson for JSON -->
        <dependency>
            <groupId>com.fasterxml.jackson.core</groupId>
            <artifactId>jackson-databind</artifactId>
        </dependency>
        <dependency>
            <groupId>com.fasterxml.jackson.datatype</groupId>
            <artifactId>jackson-datatype-jsr310</artifactId>
        </dependency>

        <!-- Lombok -->
        <dependency>
            <groupId>org.projectlombok</groupId>
            <artifactId>lombok</artifactId>
            <optional>true</optional>
        </dependency>

        <!-- Resilience4j for circuit breaker -->
        <dependency>
            <groupId>io.github.resilience4j</groupId>
            <artifactId>resilience4j-spring-boot3</artifactId>
            <version>2.1.0</version>
        </dependency>

        <!-- Testing -->
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-test</artifactId>
            <scope>test</scope>
        </dependency>
        ${useWebClient ? `
        <dependency>
            <groupId>io.projectreactor</groupId>
            <artifactId>reactor-test</artifactId>
            <scope>test</scope>
        </dependency>
        ` : ''}
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

async function generateClientApplicationProperties(resourcesDir: string): Promise<void> {
  const content = `# REST Client Configuration
api.client.base-url=http://localhost:8080
api.client.connect-timeout=5000
api.client.read-timeout=10000

# Resilience4j Circuit Breaker
resilience4j.circuitbreaker.instances.apiClient.registerHealthIndicator=true
resilience4j.circuitbreaker.instances.apiClient.slidingWindowSize=10
resilience4j.circuitbreaker.instances.apiClient.minimumNumberOfCalls=5
resilience4j.circuitbreaker.instances.apiClient.permittedNumberOfCallsInHalfOpenState=3
resilience4j.circuitbreaker.instances.apiClient.automaticTransitionFromOpenToHalfOpenEnabled=true
resilience4j.circuitbreaker.instances.apiClient.waitDurationInOpenState=5s
resilience4j.circuitbreaker.instances.apiClient.failureRateThreshold=50

# Retry
resilience4j.retry.instances.apiClient.maxAttempts=3
resilience4j.retry.instances.apiClient.waitDuration=1000

# Logging
logging.level.root=INFO
logging.level.${'${api.client.package}'}=DEBUG
`;

  await writeFile(path.join(resourcesDir, 'application.properties'), content);
}

async function generateClientDTOs(
  api: ParsedAPI,
  outputDir: string,
  packageName: string
): Promise<void> {
  await ensureDir(outputDir);

  for (const schema of api.schemas) {
    const className = capitalize(schema.name);
    const content = generateClientDTOClass(className, schema.schema, packageName);
    await writeFile(path.join(outputDir, `${className}.java`), content);
  }
}

function generateClientDTOClass(className: string, schema: any, packageName: string): string {
  const properties = schema.properties || {};
  const required = schema.required || [];

  let content = `package ${packageName}.dto;

import lombok.Data;
import lombok.Builder;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import jakarta.validation.constraints.*;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
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
@JsonIgnoreProperties(ignoreUnknown = true)
public class ${className} {
`;

  for (const [propName, propSchema] of Object.entries(properties)) {
    const prop = propSchema as any;
    const javaType = mapOpenAPITypeToJava(prop);
    const isRequired = required.includes(propName);

    if (isRequired) {
      content += `    @NotNull(message = "${propName} is required")\n`;
    }
    if (prop.minLength) {
      content += `    @Size(min = ${prop.minLength})\n`;
    }
    if (prop.maxLength) {
      content += `    @Size(max = ${prop.maxLength})\n`;
    }

    content += `    @JsonProperty("${propName}")\n`;
    content += `    private ${javaType} ${toCamelCase(propName)};\n\n`;
  }

  content += `}\n`;

  return content;
}

async function generateClientInterface(
  api: ParsedAPI,
  outputDir: string,
  packageName: string,
  useWebClient: boolean
): Promise<void> {
  await ensureDir(outputDir);

  const grouped = groupEndpointsByTag(api.endpoints);

  for (const [tag, endpoints] of Object.entries(grouped)) {
    const className = capitalize(tag) + 'Client';
    const content = generateClientClass(className, endpoints, packageName, useWebClient);
    await writeFile(path.join(outputDir, `${className}.java`), content);
  }
}

function generateClientClass(
  className: string,
  endpoints: Endpoint[],
  packageName: string,
  useWebClient: boolean
): string {
  const returnType = useWebClient ? 'Mono' : '';
  const imports = useWebClient ?
    'import reactor.core.publisher.Mono;\nimport reactor.core.publisher.Flux;' : '';

  let content = `package ${packageName}.client;

import ${packageName}.dto.*;
import ${packageName}.exception.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
${useWebClient ? `import org.springframework.web.reactive.function.client.WebClient;` : `import org.springframework.web.client.RestTemplate;`}
import org.springframework.web.util.UriComponentsBuilder;
import io.github.resilience4j.circuitbreaker.annotation.CircuitBreaker;
import io.github.resilience4j.retry.annotation.Retry;
${imports}
import java.util.List;
import java.util.Map;

/**
 * REST client for ${className.replace('Client', '')} operations
 * Generated from OpenAPI specification
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class ${className} {

    private final ${useWebClient ? 'WebClient' : 'RestTemplate'} ${useWebClient ? 'webClient' : 'restTemplate'};

`;

  for (const endpoint of endpoints) {
    content += generateClientMethod(endpoint, useWebClient);
  }

  content += `}\n`;

  return content;
}

function generateClientMethod(endpoint: Endpoint, useWebClient: boolean): string {
  const methodName = toCamelCase(endpoint.operationId || endpoint.path);
  const httpMethod = endpoint.method.toUpperCase();
  const pathParams = endpoint.parameters?.filter(p => p.in === 'path') || [];
  const queryParams = endpoint.parameters?.filter(p => p.in === 'query') || [];
  const hasBody = ['POST', 'PUT', 'PATCH'].includes(httpMethod);

  const params: string[] = [];

  pathParams.forEach(param => {
    params.push(`${mapTypeToJava(param.type)} ${toCamelCase(param.name)}`);
  });

  queryParams.forEach(param => {
    params.push(`${mapTypeToJava(param.type)} ${toCamelCase(param.name)}`);
  });

  if (hasBody) {
    params.push(`Object requestBody`);
  }

  const returnType = useWebClient ? 'Mono<Object>' : 'Object';

  let method = `    /**
     * ${endpoint.summary || endpoint.operationId}
     * ${endpoint.description || ''}
     */
    @CircuitBreaker(name = "apiClient", fallbackMethod = "${methodName}Fallback")
    @Retry(name = "apiClient")
    public ${returnType} ${methodName}(${params.join(', ')}) {
        log.debug("Calling ${methodName}");

        String path = "${endpoint.path}";
`;

  // Replace path parameters
  pathParams.forEach(param => {
    const camelName = toCamelCase(param.name);
    method += `        path = path.replace("{${param.name}}", String.valueOf(${camelName}));\n`;
  });

  // Build query parameters
  if (queryParams.length > 0) {
    method += `\n        UriComponentsBuilder builder = UriComponentsBuilder.fromPath(path);\n`;
    queryParams.forEach(param => {
      const camelName = toCamelCase(param.name);
      method += `        if (${camelName} != null) {\n`;
      method += `            builder.queryParam("${param.name}", ${camelName});\n`;
      method += `        }\n`;
    });
    method += `        path = builder.build().toUriString();\n`;
  }

  if (useWebClient) {
    // WebClient implementation
    method += `\n        return webClient.${httpMethod.toLowerCase()}()\n`;
    method += `            .uri(path)\n`;
    if (hasBody) {
      method += `            .bodyValue(requestBody)\n`;
    }
    method += `            .retrieve()\n`;
    method += `            .bodyToMono(Object.class)\n`;
    method += `            .doOnSuccess(response -> log.debug("${methodName} completed successfully"))\n`;
    method += `            .doOnError(error -> log.error("${methodName} failed", error));\n`;
  } else {
    // RestTemplate implementation
    method += `\n        try {\n`;
    if (hasBody) {
      method += `            return restTemplate.${httpMethod === 'GET' ? 'getForObject' : 'postForObject'}(path, ${hasBody ? 'requestBody' : 'null'}, Object.class);\n`;
    } else {
      method += `            return restTemplate.getForObject(path, Object.class);\n`;
    }
    method += `        } catch (Exception e) {\n`;
    method += `            log.error("${methodName} failed", e);\n`;
    method += `            throw new ApiClientException("Failed to call ${methodName}", e);\n`;
    method += `        }\n`;
  }

  method += `    }\n\n`;

  // Fallback method
  method += `    /**\n`;
  method += `     * Fallback method for ${methodName}\n`;
  method += `     */\n`;
  method += `    private ${returnType} ${methodName}Fallback(${params.join(', ')}, Exception ex) {\n`;
  method += `        log.warn("Fallback triggered for ${methodName}: {}", ex.getMessage());\n`;
  if (useWebClient) {
    method += `        return Mono.error(new ApiClientException("Service unavailable", ex));\n`;
  } else {
    method += `        throw new ApiClientException("Service unavailable", ex);\n`;
  }
  method += `    }\n\n`;

  return method;
}

async function generateClientConfig(
  outputDir: string,
  packageName: string,
  useWebClient: boolean
): Promise<void> {
  await ensureDir(outputDir);

  const content = `package ${packageName}.config;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
${useWebClient ? `
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.reactive.function.client.ExchangeFilterFunction;
import reactor.core.publisher.Mono;
import java.time.Duration;
` : `
import org.springframework.web.client.RestTemplate;
import org.springframework.boot.web.client.RestTemplateBuilder;
import java.time.Duration;
`}

/**
 * REST Client configuration
 */
@Slf4j
@Configuration
public class ClientConfig {

    @Value("\${api.client.base-url}")
    private String baseUrl;

    @Value("\${api.client.connect-timeout:5000}")
    private int connectTimeout;

    @Value("\${api.client.read-timeout:10000}")
    private int readTimeout;

${useWebClient ? `
    @Bean
    public WebClient webClient(WebClient.Builder builder) {
        return builder
            .baseUrl(baseUrl)
            .filter(logRequest())
            .filter(logResponse())
            .build();
    }

    private ExchangeFilterFunction logRequest() {
        return ExchangeFilterFunction.ofRequestProcessor(request -> {
            log.debug("Request: {} {}", request.method(), request.url());
            return Mono.just(request);
        });
    }

    private ExchangeFilterFunction logResponse() {
        return ExchangeFilterFunction.ofResponseProcessor(response -> {
            log.debug("Response status: {}", response.statusCode());
            return Mono.just(response);
        });
    }
` : `
    @Bean
    public RestTemplate restTemplate(RestTemplateBuilder builder) {
        return builder
            .rootUri(baseUrl)
            .setConnectTimeout(Duration.ofMillis(connectTimeout))
            .setReadTimeout(Duration.ofMillis(readTimeout))
            .build();
    }
`}
}
`;

  await writeFile(path.join(outputDir, 'ClientConfig.java'), content);
}

async function generateClientExceptionHandler(
  outputDir: string,
  packageName: string
): Promise<void> {
  await ensureDir(outputDir);

  const exceptionContent = `package ${packageName}.exception;

/**
 * Custom exception for API client errors
 */
public class ApiClientException extends RuntimeException {

    public ApiClientException(String message) {
        super(message);
    }

    public ApiClientException(String message, Throwable cause) {
        super(message, cause);
    }
}
`;

  await writeFile(path.join(outputDir, 'ApiClientException.java'), exceptionContent);
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
