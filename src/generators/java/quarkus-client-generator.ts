/**
 * Quarkus REST Client Generator
 * Generates type-safe MicroProfile REST Client for microservice communication
 */

import { ParsedAPI, Endpoint } from '../../types';
import { writeFile, ensureDir } from 'fs-extra';
import path from 'path';
import { logger } from '../../utils/logger';
import { trackPerformance } from '../../utils/monitoring';

export interface QuarkusClientOptions {
  packageName: string;
  groupId: string;
  artifactId: string;
  version: string;
  javaVersion: number;
  quarkusVersion: string;
  reactive?: boolean; // Use Mutiny for reactive
}

export async function generateQuarkusClient(
  api: ParsedAPI,
  outputDir: string,
  options: QuarkusClientOptions
): Promise<void> {
  return trackPerformance('Quarkus Client Generation', async () => {
    logger.info('Generating Quarkus REST Client SDK', {
      packageName: options.packageName,
      reactive: options.reactive || false
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
    await generateClientApplicationProperties(resourcesDir, api);
    await generateClientModels(api, path.join(srcDir, 'model'), options.packageName);
    await generateClientInterfaces(api, path.join(srcDir, 'client'), options.packageName, options.reactive || false);
    await generateClientExceptionMappers(path.join(srcDir, 'exception'), options.packageName);
    await generateClientFilters(path.join(srcDir, 'filter'), options.packageName, api);

    logger.info('Quarkus REST Client SDK generated successfully');
  });
}

async function generateClientPomXml(outputDir: string, options: QuarkusClientOptions): Promise<void> {
  const reactive = options.reactive || false;

  const content = `<?xml version="1.0"?>
<project xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 https://maven.apache.org/xsd/maven-4.0.0.xsd"
         xmlns="http://maven.apache.org/POM/4.0.0"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
    <modelVersion>4.0.0</modelVersion>

    <groupId>${options.groupId}</groupId>
    <artifactId>${options.artifactId}</artifactId>
    <version>${options.version}</version>
    <name>${options.artifactId}</name>
    <description>Quarkus REST Client SDK</description>

    <properties>
        <compiler-plugin.version>3.11.0</compiler-plugin.version>
        <maven.compiler.release>${options.javaVersion}</maven.compiler.release>
        <project.build.sourceEncoding>UTF-8</project.build.sourceEncoding>
        <quarkus.platform.artifact-id>quarkus-bom</quarkus.platform.artifact-id>
        <quarkus.platform.group-id>io.quarkus.platform</quarkus.platform.group-id>
        <quarkus.platform.version>${options.quarkusVersion}</quarkus.platform.version>
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
        <!-- Quarkus REST Client -->
        ${reactive ? `
        <dependency>
            <groupId>io.quarkus</groupId>
            <artifactId>quarkus-rest-client-reactive-jackson</artifactId>
        </dependency>
        <dependency>
            <groupId>io.smallrye.reactive</groupId>
            <artifactId>mutiny</artifactId>
        </dependency>
        ` : `
        <dependency>
            <groupId>io.quarkus</groupId>
            <artifactId>quarkus-rest-client-jackson</artifactId>
        </dependency>
        `}

        <!-- Bean Validation -->
        <dependency>
            <groupId>io.quarkus</groupId>
            <artifactId>quarkus-hibernate-validator</artifactId>
        </dependency>

        <!-- SmallRye Fault Tolerance (Circuit Breaker, Retry) -->
        <dependency>
            <groupId>io.quarkus</groupId>
            <artifactId>quarkus-smallrye-fault-tolerance</artifactId>
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
        </plugins>
    </build>
</project>
`;

  await writeFile(path.join(outputDir, 'pom.xml'), content);
}

async function generateClientApplicationProperties(resourcesDir: string, api: ParsedAPI): Promise<void> {
  const serviceName = api.title?.toLowerCase().replace(/\s+/g, '-') || 'api';

  const content = `# REST Client Configuration
quarkus.rest-client."${serviceName}".url=http://localhost:8080
quarkus.rest-client."${serviceName}".scope=jakarta.inject.Singleton

# Timeouts
quarkus.rest-client."${serviceName}".connect-timeout=5000
quarkus.rest-client."${serviceName}".read-timeout=10000

# Header Propagation
# Automatic header forwarding is enabled via HeaderPropagationFactory
# Headers are extracted from the OpenAPI spec and common headers are included by default

# Option 1: Use default headers (from spec + common headers like Authorization, X-Correlation-ID, etc.)
# No configuration needed - defaults will be used automatically

# Option 2: Override the complete list of headers to propagate
# rest-client.propagated-headers=Authorization,X-Correlation-ID,X-Custom-Header

# Option 3: Add additional headers beyond the defaults
# rest-client.additional-headers=X-Custom-1,X-Custom-2

# Option 4: Exclude specific headers from propagation
# rest-client.excluded-headers=X-Internal-Only,X-Debug-Info

# Static headers (sent with every request):
# quarkus.rest-client."${serviceName}".header.X-Custom-Header=custom-value
# quarkus.rest-client."${serviceName}".header.X-API-Key=your-api-key

# Circuit Breaker
mp.fault-tolerance.circuitbreaker.enabled=true

# Logging
quarkus.log.level=INFO
quarkus.log.category."org.eclipse.microprofile.rest.client".level=DEBUG
quarkus.log.category."${api.title?.replace(/\s+/g, '.').toLowerCase() || 'api'}.client.filter".level=DEBUG
quarkus.log.console.json=false

# Production logging
%prod.quarkus.log.console.json=true
`;

  await writeFile(path.join(resourcesDir, 'application.properties'), content);
}

async function generateClientModels(
  api: ParsedAPI,
  outputDir: string,
  packageName: string
): Promise<void> {
  await ensureDir(outputDir);

  for (const schema of api.schemas) {
    const className = capitalize(schema.name);
    const content = generateClientModelClass(className, schema.schema, packageName);
    await writeFile(path.join(outputDir, `${className}.java`), content);
  }
}

function generateClientModelClass(className: string, schema: any, packageName: string): string {
  const properties = schema.properties || {};
  const required = schema.required || [];

  let content = `package ${packageName}.model;

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
 * ${schema.description || className + ' model'}
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

async function generateClientInterfaces(
  api: ParsedAPI,
  outputDir: string,
  packageName: string,
  reactive: boolean
): Promise<void> {
  await ensureDir(outputDir);

  const grouped = groupEndpointsByTag(api.endpoints);
  const serviceName = api.title?.toLowerCase().replace(/\s+/g, '-') || 'api';

  for (const [tag, endpoints] of Object.entries(grouped)) {
    const className = capitalize(tag) + 'Client';
    const content = generateClientInterface(className, endpoints, packageName, reactive, serviceName);
    await writeFile(path.join(outputDir, `${className}.java`), content);
  }
}

function generateClientInterface(
  className: string,
  endpoints: Endpoint[],
  packageName: string,
  reactive: boolean,
  serviceName: string
): string {
  const imports = reactive ?
    'import io.smallrye.mutiny.Uni;' : '';

  let content = `package ${packageName}.client;

import ${packageName}.model.*;
import ${packageName}.filter.HeaderPropagationFactory;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;
import org.eclipse.microprofile.rest.client.inject.RegisterRestClient;
import org.eclipse.microprofile.rest.client.annotation.RegisterClientHeaders;
import org.eclipse.microprofile.faulttolerance.*;
${imports}
import java.util.List;

/**
 * MicroProfile REST Client for ${className.replace('Client', '')} operations
 * Generated from OpenAPI specification
 *
 * Automatic header propagation enabled via HeaderPropagationFactory
 */
@RegisterRestClient(configKey = "${serviceName}")
@RegisterClientHeaders(HeaderPropagationFactory.class)
@Path("/")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public interface ${className} {

`;

  for (const endpoint of endpoints) {
    content += generateClientInterfaceMethod(endpoint, reactive);
  }

  content += `}\n`;

  return content;
}

function generateClientInterfaceMethod(endpoint: Endpoint, reactive: boolean): string {
  const methodName = toCamelCase(endpoint.operationId || endpoint.path);
  const httpMethod = endpoint.method.toUpperCase();
  const pathParams = endpoint.parameters?.filter(p => p.in === 'path') || [];
  const queryParams = endpoint.parameters?.filter(p => p.in === 'query') || [];
  const headerParams = endpoint.parameters?.filter(p => p.in === 'header') || [];
  const hasBody = ['POST', 'PUT', 'PATCH'].includes(httpMethod);

  const params: string[] = [];
  const fallbackParams: string[] = []; // Parameters without JAX-RS annotations

  pathParams.forEach(param => {
    params.push(`@PathParam("${param.name}") ${mapTypeToJava(param.type)} ${toCamelCase(param.name)}`);
    fallbackParams.push(`${mapTypeToJava(param.type)} ${toCamelCase(param.name)}`);
  });

  queryParams.forEach(param => {
    params.push(`@QueryParam("${param.name}") ${mapTypeToJava(param.type)} ${toCamelCase(param.name)}`);
    fallbackParams.push(`${mapTypeToJava(param.type)} ${toCamelCase(param.name)}`);
  });

  headerParams.forEach(param => {
    params.push(`@HeaderParam("${param.name}") ${mapTypeToJava(param.type)} ${toCamelCase(param.name)}`);
    fallbackParams.push(`${mapTypeToJava(param.type)} ${toCamelCase(param.name)}`);
  });

  if (hasBody) {
    params.push(`Object requestBody`);
    fallbackParams.push(`Object requestBody`);
  }

  const returnType = reactive ? 'Uni<Object>' : 'Object';

  let method = `    /**
     * ${endpoint.summary || endpoint.operationId}
     * ${endpoint.description || ''}
     */
    @CircuitBreaker(
        requestVolumeThreshold = 10,
        failureRatio = 0.5,
        delay = 5000,
        successThreshold = 3
    )
    @Retry(
        maxRetries = 3,
        delay = 1000,
        jitter = 500
    )
    @Timeout(value = 10000)
    @Fallback(fallbackMethod = "${methodName}Fallback")
    @${httpMethod}
    @Path("${endpoint.path}")
    ${returnType} ${methodName}(${params.join(', ')});

    /**
     * Fallback for ${methodName}
     */
    default ${returnType} ${methodName}Fallback(${fallbackParams.join(', ')}) {
`;

  if (reactive) {
    method += `        return Uni.createFrom().failure(new RuntimeException("Service unavailable"));\n`;
  } else {
    method += `        throw new RuntimeException("Service unavailable");\n`;
  }

  method += `    }\n\n`;

  return method;
}

async function generateClientExceptionMappers(
  outputDir: string,
  packageName: string
): Promise<void> {
  await ensureDir(outputDir);

  const content = `package ${packageName}.exception;

import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.ext.Provider;
import org.eclipse.microprofile.rest.client.ext.ResponseExceptionMapper;
import lombok.extern.slf4j.Slf4j;

/**
 * Exception mapper for REST client errors
 */
@Provider
@Slf4j
public class ClientExceptionMapper implements ResponseExceptionMapper<ApiClientException> {

    @Override
    public ApiClientException toThrowable(Response response) {
        int status = response.getStatus();
        String message = "API call failed with status: " + status;

        log.error(message);

        return new ApiClientException(message, status);
    }

    @Override
    public boolean handles(int status, jakarta.ws.rs.core.MultivaluedMap<String, Object> headers) {
        return status >= 400;
    }
}
`;

  await writeFile(path.join(outputDir, 'ClientExceptionMapper.java'), content);

  const exceptionContent = `package ${packageName}.exception;

/**
 * Custom exception for API client errors
 */
public class ApiClientException extends RuntimeException {

    private final int statusCode;

    public ApiClientException(String message, int statusCode) {
        super(message);
        this.statusCode = statusCode;
    }

    public ApiClientException(String message, Throwable cause) {
        super(message, cause);
        this.statusCode = 500;
    }

    public int getStatusCode() {
        return statusCode;
    }
}
`;

  await writeFile(path.join(outputDir, 'ApiClientException.java'), exceptionContent);
}

async function generateClientFilters(
  outputDir: string,
  packageName: string,
  api: ParsedAPI
): Promise<void> {
  await ensureDir(outputDir);

  // Extract unique header parameters from all endpoints in the spec
  const specHeaders = extractHeadersFromSpec(api);

  const loggingFilterContent = `package ${packageName}.filter;

import jakarta.ws.rs.client.ClientRequestContext;
import jakarta.ws.rs.client.ClientRequestFilter;
import jakarta.ws.rs.ext.Provider;
import lombok.extern.slf4j.Slf4j;
import java.io.IOException;

/**
 * Request/Response logging filter for REST client
 */
@Provider
@Slf4j
public class LoggingFilter implements ClientRequestFilter {

    @Override
    public void filter(ClientRequestContext requestContext) throws IOException {
        log.debug("REST Client Request: {} {}",
            requestContext.getMethod(),
            requestContext.getUri()
        );
    }
}
`;

  await writeFile(path.join(outputDir, 'LoggingFilter.java'), loggingFilterContent);

  // Generate ClientHeadersFactory for automatic header propagation
  const headersFactoryContent = generateHeaderPropagationFactory(packageName, specHeaders);

  await writeFile(path.join(outputDir, 'HeaderPropagationFactory.java'), headersFactoryContent);
}

// Helper functions

/**
 * Extract unique header parameters from all endpoints in the OpenAPI spec
 */
function extractHeadersFromSpec(api: ParsedAPI): string[] {
  const headers = new Set<string>();

  // Common headers that should always be propagated
  const defaultHeaders = [
    'Authorization',
    'X-Correlation-ID',
    'X-Request-ID',
    'X-Trace-ID',
    'X-Tenant-ID',
    'Accept-Language',
    'X-Forwarded-For',
    'X-Forwarded-Proto',
    'X-Forwarded-Host'
  ];

  // Add default headers
  defaultHeaders.forEach(h => headers.add(h));

  // Extract headers from endpoint parameters
  for (const endpoint of api.endpoints) {
    const headerParams = endpoint.parameters?.filter(p => p.in === 'header') || [];
    headerParams.forEach(param => {
      // Add header name if it's not already a standard JAX-RS header
      if (!['Content-Type', 'Accept', 'User-Agent'].includes(param.name)) {
        headers.add(param.name);
      }
    });
  }

  return Array.from(headers).sort();
}

/**
 * Generate HeaderPropagationFactory with spec-based headers and configuration support
 */
function generateHeaderPropagationFactory(packageName: string, specHeaders: string[]): string {
  // Generate Java string array elements with proper indentation
  const headersArray = specHeaders.map(h => `        "${h}"`).join(',\n');

  return `package ${packageName}.filter;

import org.eclipse.microprofile.rest.client.ext.ClientHeadersFactory;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.ws.rs.core.MultivaluedMap;
import jakarta.ws.rs.core.MultivaluedHashMap;
import lombok.extern.slf4j.Slf4j;
import java.util.List;
import java.util.Arrays;
import java.util.stream.Collectors;

/**
 * Automatic header propagation for REST client
 * Forwards headers from incoming request to outgoing REST client calls
 *
 * Features:
 * - Extracts headers from OpenAPI spec automatically
 * - Configurable via application.properties
 * - Supports adding/removing headers without code changes
 *
 * Configuration:
 * - rest-client.propagated-headers: Comma-separated list of headers to propagate
 * - rest-client.additional-headers: Additional headers to propagate beyond defaults
 * - rest-client.excluded-headers: Headers to exclude from propagation
 */
@ApplicationScoped
@Slf4j
public class HeaderPropagationFactory implements ClientHeadersFactory {

    /**
     * Default headers to propagate (extracted from OpenAPI spec + common headers)
     * Can be overridden via rest-client.propagated-headers configuration
     */
    private static final String[] DEFAULT_PROPAGATED_HEADERS = {
${headersArray}
    };

    /**
     * Override the default header list completely
     * Example: rest-client.propagated-headers=Authorization,X-Custom-Header
     */
    @ConfigProperty(name = "rest-client.propagated-headers")
    java.util.Optional<List<String>> configuredHeaders;

    /**
     * Additional headers to propagate beyond defaults
     * Example: rest-client.additional-headers=X-Custom-1,X-Custom-2
     */
    @ConfigProperty(name = "rest-client.additional-headers")
    java.util.Optional<List<String>> additionalHeaders;

    /**
     * Headers to exclude from propagation
     * Example: rest-client.excluded-headers=X-Internal-Only
     */
    @ConfigProperty(name = "rest-client.excluded-headers")
    java.util.Optional<List<String>> excludedHeaders;

    @Override
    public MultivaluedMap<String, String> update(
            MultivaluedMap<String, String> incomingHeaders,
            MultivaluedMap<String, String> clientOutgoingHeaders) {

        MultivaluedMap<String, String> headers = new MultivaluedHashMap<>();

        // Copy all existing outgoing headers (from @HeaderParam, static config, etc.)
        if (clientOutgoingHeaders != null) {
            headers.putAll(clientOutgoingHeaders);
        }

        // Determine which headers to propagate
        List<String> headersTopropagate = getHeadersTopropagate();

        // Propagate headers from incoming request
        if (incomingHeaders != null && !incomingHeaders.isEmpty()) {
            for (String headerName : headersTopropagate) {
                if (incomingHeaders.containsKey(headerName)) {
                    String value = incomingHeaders.getFirst(headerName);
                    if (value != null && !value.isEmpty()) {
                        headers.putSingle(headerName, value);
                        log.debug("Propagating header: {} = {}", headerName, maskSensitiveValue(headerName, value));
                    }
                }
            }
        } else {
            log.debug("No incoming headers to propagate (non-JAX-RS context or initial request)");
        }

        return headers;
    }

    /**
     * Determine the final list of headers to propagate based on configuration
     */
    private List<String> getHeadersTopropagate() {
        List<String> headers;

        // If custom headers are configured, use them instead of defaults
        if (configuredHeaders.isPresent() && !configuredHeaders.get().isEmpty()) {
            headers = configuredHeaders.get().stream()
                .map(String::trim)
                .collect(Collectors.toList());
            log.debug("Using configured headers: {}", headers);
        } else {
            // Use default headers from spec
            headers = Arrays.stream(DEFAULT_PROPAGATED_HEADERS)
                .collect(Collectors.toList());
        }

        // Add any additional headers
        if (additionalHeaders.isPresent() && !additionalHeaders.get().isEmpty()) {
            List<String> additional = additionalHeaders.get().stream()
                .map(String::trim)
                .collect(Collectors.toList());
            headers.addAll(additional);
            log.debug("Added additional headers: {}", additional);
        }

        // Remove excluded headers
        if (excludedHeaders.isPresent() && !excludedHeaders.get().isEmpty()) {
            List<String> excluded = excludedHeaders.get().stream()
                .map(String::trim)
                .collect(Collectors.toList());
            headers.removeAll(excluded);
            log.debug("Excluded headers: {}", excluded);
        }

        return headers;
    }

    /**
     * Mask sensitive header values for logging
     */
    private String maskSensitiveValue(String headerName, String value) {
        if (headerName.equalsIgnoreCase("Authorization") ||
            headerName.toLowerCase().contains("token") ||
            headerName.toLowerCase().contains("key")) {
            return value.substring(0, Math.min(20, value.length())) + "...";
        }
        return value;
    }
}
`;
}

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
