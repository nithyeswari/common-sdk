/**
 * Quarkus REST API Generator
 * Generates modern Quarkus 3.x JAX-RS resources with reactive features
 */

import { ParsedAPI, Endpoint } from '../../types';
import { writeFile, ensureDir } from 'fs-extra';
import path from 'path';
import { logger } from '../../utils/logger';
import { trackPerformance } from '../../utils/monitoring';

export interface QuarkusOptions {
  packageName: string;
  groupId: string;
  artifactId: string;
  version: string;
  javaVersion: number;
  quarkusVersion: string;
  reactive: boolean;
}

export async function generateQuarkus(
  api: ParsedAPI,
  outputDir: string,
  options: QuarkusOptions
): Promise<void> {
  return trackPerformance('Quarkus Generation', async () => {
    logger.info('Generating Quarkus project', { packageName: options.packageName, reactive: options.reactive });

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
    await generateDTOs(api, path.join(srcDir, 'model'), options.packageName);
    await generateResources(api, path.join(srcDir, 'resource'), options.packageName, options.reactive);
    await generateServices(api, path.join(srcDir, 'service'), options.packageName, options.reactive);
    await generateExceptionMappers(path.join(srcDir, 'exception'), options.packageName);
    await generateHealthChecks(path.join(srcDir, 'health'), options.packageName);
    await generateMonitoringConfig(path.join(srcDir, 'config'), options.packageName);
    await generateLoggingInterceptor(path.join(srcDir, 'interceptor'), options.packageName);

    logger.info('Quarkus project generated successfully');
  });
}

