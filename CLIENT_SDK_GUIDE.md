# Client SDK Generation Guide

Generate **type-safe REST client SDKs** for backend-to-backend communication in microservices architectures.

---

## 🎯 What Are Client SDKs?

Client SDKs are type-safe libraries that allow one backend service to call another backend service's API. They're perfect for:

- **Microservices communication** - Service A calls Service B
- **Spec-first development** - Generate clients from OpenAPI specifications
- **Type safety** - Compile-time validation of API calls
- **Resilience** - Built-in circuit breakers, retries, and timeouts
- **Observability** - Automatic logging and monitoring

---

## 🚀 Quick Start

### Generate Spring Boot Client (WebClient)

```bash
openapi-redux-gen generate-spring-client \
  -i petstore.yaml \
  -o ./petstore-client \
  -p com.example.petstore.client \
  -g com.example \
  -a petstore-client
```

### Generate Quarkus Client (MicroProfile REST Client)

```bash
openapi-redux-gen generate-quarkus-client \
  -i petstore.yaml \
  -o ./petstore-client \
  -p com.example.petstore.client \
  -g com.example \
  -a petstore-client \
  --reactive
```

---

## 📋 CLI Commands

### `generate-spring-client`

Generate Spring Boot WebClient-based REST client SDK.

```bash
openapi-redux-gen generate-spring-client [options]

Required:
  -i, --input <path>               OpenAPI spec file
  -o, --output <path>              Output directory

Optional:
  -p, --package <name>             Java package (default: com.example.api.client)
  -g, --group-id <id>              Maven group ID (default: com.example)
  -a, --artifact-id <id>           Maven artifact ID (default: api-client)
  -v, --version <version>          Version (default: 1.0.0)
  --java-version <version>         Java version (default: 21)
  --spring-boot-version <version>  Spring Boot version (default: 3.2.0)
  --use-rest-template              Use RestTemplate instead of WebClient
```

### `generate-quarkus-client`

Generate Quarkus MicroProfile REST Client SDK.

```bash
openapi-redux-gen generate-quarkus-client [options]

Required:
  -i, --input <path>               OpenAPI spec file
  -o, --output <path>              Output directory

Optional:
  -p, --package <name>             Java package (default: com.example.api.client)
  -g, --group-id <id>              Maven group ID (default: com.example)
  -a, --artifact-id <id>           Maven artifact ID (default: api-client)
  -v, --version <version>          Version (default: 1.0.0)
  --java-version <version>         Java version (default: 21)
  --quarkus-version <version>      Quarkus version (default: 3.6.0)
  --reactive                       Generate reactive (Mutiny) client
```

---

## 🏗️ Generated Project Structure

### Spring Boot Client

```
petstore-client/
├── pom.xml
└── src/main/java/com/example/petstore/client/
    ├── client/
    │   └── PetsClient.java           # REST client with WebClient
    ├── dto/
    │   ├── Pet.java                  # DTOs with validation
    │   ├── NewPet.java
    │   └── Error.java
    ├── config/
    │   └── ClientConfig.java         # WebClient configuration
    └── exception/
        └── ApiClientException.java    # Custom exceptions
```

### Quarkus Client

```
petstore-client/
├── pom.xml
└── src/main/java/com/example/petstore/client/
    ├── client/
    │   └── PetsClient.java           # MicroProfile REST Client interface
    ├── model/
    │   ├── Pet.java                  # Models with validation
    │   ├── NewPet.java
    │   └── Error.java
    ├── exception/
    │   ├── ClientExceptionMapper.java
    │   └── ApiClientException.java
    └── filter/
        └── LoggingFilter.java         # Request/response logging
```

---

## 💻 Generated Code Examples

### Spring Boot WebClient Client

**PetsClient.java:**
```java
@Slf4j
@Component
@RequiredArgsConstructor
public class PetsClient {

    private final WebClient webClient;

    @CircuitBreaker(name = "apiClient", fallbackMethod = "listPetsFallback")
    @Retry(name = "apiClient")
    public Mono<Object> listPets(Long limit, String tag) {
        log.debug("Calling listPets");

        String path = "/pets";

        UriComponentsBuilder builder = UriComponentsBuilder.fromPath(path);
        if (limit != null) {
            builder.queryParam("limit", limit);
        }
        if (tag != null) {
            builder.queryParam("tag", tag);
        }
        path = builder.build().toUriString();

        return webClient.get()
            .uri(path)
            .retrieve()
            .bodyToMono(Object.class)
            .doOnSuccess(response -> log.debug("listPets completed successfully"))
            .doOnError(error -> log.error("listPets failed", error));
    }

    private Mono<Object> listPetsFallback(Long limit, String tag, Exception ex) {
        log.warn("Fallback triggered for listPets: {}", ex.getMessage());
        return Mono.error(new ApiClientException("Service unavailable", ex));
    }
}
```

**Features:**
- ✅ **WebClient** - Reactive, non-blocking HTTP client
- ✅ **Circuit Breaker** - Resilience4j annotations
- ✅ **Retry Logic** - Automatic retries with backoff
- ✅ **Fallback Methods** - Graceful degradation
- ✅ **Logging** - Request/response logging

