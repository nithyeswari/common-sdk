
# Spring Boot & Quarkus Generators

Generate production-ready Java backend APIs from OpenAPI specifications with comprehensive cross-cutting concerns.

## 🚀 Quick Start

### Spring Boot

```bash
openapi-redux-gen generate-spring \
  -i petstore.yaml \
  -o ./spring-petstore \
  -p com.example.petstore \
  -g com.example \
  -a petstore-api
```

### Quarkus

```bash
openapi-redux-gen generate-quarkus \
  -i petstore.yaml \
  -o ./quarkus-petstore \
  -p com.example.petstore \
  -g com.example \
  -a petstore-api \
  --reactive
```

---

## Features

### Spring Boot 3.x

✅ **Modern REST Controllers** with `@RestController`
✅ **Bean Validation** with Jakarta Validation
✅ **OpenAPI/Swagger** UI auto-configured
✅ **Actuator** for health checks and metrics
✅ **Prometheus** metrics export
✅ **AOP** for logging and monitoring
✅ **Global Exception Handling** with `@ControllerAdvice`
✅ **Structured Logging** with Logback
✅ **Java 17-21** support with Records
✅ **Virtual Threads** ready (Java 21)

### Quarkus 3.x

✅ **JAX-RS Resources** with `@Path`
✅ **Reactive/Non-reactive** options (Mutiny)
✅ **SmallRye OpenAPI** auto-configured
✅ **MicroProfile Health** checks
✅ **Micrometer** metrics
✅ **CDI** dependency injection
✅ **Exception Mappers** for error handling
✅ **Native compilation** ready (GraalVM)
✅ **Startup time** < 1 second
✅ **Memory footprint** < 100MB

---

## Generated Project Structure

### Spring Boot

```
spring-petstore/
├── pom.xml
├── src/
│   ├── main/
│   │   ├── java/com/example/petstore/
│   │   │   ├── Application.java              # Main class
│   │   │   ├── controller/
│   │   │   │   └── PetController.java        # REST controllers
│   │   │   ├── service/
│   │   │   │   └── PetService.java           # Business logic
│   │   │   ├── dto/
│   │   │   │   ├── Pet.java                  # DTOs with validation
│   │   │   │   └── ...
│   │   │   ├── exception/
│   │   │   │   ├── GlobalExceptionHandler.java
│   │   │   │   ├── ErrorResponse.java
│   │   │   │   └── ResourceNotFoundException.java
│   │   │   ├── config/
│   │   │   │   ├── ApplicationConfig.java    # OpenAPI, CORS config
│   │   │   │   └── MonitoringConfig.java     # Micrometer config
│   │   │   └── aspect/
│   │   │       └── LoggingAspect.java        # AOP logging
│   │   └── resources/
│   │       └── application.properties
│   └── test/
│       └── java/com/example/petstore/
└── target/
```

### Quarkus

```
quarkus-petstore/
├── pom.xml
├── src/
│   ├── main/
│   │   ├── java/com/example/petstore/
│   │   │   ├── resource/
│   │   │   │   └── PetResource.java          # JAX-RS resources
│   │   │   ├── service/
│   │   │   │   └── PetService.java           # Business logic
│   │   │   ├── model/
│   │   │   │   ├── Pet.java                  # Models with validation
│   │   │   │   └── ...
│   │   │   ├── exception/
│   │   │   │   ├── GlobalExceptionMapper.java
│   │   │   │   └── ErrorResponse.java
│   │   │   ├── health/
│   │   │   │   └── HealthChecks.java         # Health endpoints
│   │   │   ├── config/
│   │   │   │   └── MonitoringConfig.java     # Metrics config
│   │   │   └── interceptor/
│   │   │       └── LoggingInterceptor.java   # CDI interceptors
│   │   └── resources/
│   │       └── application.properties
│   └── test/
│       └── java/com/example/petstore/
└── target/
```

---

## CLI Commands

### Spring Boot