async function generatePomXml(outputDir: string, options: QuarkusOptions): Promise<void> {
  const content = `<?xml version="1.0"?>
<project xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 https://maven.apache.org/xsd/maven-4.0.0.xsd"
         xmlns="http://maven.apache.org/POM/4.0.0"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
    <modelVersion>4.0.0</modelVersion>

    <groupId>${options.groupId}</groupId>
    <artifactId>${options.artifactId}</artifactId>
    <version>${options.version}</version>

    <properties>
        <compiler-plugin.version>3.11.0</compiler-plugin.version>
        <maven.compiler.release>${options.javaVersion}</maven.compiler.release>
        <project.build.sourceEncoding>UTF-8</project.build.sourceEncoding>
        <project.reporting.outputEncoding>UTF-8</project.reporting.outputEncoding>
        <quarkus.platform.artifact-id>quarkus-bom</quarkus.platform.artifact-id>
        <quarkus.platform.group-id>io.quarkus.platform</quarkus.platform.group-id>
        <quarkus.platform.version>${options.quarkusVersion}</quarkus.platform.version>
        <skipITs>true</skipITs>
        <surefire-plugin.version>3.0.0</surefire-plugin.version>
    </properties>

    <dependencyManagement>
        <dependencies>
            <dependency>
                <groupId>\${quarkus.platform.group-id}</groupId>
                <artifactId>\${quarkus.platform.artifact-id}</artifactId>
                <version>\${quarkus.platform.version}</version>
                <type>pom</type>
                <scope>import</scope>
            </dependency>
        </dependencies>
    </dependencyManagement>

    <dependencies>
        <!-- Quarkus REST -->
        ${options.reactive ? `
        <dependency>
            <groupId>io.quarkus</groupId>
            <artifactId>quarkus-rest</artifactId>
        </dependency>
        <dependency>
            <groupId>io.quarkus</groupId>
            <artifactId>quarkus-rest-jackson</artifactId>
        </dependency>
        <dependency>
            <groupId>io.quarkus</groupId>
            <artifactId>quarkus-rest-client</artifactId>
        </dependency>
        <dependency>
            <groupId>io.smallrye.reactive</groupId>
            <artifactId>mutiny</artifactId>
        </dependency>
        ` : `
        <dependency>
            <groupId>io.quarkus</groupId>
            <artifactId>quarkus-resteasy-reactive-jackson</artifactId>
        </dependency>
        `}

        <!-- Bean Validation -->
        <dependency>
            <groupId>io.quarkus</groupId>
            <artifactId>quarkus-hibernate-validator</artifactId>
        </dependency>

        <!-- OpenAPI/Swagger -->
        <dependency>
            <groupId>io.quarkus</groupId>
            <artifactId>quarkus-smallrye-openapi</artifactId>
        </dependency>

        <!-- Health Checks -->
        <dependency>
            <groupId>io.quarkus</groupId>
            <artifactId>quarkus-smallrye-health</artifactId>
        </dependency>

        <!-- Metrics -->
        <dependency>
            <groupId>io.quarkus</groupId>
            <artifactId>quarkus-micrometer-registry-prometheus</artifactId>
        </dependency>

        <!-- Logging -->
        <dependency>
            <groupId>io.quarkus</groupId>
            <artifactId>quarkus-logging-json</artifactId>
        </dependency>

        <!-- Lombok -->
        <dependency>
            <groupId>org.projectlombok</groupId>
            <artifactId>lombok</artifactId>
            <version>1.18.30</version>
            <scope>provided</scope>
        </dependency>

        <!-- Testing -->
        <dependency>
            <groupId>io.quarkus</groupId>
            <artifactId>quarkus-junit5</artifactId>
            <scope>test</scope>
        </dependency>
        <dependency>
            <groupId>io.rest-assured</groupId>
            <artifactId>rest-assured</artifactId>
            <scope>test</scope>
        </dependency>
    </dependencies>

    <build>
        <plugins>
            <plugin>
                <groupId>\${quarkus.platform.group-id}</groupId>
                <artifactId>quarkus-maven-plugin</artifactId>
                <version>\${quarkus.platform.version}</version>
                <extensions>true</extensions>
                <executions>
                    <execution>
                        <goals>
                            <goal>build</goal>
                            <goal>generate-code</goal>
                            <goal>generate-code-tests</goal>
                        </goals>
                    </execution>
                </executions>
            </plugin>
            <plugin>
                <artifactId>maven-compiler-plugin</artifactId>
                <version>\${compiler-plugin.version}</version>
                <configuration>
                    <compilerArgs>
                        <arg>-parameters</arg>
                    </compilerArgs>
                </configuration>
            </plugin>
            <plugin>
                <artifactId>maven-surefire-plugin</artifactId>
                <version>\${surefire-plugin.version}</version>
                <configuration>
                    <systemPropertyVariables>
                        <java.util.logging.manager>org.jboss.logmanager.LogManager</java.util.logging.manager>
                        <maven.home>\${maven.home}</maven.home>
                    </systemPropertyVariables>
                </configuration>
            </plugin>
        </plugins>
    </build>
</project>
`;

  await writeFile(path.join(outputDir, 'pom.xml'), content);
}

async function generateApplicationProperties(resourcesDir: string): Promise<void> {
  const content = `# HTTP Configuration
quarkus.http.port=8080
quarkus.http.cors=true
quarkus.http.cors.origins=*
quarkus.http.cors.methods=GET,POST,PUT,DELETE,PATCH
quarkus.http.cors.headers=*

# Application Configuration
quarkus.application.name=api-service

# Logging Configuration
quarkus.log.level=INFO
quarkus.log.console.enable=true
quarkus.log.console.format=%d{yyyy-MM-dd HH:mm:ss,SSS} %-5p [%c{3.}] (%t) %s%e%n
quarkus.log.console.json=false

# Enable JSON logging for production
%prod.quarkus.log.console.json=true
%prod.quarkus.log.console.json.pretty-print=false

# OpenAPI/Swagger Configuration
quarkus.smallrye-openapi.path=/openapi
quarkus.swagger-ui.always-include=true
quarkus.swagger-ui.path=/swagger-ui

# Health Checks
quarkus.smallrye-health.ui.always-include=true

# Metrics
quarkus.micrometer.enabled=true
quarkus.micrometer.binder.http-client.enabled=true
quarkus.micrometer.binder.http-server.enabled=true
quarkus.micrometer.export.prometheus.enabled=true

# Dev Mode Configuration
%dev.quarkus.log.level=DEBUG
%dev.quarkus.http.cors=true

# Native Build Configuration
quarkus.native.additional-build-args=--initialize-at-run-time=org.slf4j.LoggerFactory
`;

  await writeFile(path.join(resourcesDir, 'application.properties'), content);
}