---

### Quarkus MicroProfile REST Client

**PetsClient.java:**
```java
@RegisterRestClient(configKey = "pet-store-api")
@Path("/")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public interface PetsClient {

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
    @Fallback(fallbackMethod = "listPetsFallback")
    @GET
    @Path("/pets")
    Uni<Object> listPets(
        @QueryParam("limit") Long limit,
        @QueryParam("tag") String tag
    );

    default Uni<Object> listPetsFallback(Long limit, String tag) {
        return Uni.createFrom().failure(new RuntimeException("Service unavailable"));
    }
}
```

**Features:**
- ✅ **MicroProfile REST Client** - Standard Jakarta EE REST client
- ✅ **Reactive (Mutiny)** - Non-blocking with Uni<T>
- ✅ **SmallRye Fault Tolerance** - Circuit breaker, retry, timeout
- ✅ **Declarative** - Interface-based, no implementation needed
- ✅ **Type-safe** - Compile-time validation

---

## 🔧 Usage in Microservices

### Spring Boot Microservice

**1. Add the client as a dependency:**

```xml
<dependency>
    <groupId>com.example</groupId>
    <artifactId>petstore-client</artifactId>
    <version>1.0.0</version>
</dependency>
```

**2. Configure the base URL:**

```properties
# application.properties
api.client.base-url=http://petstore-service:8080
api.client.connect-timeout=5000
api.client.read-timeout=10000
```

**3. Inject and use the client:**

```java
@Service
@RequiredArgsConstructor
public class OrderService {

    private final PetsClient petsClient;

    public Mono<Order> createOrder(String petId, Long quantity) {
        return petsClient.getPetById(petId)
            .flatMap(pet -> {
                // Create order with pet information
                return orderRepository.save(order);
            })
            .doOnError(ex -> log.error("Failed to create order", ex));
    }
}
```

---

### Quarkus Microservice

**1. Add the client as a dependency:**

```xml
<dependency>
    <groupId>com.example</groupId>
    <artifactId>petstore-client</artifactId>
    <version>1.0.0</version>
</dependency>
```

**2. Configure the base URL:**

```properties
# application.properties
quarkus.rest-client."pet-store-api".url=http://petstore-service:8080
quarkus.rest-client."pet-store-api".scope=jakarta.inject.Singleton
quarkus.rest-client."pet-store-api".connect-timeout=5000
quarkus.rest-client."pet-store-api".read-timeout=10000
```

**3. Inject and use the client:**

```java
@ApplicationScoped
public class OrderService {

    @Inject
    @RestClient
    PetsClient petsClient;

    public Uni<Order> createOrder(String petId, Long quantity) {
        return petsClient.getPetById(petId)
            .onItem().transformToUni(pet -> {
                // Create order with pet information
                return orderRepository.persist(order);
            })
            .onFailure().invoke(ex -> log.error("Failed to create order", ex));
    }
}
```

---

## 🎯 Key Features

### 1. Circuit Breaker

**Prevents cascading failures** when a service is down.

**Spring Boot:**
```java
@CircuitBreaker(name = "apiClient", fallbackMethod = "fallback")
```

**Quarkus:**
```java
@CircuitBreaker(
    requestVolumeThreshold = 10,
    failureRatio = 0.5,
    delay = 5000
)
```

**Configuration:**
```properties
# Spring Boot
resilience4j.circuitbreaker.instances.apiClient.slidingWindowSize=10
resilience4j.circuitbreaker.instances.apiClient.failureRateThreshold=50

# Quarkus (in annotation)
```

---

### 2. Retry Logic

**Automatic retries** with exponential backoff.

**Spring Boot:**
```java
@Retry(name = "apiClient")
```

**Quarkus:**
```java
@Retry(maxRetries = 3, delay = 1000, jitter = 500)
```

**Configuration:**
```properties
# Spring Boot
resilience4j.retry.instances.apiClient.maxAttempts=3
resilience4j.retry.instances.apiClient.waitDuration=1000

# Quarkus (in annotation)
```

---

### 3. Timeout

**Prevent hanging requests.**

**Quarkus:**
```java
@Timeout(value = 10000) // 10 seconds
```

**Spring Boot:**
```properties
api.client.read-timeout=10000
```

---

### 4. Fallback Methods

**Graceful degradation** when service is unavailable.

**Spring Boot:**
```java
private Mono<Object> methodFallback(Params..., Exception ex) {
    log.warn("Fallback triggered: {}", ex.getMessage());
    return Mono.error(new ApiClientException("Service unavailable", ex));
}
```

**Quarkus:**
```java
default Uni<Object> methodFallback(Params...) {
    return Uni.createFrom().failure(new RuntimeException("Service unavailable"));
}
```

---

## 📊 Comparison: Spring Boot vs Quarkus Clients