```bash
openapi-redux-gen generate-spring [options]

Required:
  -i, --input <path>              OpenAPI spec file
  -o, --output <path>             Output directory

Optional:
  -p, --package <name>            Java package (default: com.example.api)
  -g, --group-id <id>             Maven group ID (default: com.example)
  -a, --artifact-id <id>          Maven artifact ID (default: api-service)
  -v, --version <version>         Version (default: 1.0.0)
  --java-version <version>        Java version (default: 21)
  --spring-boot-version <version> Spring Boot version (default: 3.2.0)
```

### Quarkus

```bash
openapi-redux-gen generate-quarkus [options]

Required:
  -i, --input <path>              OpenAPI spec file
  -o, --output <path>             Output directory

Optional:
  -p, --package <name>            Java package (default: com.example.api)
  -g, --group-id <id>             Maven group ID (default: com.example)
  -a, --artifact-id <id>          Maven artifact ID (default: api-service)
  -v, --version <version>         Version (default: 1.0.0)
  --java-version <version>        Java version (default: 21)
  --quarkus-version <version>     Quarkus version (default: 3.6.0)
  --reactive                      Generate reactive code with Mutiny
```

---

## Examples

### 1. Spring Boot with Defaults

```bash
openapi-redux-gen generate-spring \
  -i petstore.yaml \
  -o ./spring-api
```

### 2. Spring Boot with Custom Settings

```bash
openapi-redux-gen generate-spring \
  -i petstore.yaml \
  -o ./my-api \
  -p com.mycompany.api \
  -g com.mycompany \
  -a my-awesome-api \
  -v 2.0.0 \
  --java-version 21 \
  --spring-boot-version 3.2.1
```

### 3. Quarkus Non-Reactive

```bash
openapi-redux-gen generate-quarkus \
  -i petstore.yaml \
  -o ./quarkus-api \
  -p com.example.api
```

### 4. Quarkus Reactive with Mutiny

```bash
openapi-redux-gen generate-quarkus \
  -i petstore.yaml \
  -o ./quarkus-api \
  -p com.example.api \
  --reactive
```

---

## Generated Code Features

### 1. REST Controllers/Resources

**Spring Boot:**
```java
@RestController
@RequestMapping("/pets")
@Validated
public class PetController {

    @GetMapping
    public ResponseEntity<List<Pet>> getPets(
        @RequestParam(required = false) Integer limit
    ) {
        var result = service.getPets(limit);
        return ResponseEntity.ok(result);
    }

    @PostMapping
    public ResponseEntity<Pet> createPet(
        @Valid @RequestBody Pet pet
    ) {
        var result = service.createPet(pet);
        return ResponseEntity.ok(result);
    }
}
```

**Quarkus (Non-Reactive):**
```java
@Path("/pets")
public class PetResource {

    @GET
    public Response getPets(@QueryParam("limit") Integer limit) {
        var result = service.getPets(limit);
        return Response.ok(result).build();
    }

    @POST
    public Response createPet(@Valid Pet pet) {
        var result = service.createPet(pet);
        return Response.ok(result).build();
    }
}
```

**Quarkus (Reactive with Mutiny):**
```java
@Path("/pets")
public class PetResource {

    @GET
    public Uni<Response> getPets(@QueryParam("limit") Integer limit) {
        return service.getPets(limit)
            .onItem().transform(result -> Response.ok(result).build());
    }

    @POST
    public Uni<Response> createPet(@Valid Pet pet) {
        return service.createPet(pet)
            .onItem().transform(result -> Response.ok(result).build());
    }
}
```

### 2. DTOs with Validation

```java
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Pet {
    @NotNull(message = "id is required")
    @JsonProperty("id")
    private Long id;

    @NotNull(message = "name is required")
    @Size(min = 1, max = 100)
    @JsonProperty("name")
    private String name;

    @Pattern(regexp = "available|pending|sold")
    @JsonProperty("status")
    private String status;

    @Email
    @JsonProperty("contactEmail")
    private String contactEmail;
}
```

### 3. Global Exception Handling