async function generateDTOs(
  api: ParsedAPI,
  outputDir: string,
  packageName: string
): Promise<void> {
  await ensureDir(outputDir);

  for (const schema of api.schemas) {
    const className = capitalize(schema.name);
    const content = generateDTOClass(className, schema.schema, packageName);
    await writeFile(path.join(outputDir, `${className}.java`), content);
  }
}

function generateDTOClass(className: string, schema: any, packageName: string): string {
  const properties = schema.properties || {};
  const required = schema.required || [];

  let content = `package ${packageName}.model;

import lombok.Data;
import lombok.Builder;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import jakarta.validation.constraints.*;
import com.fasterxml.jackson.annotation.JsonProperty;
import java.time.LocalDateTime;
import java.util.List;
import org.eclipse.microprofile.openapi.annotations.media.Schema;

/**
 * ${schema.description || className + ' model'}
 * Generated from OpenAPI specification
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Schema(description = "${schema.description || className}")
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
    if (prop.pattern) {
      content += `    @Pattern(regexp = "${prop.pattern}")\n`;
    }
    if (prop.format === 'email') {
      content += `    @Email\n`;
    }

    content += `    @JsonProperty("${propName}")\n`;
    content += `    @Schema(description = "${prop.description || propName}")\n`;
    content += `    private ${javaType} ${toCamelCase(propName)};\n\n`;
  }

  content += `}\n`;

  return content;
}

async function generateResources(
  api: ParsedAPI,
  outputDir: string,
  packageName: string,
  reactive: boolean
): Promise<void> {
  await ensureDir(outputDir);

  const grouped = groupEndpointsByTag(api.endpoints);

  for (const [tag, endpoints] of Object.entries(grouped)) {
    const className = capitalize(tag) + 'Resource';
    const content = generateResourceClass(className, endpoints, packageName, reactive);
    await writeFile(path.join(outputDir, `${className}.java`), content);
  }
}

function generateResourceClass(
  className: string,
  endpoints: Endpoint[],
  packageName: string,
  reactive: boolean
): string {
  const resourcePath = '/' + className.replace('Resource', '').toLowerCase();
  const returnType = reactive ? 'Uni' : '';

  let content = `package ${packageName}.resource;

import ${packageName}.model.*;
import ${packageName}.service.*;
import ${packageName}.exception.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import jakarta.inject.Inject;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import org.eclipse.microprofile.openapi.annotations.Operation;
import org.eclipse.microprofile.openapi.annotations.tags.Tag;
import org.eclipse.microprofile.openapi.annotations.responses.APIResponse;
import org.eclipse.microprofile.openapi.annotations.responses.APIResponses;
${reactive ? 'import io.smallrye.mutiny.Uni;' : ''}

/**
 * JAX-RS resource for ${className.replace('Resource', '')} operations
 * Generated from OpenAPI specification
 */
@Slf4j
@Path("${resourcePath}")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Tag(name = "${className.replace('Resource', '')}", description = "${className.replace('Resource', '')} API")
public class ${className} {

