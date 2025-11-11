package com.testapi.client.filter;

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
        "Accept-Language",
        "Authorization",
        "X-API-Version",
        "X-Client-ID",
        "X-Correlation-ID",
        "X-Forwarded-For",
        "X-Forwarded-Host",
        "X-Forwarded-Proto",
        "X-Request-ID",
        "X-Tenant-ID",
        "X-Trace-ID"
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