**Spring Boot:**
```java
@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(MethodArgumentNotValidException.class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    public ResponseEntity<ErrorResponse> handleValidation(
        MethodArgumentNotValidException ex
    ) {
        Map<String, String> errors = new HashMap<>();
        ex.getBindingResult().getFieldErrors()
            .forEach(e -> errors.put(e.getField(), e.getDefaultMessage()));

        return ResponseEntity.badRequest().body(
            ErrorResponse.builder()
                .status(400)
                .error("Validation Failed")
                .errors(errors)
                .build()
        );
    }
}
```

**Quarkus:**
```java
@Provider
public class GlobalExceptionMapper implements ExceptionMapper<Exception> {

    @Override
    public Response toResponse(Exception exception) {
        ErrorResponse error = ErrorResponse.builder()
            .status(500)
            .error("Internal Server Error")
            .message(exception.getMessage())
            .build();

        return Response.serverError().entity(error).build();
    }
}
```

### 4. Logging & Monitoring

**Spring Boot (AOP):**
```java
@Aspect
@Component
public class LoggingAspect {

    @Around("execution(* com.example.controller..*(..))")
    public Object logControllerMethods(ProceedingJoinPoint joinPoint) {
        log.debug("Entering: {}", joinPoint.getSignature());
        long start = System.currentTimeMillis();

        Object result = joinPoint.proceed();

        long duration = System.currentTimeMillis() - start;
        log.debug("Duration: {}ms", duration);

        return result;
    }
}
```

**Quarkus (Interceptor):**
```java
@Logged
@Interceptor
class LoggingInterceptor {

    @AroundInvoke
    public Object logInvocation(InvocationContext context) throws Exception {
        log.debug("Entering: {}", context.getMethod().getName());
        long start = System.currentTimeMillis();

        Object result = context.proceed();

        long duration = System.currentTimeMillis() - start;
        log.debug("Duration: {}ms", duration);

        return result;
    }
}
```

---

## Running the Generated Projects

### Spring Boot

```bash
cd spring-petstore

# Development mode
mvn spring-boot:run

# Build JAR
mvn clean package

# Run JAR
java -jar target/petstore-api-1.0.0.jar

# Access
http://localhost:8080
http://localhost:8080/swagger-ui.html       # Swagger UI
http://localhost:8080/actuator/health       # Health check
http://localhost:8080/actuator/prometheus   # Metrics
```

### Quarkus

```bash
cd quarkus-petstore

# Development mode (with live reload)
mvn quarkus:dev

# Build
mvn clean package

# Run JAR
java -jar target/quarkus-app/quarkus-run.jar

# Build native image (requires GraalVM)
mvn clean package -Pnative

# Run native executable
./target/petstore-api-1.0.0-runner

# Access
http://localhost:8080
http://localhost:8080/swagger-ui           # Swagger UI
http://localhost:8080/q/health             # Health check
http://localhost:8080/q/metrics            # Metrics
```

---

## Configuration

### Spring Boot (application.properties)

```properties
server.port=8080
spring.application.name=api-service

# Logging
logging.level.root=INFO
logging.level.com.example=DEBUG

# Actuator
management.endpoints.web.exposure.include=health,metrics,prometheus

# OpenAPI
springdoc.api-docs.path=/api-docs
springdoc.swagger-ui.path=/swagger-ui.html
```

### Quarkus (application.properties)

```properties
quarkus.http.port=8080
quarkus.application.name=api-service

# Logging
quarkus.log.level=INFO
quarkus.log.console.json=false

# OpenAPI
quarkus.smallrye-openapi.path=/openapi
quarkus.swagger-ui.path=/swagger-ui

# Health & Metrics
quarkus.smallrye-health.ui.always-include=true
quarkus.micrometer.enabled=true
```

---

## Deployment

### Docker (Spring Boot)

```dockerfile
FROM eclipse-temurin:21-jre
COPY target/*.jar app.jar
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "/app.jar"]
```

```bash
docker build -t my-api .
docker run -p 8080:8080 my-api
```