    @Inject
    ${className.replace('Resource', '')}Service service;

`;

  for (const endpoint of endpoints) {
    content += generateResourceMethod(endpoint, reactive);
  }

  content += `}\n`;

  return content;
}

function generateResourceMethod(endpoint: Endpoint, reactive: boolean): string {
  const methodName = toCamelCase(endpoint.operationId || endpoint.path);
  const httpMethod = endpoint.method.toUpperCase();
  const pathParams = endpoint.parameters.filter(p => p.in === 'path');
  const queryParams = endpoint.parameters.filter(p => p.in === 'query');
  const returnType = reactive ? 'Uni<Response>' : 'Response';

  let method = `    /**
     * ${endpoint.summary || endpoint.operationId}
     * ${endpoint.description || ''}
     */
    @Operation(summary = "${endpoint.summary || endpoint.operationId}")
    @APIResponses(value = {
        @APIResponse(responseCode = "200", description = "Successful operation"),
        @APIResponse(responseCode = "400", description = "Invalid input"),
        @APIResponse(responseCode = "500", description = "Internal server error")
    })
    @${httpMethod}
    @Path("${endpoint.path.replace(/{/g, '{').replace(/}/g, '}')}")
    public ${returnType} ${methodName}(
`;

  const params: string[] = [];

  pathParams.forEach(param => {
    params.push(`            @PathParam("${param.name}") ${mapTypeToJava(param.type)} ${toCamelCase(param.name)}`);
  });

  queryParams.forEach(param => {
    params.push(`            @QueryParam("${param.name}") ${mapTypeToJava(param.type)} ${toCamelCase(param.name)}`);
  });

  if (endpoint.requestBody && ['POST', 'PUT', 'PATCH'].includes(httpMethod)) {
    params.push(`            @Valid Object requestBody`);
  }

  method += params.join(',\n') + '\n    ) {\n';
  method += `        log.debug("${methodName} called");\n`;

  if (reactive) {
    method += `        return service.${methodName}(${params.map(p => p.split(' ').pop()).join(', ')})\n`;
    method += `            .onItem().transform(result -> Response.ok(result).build())\n`;
    method += `            .onFailure().recoverWithItem(Response.serverError().build());\n`;
  } else {
    method += `        var result = service.${methodName}(${params.map(p => p.split(' ').pop()).join(', ')});\n`;
    method += `        return Response.ok(result).build();\n`;
  }

  method += `    }\n\n`;

  return method;
}

async function generateServices(
  api: ParsedAPI,
  outputDir: string,
  packageName: string,
  reactive: boolean
): Promise<void> {
  await ensureDir(outputDir);

  const grouped = groupEndpointsByTag(api.endpoints);

  for (const [tag, endpoints] of Object.entries(grouped)) {
    const className = capitalize(tag) + 'Service';
    const content = generateServiceClass(className, endpoints, packageName, reactive);
    await writeFile(path.join(outputDir, `${className}.java`), content);
  }
}

function generateServiceClass(
  className: string,
  endpoints: Endpoint[],
  packageName: string,
  reactive: boolean
): string {
  return `package ${packageName}.service;

import ${packageName}.model.*;
import ${packageName}.exception.*;
import lombok.extern.slf4j.Slf4j;
import jakarta.enterprise.context.ApplicationScoped;
${reactive ? 'import io.smallrye.mutiny.Uni;' : ''}

/**
 * Service layer for ${className.replace('Service', '')} operations
 * Generated from OpenAPI specification
 */
@Slf4j
@ApplicationScoped
public class ${className} {

    ${endpoints.map(e => generateServiceMethod(e, reactive)).join('\n')}
}
`;
}

function generateServiceMethod(endpoint: Endpoint, reactive: boolean): string {
  const methodName = toCamelCase(endpoint.operationId || endpoint.path);
  const returnType = reactive ? 'Uni<Object>' : 'Object';

  return `    /**
     * ${endpoint.summary || endpoint.operationId}
     */
    public ${returnType} ${methodName}(/* Add parameters */) {
        log.info("Executing ${methodName}");
        // TODO: Implement business logic
        ${reactive ?
          'return Uni.createFrom().failure(new UnsupportedOperationException("' + methodName + ' not implemented"));' :
          'throw new UnsupportedOperationException("' + methodName + ' not implemented");'
        }
    }
`;
}

async function generateExceptionMappers(outputDir: string, packageName: string): Promise<void> {
  await ensureDir(outputDir);

  const content = `package ${packageName}.exception;

import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.ext.ExceptionMapper;
import jakarta.ws.rs.ext.Provider;
import lombok.extern.slf4j.Slf4j;
import java.time.LocalDateTime;

/**
 * Global exception mapper
 * Maps exceptions to HTTP responses
 */
