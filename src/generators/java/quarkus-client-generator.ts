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
    await generateClientFilters(path.join(srcDir, 'filter'), options.packageName);

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
# The following headers are automatically propagated from incoming requests:
# - Authorization
# - X-Correlation-ID
# - X-Request-ID
# - X-Trace-ID
# - X-Tenant-ID
# - Accept-Language
# - X-Forwarded-For
# - X-Forwarded-Proto
# - X-Forwarded-Host

# You can also set static headers that will be sent with every request:
# quarkus.rest-client."${serviceName}".header.X-Custom-Header=custom-value

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
  packageName: string
): Promise<void> {
  await ensureDir(outputDir);

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
  const headersFactoryContent = `package ${packageName}.filter;

import org.eclipse.microprofile.rest.client.ext.ClientHeadersFactory;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.ws.rs.core.MultivaluedMap;
import jakarta.ws.rs.core.MultivaluedHashMap;
import lombok.extern.slf4j.Slf4j;

/**
 * Automatic header propagation for REST client
 * Forwards headers from incoming request to outgoing REST client calls
 */
@ApplicationScoped
@Slf4j
public class HeaderPropagationFactory implements ClientHeadersFactory {

    /**
     * Headers to automatically propagate from incoming requests
     */
    private static final String[] PROPAGATED_HEADERS = {
        "Authorization",
        "X-Correlation-ID",
        "X-Request-ID",
        "X-Trace-ID",
        "X-Tenant-ID",
        "Accept-Language",
        "X-Forwarded-For",
        "X-Forwarded-Proto",
        "X-Forwarded-Host"
    };

    @Override
    public MultivaluedMap<String, String> update(
            MultivaluedMap<String, String> incomingHeaders,
            MultivaluedMap<String, String> clientOutgoingHeaders) {

        MultivaluedMap<String, String> headers = new MultivaluedHashMap<>();

        // Copy all existing outgoing headers
        headers.putAll(clientOutgoingHeaders);

        // Propagate specific headers from incoming request
        if (incomingHeaders != null) {
            for (String headerName : PROPAGATED_HEADERS) {
                if (incomingHeaders.containsKey(headerName)) {
                    String value = incomingHeaders.getFirst(headerName);
                    if (value != null && !value.isEmpty()) {
                        headers.putSingle(headerName, value);
                        log.debug("Propagating header: {} = {}", headerName, value);
                    }
                }
            }
        }

        return headers;
    }
}
`;

  await writeFile(path.join(outputDir, 'HeaderPropagationFactory.java'), headersFactoryContent);
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