| Feature | Spring Boot | Quarkus |
|---------|-------------|---------|
| **HTTP Client** | WebClient (reactive) or RestTemplate | MicroProfile REST Client |
| **Programming Model** | Class-based | Interface-based |
| **Reactive** | Mono/Flux (Project Reactor) | Uni/Multi (Mutiny) |
| **Resilience** | Resilience4j | SmallRye Fault Tolerance |
| **Circuit Breaker** | ✅ Annotation-based | ✅ Annotation-based |
| **Retry** | ✅ Annotation-based | ✅ Annotation-based |
| **Timeout** | ✅ Configuration | ✅ Annotation-based |
| **Fallback** | ✅ Method-based | ✅ Default methods |
| **Type Safety** | ✅ Compile-time | ✅ Compile-time |
| **Logging** | ✅ Built-in | ✅ Filter-based |

---

## 🏆 Best Practices

### 1. Use Circuit Breakers

Always enable circuit breakers to prevent cascading failures:

```java
@CircuitBreaker(name = "apiClient", fallbackMethod = "fallback")
```

### 2. Configure Timeouts

Set appropriate timeouts for your use case:

```properties
# Short timeout for fast operations
api.client.read-timeout=2000

# Longer timeout for complex operations
api.client.read-timeout=30000
```

### 3. Implement Fallbacks

Always provide fallback methods for graceful degradation:

```java
private Mono<Object> fallback(Exception ex) {
    // Return cached data, default values, or error
    return Mono.just(DEFAULT_VALUE);
}
```

### 4. Monitor Client Calls

Enable metrics and logging:

```properties
# Spring Boot
management.endpoints.web.exposure.include=health,metrics,prometheus

# Quarkus
quarkus.micrometer.enabled=true
quarkus.log.category."org.eclipse.microprofile.rest.client".level=DEBUG
```

### 5. Version Your APIs

Use versioned packages and artifacts:

```java
package com.example.api.v1.client;
```

```xml
<artifactId>petstore-client-v1</artifactId>
```

---

## 🌐 Microservices Architecture Example

### Service A (Order Service) → Service B (Pet Service)

**1. Generate Pet Service API:**
```bash
openapi-redux-gen generate-spring \
  -i petstore-api.yaml \
  -o ./pet-service
```

**2. Generate Pet Service Client:**
```bash
openapi-redux-gen generate-spring-client \
  -i petstore-api.yaml \
  -o ./petstore-client
```

**3. Use Client in Order Service:**
```java
@Service
@RequiredArgsConstructor
public class OrderService {

    private final PetsClient petsClient;

    public Mono<Order> createOrder(CreateOrderRequest request) {
        // Call Pet Service to validate pet exists
        return petsClient.getPetById(request.getPetId())
            .flatMap(pet -> {
                // Create order
                Order order = Order.builder()
                    .petId(pet.getId())
                    .petName(pet.getName())
                    .quantity(request.getQuantity())
                    .build();

                return orderRepository.save(order);
            });
    }
}
```

---

## 🐞 Troubleshooting

### Circuit Breaker Opens Too Quickly

Increase thresholds:

```properties
# Spring Boot
resilience4j.circuitbreaker.instances.apiClient.minimumNumberOfCalls=10
resilience4j.circuitbreaker.instances.apiClient.failureRateThreshold=50
```

### Timeout Issues

Increase timeouts:

```properties
api.client.read-timeout=30000
```

### Connection Refused

Check service URL and network:

```bash
curl http://petstore-service:8080/health
```

### Quarkus Client Not Found

Make sure @RegisterRestClient annotation is present and service URL is configured:

```properties
quarkus.rest-client."pet-store-api".url=http://localhost:8080
```

---

## 📚 Related Documentation

- [JAVA_GENERATORS.md](./JAVA_GENERATORS.md) - Spring Boot & Quarkus server generation
- [SPRING_VS_QUARKUS_COMPARISON.md](./SPRING_VS_QUARKUS_COMPARISON.md) - Server comparison
- [USAGE_GUIDE.md](./USAGE_GUIDE.md) - Complete CLI usage guide

---

## 🚀 Advanced Examples

### Custom Error Handling

**Spring Boot:**
```java
@Component
public class PetsClientWrapper {

    private final PetsClient client;

    public Mono<Pet> getPetWithErrorHandling(String petId) {
        return client.getPetById(petId)
            .onErrorResume(ApiClientException.class, ex -> {
                if (ex.getStatusCode() == 404) {
                    return Mono.empty();
                }
                return Mono.error(ex);
            });
    }
}
```

**Quarkus:**
```java
@ApplicationScoped
public class PetsClientWrapper {

    @Inject
    @RestClient
    PetsClient client;

    public Uni<Pet> getPetWithErrorHandling(String petId) {
        return client.getPetById(petId)
            .onFailure(ApiClientException.class)
            .recoverWithUni(ex -> {
                if (ex.getStatusCode() == 404) {
                    return Uni.createFrom().nullItem();
                }
                return Uni.createFrom().failure(ex);
            });
    }
}
```

---

**Generate type-safe clients for seamless microservices communication! 🎉**