@Slf4j
@Provider
public class GlobalExceptionMapper implements ExceptionMapper<Exception> {

    @Override
    public Response toResponse(Exception exception) {
        log.error("Exception occurred", exception);

        ErrorResponse errorResponse = ErrorResponse.builder()
            .timestamp(LocalDateTime.now())
            .status(Response.Status.INTERNAL_SERVER_ERROR.getStatusCode())
            .error("Internal Server Error")
            .message(exception.getMessage())
            .build();

        return Response.status(Response.Status.INTERNAL_SERVER_ERROR)
            .entity(errorResponse)
            .build();
    }
}
`;

  await writeFile(path.join(outputDir, 'GlobalExceptionMapper.java'), content);

  // Generate ErrorResponse
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
    private Map<String, String> errors;
}
`;

  await writeFile(path.join(outputDir, 'ErrorResponse.java'), errorResponseContent);
}

async function generateHealthChecks(outputDir: string, packageName: string): Promise<void> {
  await ensureDir(outputDir);

  const content = `package ${packageName}.health;

import org.eclipse.microprofile.health.HealthCheck;
import org.eclipse.microprofile.health.HealthCheckResponse;
import org.eclipse.microprofile.health.Liveness;
import org.eclipse.microprofile.health.Readiness;
import jakarta.enterprise.context.ApplicationScoped;

/**
 * Health check endpoints
 */
@Liveness
@ApplicationScoped
public class LivenessCheck implements HealthCheck {

    @Override
    public HealthCheckResponse call() {
        return HealthCheckResponse.up("Application is alive");
    }
}

@Readiness
@ApplicationScoped
class ReadinessCheck implements HealthCheck {

    @Override
    public HealthCheckResponse call() {
        // Add checks for dependencies (database, external services, etc.)
        return HealthCheckResponse.up("Application is ready");
    }
}
`;

  await writeFile(path.join(outputDir, 'HealthChecks.java'), content);
}

async function generateMonitoringConfig(outputDir: string, packageName: string): Promise<void> {
  const content = `package ${packageName}.config;

import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.Timer;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Produces;

/**
 * Monitoring configuration
 */
@ApplicationScoped
public class MonitoringConfig {

    @Produces
    public Timer requestTimer(MeterRegistry registry) {
        return Timer.builder("http.server.requests")
            .description("HTTP request duration")
            .register(registry);
    }
}
`;

  await writeFile(path.join(outputDir, 'MonitoringConfig.java'), content);
}

async function generateLoggingInterceptor(outputDir: string, packageName: string): Promise<void> {
  await ensureDir(outputDir);

  const content = `package ${packageName}.interceptor;

import lombok.extern.slf4j.Slf4j;
import jakarta.interceptor.AroundInvoke;
import jakarta.interceptor.Interceptor;
import jakarta.interceptor.InterceptorBinding;
import jakarta.interceptor.InvocationContext;
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;
import java.util.Arrays;

/**
 * Logging interceptor annotation
 */
@InterceptorBinding
@Target({ElementType.TYPE, ElementType.METHOD})
@Retention(RetentionPolicy.RUNTIME)
@interface Logged {}

/**
 * Logging interceptor
 * Automatically logs method invocations
 */
@Slf4j
@Logged
@Interceptor
class LoggingInterceptor {

    @AroundInvoke
    public Object logInvocation(InvocationContext context) throws Exception {
        String methodName = context.getMethod().getName();
        String className = context.getTarget().getClass().getSimpleName();

        log.debug("Entering {}.{} with args: {}",
            className, methodName, Arrays.toString(context.getParameters()));

        long start = System.currentTimeMillis();

        try {
            Object result = context.proceed();
            long duration = System.currentTimeMillis() - start;
            log.debug("Exiting {}.{} - Duration: {}ms", className, methodName, duration);
            return result;
        } catch (Exception ex) {
            log.error("Exception in {}.{} - {}", className, methodName, ex.getMessage());
            throw ex;
        }
    }
}
`;

  await writeFile(path.join(outputDir, 'LoggingInterceptor.java'), content);
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
