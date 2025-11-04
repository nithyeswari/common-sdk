# Header Forwarding Guide for Microservices

Complete guide for automatic header propagation between microservices using REST clients.

---

## ✅ Answer: **YES, Headers ARE Automatically Forwarded!**

The generated Quarkus REST Client includes **`@RegisterClientHeaders`** which enables automatic header propagation using `HeaderPropagationFactory`.

```java
@RegisterRestClient(configKey = "pet-store-api")
@RegisterClientHeaders(HeaderPropagationFactory.class)  // ← Automatic header forwarding!
@Path("/")
public interface PetsClient {
    // ...
}
```

---

## 🎯 How Header Forwarding Works

### 1. **Automatic Propagation (Default)**

The generated `HeaderPropagationFactory` automatically forwards these headers from **incoming requests** to **outgoing REST client calls**:

✅ **Authorization** - JWT tokens, bearer tokens
✅ **X-Correlation-ID** - Request tracing
✅ **X-Request-ID** - Unique request identifier
✅ **X-Trace-ID** - Distributed tracing
✅ **X-Tenant-ID** - Multi-tenancy support
✅ **Accept-Language** - Internationalization
✅ **X-Forwarded-For** - Original client IP
✅ **X-Forwarded-Proto** - Original protocol (HTTP/HTTPS)
✅ **X-Forwarded-Host** - Original host

### 2. **Flow Diagram**

```
Client Request                   Your Service                  External API
    |                                 |                             |
    |--- Authorization: Bearer xyz -->|                             |
    |--- X-Correlation-ID: abc123 -->|                             |
    |                                 |                             |
    |                                 |--- Authorization: Bearer xyz -->|
    |                                 |--- X-Correlation-ID: abc123 -->|
    |                                 |                             |
    |                                 |<-- Response data ----------|
    |<-- Response data --------------|                             |
```

---

## 📁 Generated Files

### **HeaderPropagationFactory.java**

```java
package com.petstore.client.filter;

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
```

### **PetsClient.java** (Interface)

```java
@RegisterRestClient(configKey = "pet-store-api")
@RegisterClientHeaders(HeaderPropagationFactory.class)  // ← Enables header forwarding
@Path("/")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public interface PetsClient {

    @GET
    @Path("/pets")
    Uni<List<Pet>> listPets(
        @QueryParam("limit") Long limit,
        @QueryParam("tag") String tag
    );
}
```

---

## 🛠️ Configuration

### **application.properties**

```properties
# REST Client Configuration
quarkus.rest-client."pet-store-api".url=http://petstore-service:8080
quarkus.rest-client."pet-store-api".scope=jakarta.inject.Singleton

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
# quarkus.rest-client."pet-store-api".header.X-Custom-Header=custom-value
# quarkus.rest-client."pet-store-api".header.X-API-Key=your-api-key
```

---

## 💻 Usage Examples

### Example 1: Basic Usage (Automatic Header Forwarding)

**Service A receives a request with headers:**
```http
GET /orders HTTP/1.1
Host: order-service:8080
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
X-Correlation-ID: 550e8400-e29b-41d4-a716-446655440000
X-Tenant-ID: customer-123
```

**Service A calls Service B using the client:**
```java
@Path("/orders")
public class OrderResource {

    @Inject
    @RestClient
    PetsClient petsClient;  // Client for Pet Service

    @GET
    public Uni<Response> getOrders() {
        // Headers are AUTOMATICALLY forwarded!
        return petsClient.listPets(10, null)
            .onItem().transform(pets -> {
                // Process pets...
                return Response.ok(orders).build();
            });
    }
}
```

**Service B receives the request with forwarded headers:**
```http
GET /pets?limit=10 HTTP/1.1
Host: pet-service:8080
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...  ← Automatically forwarded!
X-Correlation-ID: 550e8400-e29b-41d4-a716-446655440000  ← Automatically forwarded!
X-Tenant-ID: customer-123  ← Automatically forwarded!
```

### Example 2: Spec-Defined Headers

If your OpenAPI spec defines header parameters:

```yaml
paths:
  /pets:
    get:
      parameters:
        - name: X-API-Version
          in: header
          required: true
          schema:
            type: string
        - name: X-Client-ID
          in: header
          required: false
          schema:
            type: string
```

The generated client will include them:

```java
@GET
@Path("/pets")
Uni<List<Pet>> listPets(
    @QueryParam("limit") Long limit,
    @HeaderParam("X-API-Version") String apiVersion,    // ← From spec
    @HeaderParam("X-Client-ID") String clientId         // ← From spec
);
```

### Example 3: Adding Custom Headers Programmatically

If you need to add headers beyond automatic propagation:

```java
@Path("/orders")
public class OrderResource {

    @Inject
    @RestClient
    PetsClient petsClient;

    @GET
    public Uni<Response> getOrders(@HeaderParam("X-Custom-Header") String customHeader) {
        // Pass custom header explicitly
        return petsClient.listPets(10, null, customHeader)
            .onItem().transform(pets -> Response.ok(orders).build());
    }
}
```

### Example 4: Static Headers (Configuration)

For headers that are always the same (like API keys):

```properties
# application.properties
quarkus.rest-client."pet-store-api".header.X-API-Key=your-secret-key
quarkus.rest-client."pet-store-api".header.X-Service-Name=order-service
```

These headers will be added to **every request** automatically.

---

## 🔧 Customizing Header Propagation

### Add More Headers to Propagate

Edit the generated `HeaderPropagationFactory.java`:

```java
private static final String[] PROPAGATED_HEADERS = {
    "Authorization",
    "X-Correlation-ID",
    "X-Request-ID",
    "X-Trace-ID",
    "X-Tenant-ID",
    "Accept-Language",
    "X-Forwarded-For",
    "X-Forwarded-Proto",
    "X-Forwarded-Host",
    // Add your custom headers here:
    "X-Organization-ID",     // ← Custom header
    "X-User-Role",           // ← Custom header
    "X-API-Version"          // ← Custom header
};
```

### Conditional Header Propagation

```java
@Override
public MultivaluedMap<String, String> update(
        MultivaluedMap<String, String> incomingHeaders,
        MultivaluedMap<String, String> clientOutgoingHeaders) {

    MultivaluedMap<String, String> headers = new MultivaluedHashMap<>();
    headers.putAll(clientOutgoingHeaders);

    if (incomingHeaders != null) {
        for (String headerName : PROPAGATED_HEADERS) {
            if (incomingHeaders.containsKey(headerName)) {
                String value = incomingHeaders.getFirst(headerName);

                // Conditional logic
                if ("Authorization".equals(headerName) && value.startsWith("Bearer ")) {
                    // Only forward Bearer tokens
                    headers.putSingle(headerName, value);
                } else if (value != null && !value.isEmpty()) {
                    headers.putSingle(headerName, value);
                }
            }
        }
    }

    return headers;
}
```

### Transform Headers Before Forwarding

```java
@Override
public MultivaluedMap<String, String> update(
        MultivaluedMap<String, String> incomingHeaders,
        MultivaluedMap<String, String> clientOutgoingHeaders) {

    MultivaluedMap<String, String> headers = new MultivaluedHashMap<>();
    headers.putAll(clientOutgoingHeaders);

    if (incomingHeaders != null) {
        // Forward Authorization as-is
        if (incomingHeaders.containsKey("Authorization")) {
            headers.putSingle("Authorization", incomingHeaders.getFirst("Authorization"));
        }

        // Transform X-Correlation-ID to X-Request-ID
        if (incomingHeaders.containsKey("X-Correlation-ID")) {
            String correlationId = incomingHeaders.getFirst("X-Correlation-ID");
            headers.putSingle("X-Request-ID", correlationId);
        }

        // Add service identifier
        headers.putSingle("X-Calling-Service", "order-service");
    }

    return headers;
}
```

---

## 🎯 Common Use Cases

### Use Case 1: Multi-Tenant Application

**Scenario:** Forward tenant ID to all downstream services.

