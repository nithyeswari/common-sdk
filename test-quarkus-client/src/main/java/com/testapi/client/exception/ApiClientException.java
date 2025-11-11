package com.testapi.client.exception;

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
