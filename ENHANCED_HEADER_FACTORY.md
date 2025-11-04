# Enhanced ClientHeadersFactory

## Issues with Basic Implementation

The basic `ClientHeadersFactory` has limitations:

### ❌ Problem 1: Only Works in JAX-RS Context
```java
// This works (called from REST endpoint):
@GET
@Path("/orders")
public Uni<Response> getOrders() {
    return petsClient.listPets(10, null);  // ✅ Headers forwarded
}

// This DOESN'T work (called from scheduled job):
@Scheduled(every = "1h")
void syncPets() {
    petsClient.listPets(10, null);  // ❌ incomingHeaders = null
}
```

### ❌ Problem 2: No Programmatic Control
You can't add headers dynamically based on business logic.

### ❌ Problem 3: Not Configurable
Header list is hardcoded in Java code.

---

## ✅ Enhanced Implementation

Here's a production-ready version that solves all these issues:

### 1. **ConfigurableHeaderPropagationFactory.java**

```java
package com.petstore.client.filter;

import org.eclipse.microprofile.rest.client.ext.ClientHeadersFactory;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.ws.rs.core.MultivaluedMap;
import jakarta.ws.rs.core.MultivaluedHashMap;
import lombok.extern.slf4j.Slf4j;
import io.vertx.core.Context;
import io.vertx.core.Vertx;
import java.util.List;
import java.util.Optional;

/**
 * Enhanced header propagation factory
 *
 * Features:
 * - Automatic propagation from incoming JAX-RS requests
 * - Support for non-JAX-RS contexts (scheduled jobs, Kafka, etc.)
 * - Programmatic header addition via Vert.x context
 * - Configurable header list
 * - Security: filters sensitive headers
 */
@ApplicationScoped
@Slf4j
public class ConfigurableHeaderPropagationFactory implements ClientHeadersFactory {

    @ConfigProperty(name = "rest-client.propagated-headers",
                    defaultValue = "Authorization,X-Correlation-ID,X-Request-ID,X-Trace-ID,X-Tenant-ID")
    List<String> propagatedHeaders;

    @ConfigProperty(name = "rest-client.propagate-all-headers", defaultValue = "false")
    boolean propagateAllHeaders;

    @Inject
    Vertx vertx;

    @Override
    public MultivaluedMap<String, String> update(
            MultivaluedMap<String, String> incomingHeaders,
            MultivaluedMap<String, String> clientOutgoingHeaders) {

        MultivaluedMap<String, String> headers = new MultivaluedHashMap<>();

        // Copy all existing outgoing headers (from @HeaderParam, static config, etc.)
        if (clientOutgoingHeaders != null) {
            headers.putAll(clientOutgoingHeaders);
        }

        // 1. Propagate from incoming JAX-RS request (if available)
        propagateFromIncomingRequest(incomingHeaders, headers);

        // 2. Get headers from Vert.x context (for non-JAX-RS contexts)
        propagateFromVertxContext(headers);

        return headers;
    }

    /**
     * Propagate headers from incoming JAX-RS request
     */
    private void propagateFromIncomingRequest(
            MultivaluedMap<String, String> incomingHeaders,
            MultivaluedMap<String, String> outgoingHeaders) {

        if (incomingHeaders == null || incomingHeaders.isEmpty()) {
            log.debug("No incoming headers to propagate (non-JAX-RS context?)");
            return;
        }

        if (propagateAllHeaders) {
            // Copy all headers (be careful with sensitive data!)
            incomingHeaders.forEach((key, values) -> {
                if (isSafeToPropagate(key)) {
                    outgoingHeaders.put(key, values);
                    log.debug("Propagating header (all mode): {}", key);
                }
            });
        } else {
            // Copy only configured headers
            for (String headerName : propagatedHeaders) {
                if (incomingHeaders.containsKey(headerName)) {
                    String value = incomingHeaders.getFirst(headerName);
                    if (value != null && !value.isEmpty()) {
                        outgoingHeaders.putSingle(headerName, value);
                        log.debug("Propagating header: {} = {}", headerName, maskValue(headerName, value));
                    }
                }
            }
        }
    }

    /**
     * Get headers stored in Vert.x context
     * This allows non-JAX-RS code to set headers programmatically
     */
    private void propagateFromVertxContext(MultivaluedMap<String, String> outgoingHeaders) {
        Context context = vertx.getOrCreateContext();

        if (context != null) {
            // Get headers stored in context
            MultivaluedMap<String, String> contextHeaders =
                context.getLocal("rest-client-headers");

            if (contextHeaders != null && !contextHeaders.isEmpty()) {
                contextHeaders.forEach((key, values) -> {
                    // Don't override headers that are already set
                    if (!outgoingHeaders.containsKey(key)) {
                        outgoingHeaders.put(key, values);
                        log.debug("Adding header from context: {}", key);
                    }
                });
            }
        }
    }

    /**
     * Check if header is safe to propagate
     * Filters out sensitive headers like cookies, session IDs
     */
    private boolean isSafeToPropagate(String headerName) {
        String lowerName = headerName.toLowerCase();

        // Block sensitive headers
        if (lowerName.equals("cookie") ||
            lowerName.equals("set-cookie") ||
            lowerName.equals("jsessionid") ||
            lowerName.contains("password") ||
            lowerName.contains("secret")) {
            log.warn("Blocking sensitive header from propagation: {}", headerName);
            return false;
        }

        return true;
    }

    /**
     * Mask sensitive header values for logging
     */
    private String maskValue(String headerName, String value) {
        if (headerName.equalsIgnoreCase("Authorization")) {
            return value.substring(0, Math.min(20, value.length())) + "...";
        }
        return value;
    }
}
```