**Configuration:**
```java
// HeaderPropagationFactory already includes "X-Tenant-ID"
```

**Usage:**
```java
// Incoming request has X-Tenant-ID: tenant-abc
// All REST client calls automatically include X-Tenant-ID: tenant-abc
```

### Use Case 2: Distributed Tracing

**Scenario:** Propagate trace IDs across microservices.

**Configuration:**
```java
// HeaderPropagationFactory already includes:
// - X-Correlation-ID
// - X-Request-ID
// - X-Trace-ID
```

**Usage:**
```java
// All services in the call chain share the same correlation ID
// Makes debugging and tracing easy!
```

### Use Case 3: Authentication Propagation

**Scenario:** Forward JWT tokens to secured downstream services.

**Configuration:**
```java
// HeaderPropagationFactory already includes "Authorization"
```

**Usage:**
```java
// User's JWT token is automatically forwarded
// No need to manually extract and pass tokens!
```

### Use Case 4: API Versioning

**Scenario:** Forward API version header to all services.

**OpenAPI Spec:**
```yaml
parameters:
  - name: X-API-Version
    in: header
    required: true
    schema:
      type: string
```

**Generated Client:**
```java
@GET
@Path("/pets")
Uni<List<Pet>> listPets(
    @HeaderParam("X-API-Version") String apiVersion
);
```

---

## 🐞 Troubleshooting

### Headers Not Being Forwarded

**Check 1:** Verify `@RegisterClientHeaders` is present
```java
@RegisterRestClient(configKey = "pet-store-api")
@RegisterClientHeaders(HeaderPropagationFactory.class)  // ← Must be present
```

**Check 2:** Verify HeaderPropagationFactory is in classpath
```bash
ls src/main/java/com/petstore/client/filter/HeaderPropagationFactory.java
```

**Check 3:** Enable debug logging
```properties
quarkus.log.category."com.petstore.client.filter".level=DEBUG
```

### Wrong Headers Being Forwarded

**Solution:** Edit `PROPAGATED_HEADERS` array in `HeaderPropagationFactory.java` to include only the headers you want.

### Headers From OpenAPI Spec Not Showing

**Check:** Make sure the parameter is defined with `in: header` in your OpenAPI spec:

```yaml
parameters:
  - name: X-My-Header
    in: header  # ← Must be "header"
    schema:
      type: string
```

---

## 📊 Comparison: Spring Boot vs Quarkus

| Feature | Spring Boot | Quarkus |
|---------|-------------|---------|
| **Automatic Forwarding** | Manual via Interceptors | ✅ Built-in via `@RegisterClientHeaders` |
| **Configuration** | Programmatic | Declarative + Programmatic |
| **Spec-based Headers** | ✅ `@RequestHeader` | ✅ `@HeaderParam` |
| **Static Headers** | Properties or Config | ✅ Properties |
| **Dynamic Headers** | Interceptors | `ClientHeadersFactory` |
| **Ease of Use** | Moderate | ✅ Easy |

---

## 🎉 Summary

### ✅ What's Automatic (No Code Required):

1. **Authorization tokens** - JWT, Bearer tokens
2. **Correlation IDs** - X-Correlation-ID, X-Request-ID, X-Trace-ID
3. **Tenant IDs** - X-Tenant-ID
4. **Forwarding headers** - X-Forwarded-For, X-Forwarded-Proto, X-Forwarded-Host
5. **Language preferences** - Accept-Language

### 📝 What You Can Configure:

1. **Add more headers** - Edit `PROPAGATED_HEADERS` array
2. **Static headers** - Use `application.properties`
3. **Transform headers** - Customize `HeaderPropagationFactory.update()`
4. **Conditional forwarding** - Add logic to `update()` method

### 🚀 Best Practices:

1. ✅ Use automatic propagation for common headers (Authorization, Correlation IDs)
2. ✅ Define API-specific headers in OpenAPI spec
3. ✅ Use static headers for API keys and service identifiers
4. ✅ Enable debug logging in development
5. ✅ Test header forwarding in integration tests

---

**Header forwarding is now automatic and production-ready! 🎉**
