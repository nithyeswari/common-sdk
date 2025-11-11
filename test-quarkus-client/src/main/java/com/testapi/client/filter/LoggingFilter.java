package com.testapi.client.filter;

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