### 2. **HeaderContext.java** (Helper for Non-JAX-RS Contexts)

```java
package com.petstore.client.util;

import io.vertx.core.Vertx;
import io.vertx.core.Context;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.ws.rs.core.MultivaluedMap;
import jakarta.ws.rs.core.MultivaluedHashMap;

/**
 * Helper class to set headers programmatically
 * for REST client calls from non-JAX-RS contexts
 */
@ApplicationScoped
public class HeaderContext {

    @Inject
    Vertx vertx;

    /**
     * Set headers for the current context
     * These will be automatically added to REST client calls
     */
    public void setHeaders(MultivaluedMap<String, String> headers) {
        Context context = vertx.getOrCreateContext();
        if (context != null) {
            context.putLocal("rest-client-headers", headers);
        }
    }

    /**
     * Set a single header for the current context
     */
    public void setHeader(String name, String value) {
        Context context = vertx.getOrCreateContext();
        if (context != null) {
            MultivaluedMap<String, String> headers = context.getLocal("rest-client-headers");
            if (headers == null) {
                headers = new MultivaluedHashMap<>();
                context.putLocal("rest-client-headers", headers);
            }
            headers.putSingle(name, value);
        }
    }

    /**
     * Clear all headers from context
     */
    public void clearHeaders() {
        Context context = vertx.getOrCreateContext();
        if (context != null) {
            context.removeLocal("rest-client-headers");
        }
    }

    /**
     * Execute code with specific headers
     */
    public <T> T withHeaders(MultivaluedMap<String, String> headers, java.util.function.Supplier<T> action) {
        setHeaders(headers);
        try {
            return action.get();
        } finally {
            clearHeaders();
        }
    }
}
```

---

## 📝 Configuration

**application.properties:**
```properties
# Configure which headers to propagate
rest-client.propagated-headers=Authorization,X-Correlation-ID,X-Request-ID,X-Trace-ID,X-Tenant-ID,X-User-ID

# Or propagate all headers (be careful!)
# rest-client.propagate-all-headers=true
```

---

## 💻 Usage Examples

### Example 1: JAX-RS Endpoint (Automatic)

```java
@Path("/orders")
public class OrderResource {

    @Inject
    @RestClient
    PetsClient petsClient;

    @GET
    public Uni<Response> getOrders() {
        // Headers automatically forwarded from incoming request
        return petsClient.listPets(10, null);
    }
}
```

### Example 2: Scheduled Job (Programmatic Headers)