### Docker (Quarkus Native)

```dockerfile
FROM registry.access.redhat.com/ubi8/ubi-minimal
WORKDIR /work/
COPY target/*-runner /work/application
RUN chmod 775 /work
EXPOSE 8080
CMD ["./application", "-Dquarkus.http.host=0.0.0.0"]
```

```bash
docker build -t my-api-native .
docker run -p 8080:8080 my-api-native
```

---

## Performance Comparison

| Metric | Spring Boot | Quarkus JVM | Quarkus Native |
|--------|-------------|-------------|----------------|
| **Startup Time** | 3-5s | 1-2s | 0.05s |
| **Memory (RSS)** | 200-400MB | 100-200MB | 50-100MB |
| **First Response** | 3-5s | 1-2s | < 0.1s |
| **Throughput** | High | High | Very High |
| **Build Time** | Fast | Fast | Slow (5-10min) |
| **Container Size** | 300-500MB | 300-500MB | 100-200MB |

---

## Best Practices

### Spring Boot

1. ✅ Use `@RestController` for REST APIs
2. ✅ Enable validation with `@Validated`
3. ✅ Use DTOs for request/response
4. ✅ Implement global exception handling
5. ✅ Enable Actuator for monitoring
6. ✅ Use AOP for cross-cutting concerns
7. ✅ Configure logging properly
8. ✅ Use virtual threads (Java 21)

### Quarkus

1. ✅ Use `@Path` for REST resources
2. ✅ Choose reactive vs non-reactive based on needs
3. ✅ Implement health checks
4. ✅ Use CDI for dependency injection
5. ✅ Enable Micrometer metrics
6. ✅ Consider native compilation for production
7. ✅ Use interceptors for AOP
8. ✅ Optimize for startup time

---

## Comparison: Spring Boot vs Quarkus

| Feature | Spring Boot | Quarkus |
|---------|-------------|---------|
| **Learning Curve** | Moderate | Low-Moderate |
| **Ecosystem** | Very Large | Growing Fast |
| **Cloud Native** | Good | Excellent |
| **Reactive** | Optional | Built-in |
| **Native Compilation** | Limited | Excellent |
| **Memory Usage** | Higher | Lower |
| **Startup Time** | Slower | Faster |
| **Maturity** | Very Mature | Maturing |
| **Community** | Huge | Growing |
| **Enterprise Support** | Excellent | Good |

---

## When to Use What?

### Use Spring Boot if:
- ✅ Large existing Spring ecosystem
- ✅ Enterprise applications
- ✅ Traditional JVM deployment
- ✅ Need mature ecosystem
- ✅ Team knows Spring already

### Use Quarkus if:
- ✅ Cloud-native/Kubernetes
- ✅ Microservices architecture
- ✅ Need fast startup
- ✅ Want low memory footprint
- ✅ Serverless/FaaS deployments
- ✅ Native compilation is priority

---

## Troubleshooting

### Spring Boot

**Port already in use:**
```properties
server.port=8081
```

**Validation not working:**
```xml
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-validation</artifactId>
</dependency>
```

### Quarkus

**Dev mode not starting:**
```bash
mvn clean quarkus:dev
```

**Native build fails:**
```bash
# Check GraalVM installation
java -version

# Use container build
mvn clean package -Pnative -Dquarkus.native.container-build=true
```

---

## Next Steps

1. **Generate your first project**
2. **Run in dev mode**
3. **Implement business logic**
4. **Add database (JPA/Hibernate)**
5. **Add security (Spring Security/Quarkus Security)**
6. **Deploy to cloud**

---

## See Also

- [Spring Boot Documentation](https://spring.io/projects/spring-boot)
- [Quarkus Documentation](https://quarkus.io/guides/)
- [OpenAPI Specification](https://swagger.io/specification/)
- [IMPLEMENTATION_GUIDE.md](./IMPLEMENTATION_GUIDE.md) - React/TypeScript guide

---

**Happy coding with Spring Boot and Quarkus! 🚀**
