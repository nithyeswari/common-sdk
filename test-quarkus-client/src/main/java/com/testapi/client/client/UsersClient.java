package com.testapi.client.client;

import com.testapi.client.model.*;
import com.testapi.client.filter.HeaderPropagationFactory;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;
import org.eclipse.microprofile.rest.client.inject.RegisterRestClient;
import org.eclipse.microprofile.rest.client.annotation.RegisterClientHeaders;
import org.eclipse.microprofile.faulttolerance.*;

import java.util.List;

/**
 * MicroProfile REST Client for Users operations
 * Generated from OpenAPI specification
 *
 * Automatic header propagation enabled via HeaderPropagationFactory
 */
@RegisterRestClient(configKey = "test-api")
@RegisterClientHeaders(HeaderPropagationFactory.class)
@Path("/")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public interface UsersClient {

    /**
     * List all users
     * 
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
    @Fallback(fallbackMethod = "listUsersFallback")
    @GET
    @Path("/users")
    Object listUsers(@QueryParam("limit") Long limit, @HeaderParam("X-API-Version") String xAPIVersion, @HeaderParam("X-Client-ID") String xClientID);

    /**
     * Fallback for listUsers
     */
    default Object listUsersFallback(Long limit, String xAPIVersion, String xClientID) {
        throw new RuntimeException("Service unavailable");
    }

    /**
     * Get user by ID
     * 
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
    @Fallback(fallbackMethod = "getUserByIdFallback")
    @GET
    @Path("/users/{id}")
    Object getUserById(@PathParam("id") String id, @HeaderParam("X-Tenant-ID") String xTenantID);

    /**
     * Fallback for getUserById
     */
    default Object getUserByIdFallback(String id, String xTenantID) {
        throw new RuntimeException("Service unavailable");
    }

}
