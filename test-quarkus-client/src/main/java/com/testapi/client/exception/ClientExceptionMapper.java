package com.testapi.client.exception;

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