```java
@ApplicationScoped
public class PetSyncJob {

    @Inject
    @RestClient
    PetsClient petsClient;

    @Inject
    HeaderContext headerContext;

    @Scheduled(every = "1h")
    void syncPets() {
        // Set headers programmatically for this job
        headerContext.setHeader("Authorization", "Bearer " + getServiceToken());
        headerContext.setHeader("X-Correlation-ID", UUID.randomUUID().toString());
        headerContext.setHeader("X-Job-Name", "pet-sync");

        try {
            petsClient.listPets(100, null)
                .subscribe().with(
                    pets -> log.info("Synced {} pets", pets.size()),
                    error -> log.error("Sync failed", error)
                );
        } finally {
            headerContext.clearHeaders();
        }
    }

    private String getServiceToken() {
        // Get service-to-service authentication token
        return "your-service-token";
    }
}
```

### Example 3: Kafka Consumer (Programmatic Headers)

```java
@ApplicationScoped
public class OrderEventConsumer {

    @Inject
    @RestClient
    PetsClient petsClient;

    @Inject
    HeaderContext headerContext;

    @Incoming("orders")
    public Uni<Void> processOrder(OrderEvent event) {
        // Extract trace ID from message
        String traceId = event.getTraceId();

        // Set headers for REST client call
        MultivaluedMap<String, String> headers = new MultivaluedHashMap<>();
        headers.putSingle("X-Correlation-ID", traceId);
        headers.putSingle("X-Event-Type", "order-created");

        return headerContext.withHeaders(headers, () ->
            petsClient.getPetById(event.getPetId())
        ).replaceWithVoid();
    }
}
```

### Example 4: Startup Code (Programmatic Headers)

```java
@ApplicationScoped
public class StartupInitializer {

    @Inject
    @RestClient
    PetsClient petsClient;

    @Inject
    HeaderContext headerContext;

    void onStart(@Observes StartupEvent event) {
        // Set system headers
        headerContext.setHeader("Authorization", "Bearer " + getSystemToken());
        headerContext.setHeader("X-System-Init", "true");

        petsClient.listPets(10, null)
            .subscribe().with(
                pets -> log.info("System initialized with {} pets", pets.size()),
                error -> log.error("Initialization failed", error)
            );

        headerContext.clearHeaders();
    }
}
```

### Example 5: With Custom Headers per Call

```java
@Path("/admin")
public class AdminResource {

    @Inject
    @RestClient
    PetsClient petsClient;

    @Inject
    HeaderContext headerContext;

    @POST
    @Path("/bulk-update")
    public Uni<Response> bulkUpdate(List<Pet> pets) {
        // Add extra headers for this specific call
        headerContext.setHeader("X-Admin-Action", "bulk-update");
        headerContext.setHeader("X-Batch-Size", String.valueOf(pets.size()));

        return Uni.combine().all().unis(
            pets.stream()
                .map(pet -> petsClient.updatePet(pet.getId(), pet))
                .collect(Collectors.toList())
        ).combinedWith(results -> Response.ok(results).build())
        .eventually(() -> headerContext.clearHeaders());
    }
}
```

---

## 🔒 Security Considerations

The enhanced factory includes security features:

### 1. **Sensitive Header Filtering**
```java
// These headers are NEVER propagated:
- Cookie
- Set-Cookie
- JSESSIONID
- Any header containing "password"
- Any header containing "secret"
```

### 2. **Header Masking in Logs**
```java
// Authorization header is masked in logs:
log.debug("Propagating header: Authorization = Bearer eyJhbGci...");
```

### 3. **Configurable Propagation**
```properties
# Only propagate specific headers (whitelist approach)
rest-client.propagated-headers=Authorization,X-Correlation-ID

# Never use propagate-all in production!
# rest-client.propagate-all-headers=false
```

---

## ✅ Summary

### Basic Implementation (Current):
- ✅ Works in JAX-RS context
- ❌ Doesn't work in scheduled jobs, Kafka consumers
- ❌ No programmatic control
- ❌ Hardcoded header list
- ❌ No security filtering

### Enhanced Implementation:
- ✅ Works in JAX-RS context
- ✅ Works in scheduled jobs, Kafka consumers, startup code
- ✅ Programmatic header control via `HeaderContext`
- ✅ Configurable header list via `application.properties`
- ✅ Security filtering of sensitive headers
- ✅ Header masking in logs
- ✅ Easy to use helper methods

---

**Would you like me to generate this enhanced version in your client?** 🚀
