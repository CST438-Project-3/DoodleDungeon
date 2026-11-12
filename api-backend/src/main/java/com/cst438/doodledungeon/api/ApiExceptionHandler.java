package com.cst438.doodledungeon.api;

import org.springframework.http.HttpStatus;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.server.ResponseStatusException;

@RestControllerAdvice
public class ApiExceptionHandler {

    // This advice turns exceptions from any controller into JSON instead of Spring's default error page.
    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<ApiErrorResponse> handleStatus(ResponseStatusException exception) {
        // Keep the HTTP status chosen by the controller and return the matching OpenAPI error shape.
        HttpStatusCode status = exception.getStatusCode();
        return ResponseEntity.status(status).body(new ApiErrorResponse(
                errorCode(status),
                exception.getReason() == null ? "The request could not be completed" : exception.getReason()));
    }

    // Spring throws these before a controller method runs when JSON or a UUID path value cannot be read.
    @ExceptionHandler({HttpMessageNotReadableException.class, MethodArgumentTypeMismatchException.class})
    public ResponseEntity<ApiErrorResponse> handleInvalidRequest(Exception exception) {
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(new ApiErrorResponse("invalid_request", "The request contains invalid or missing data"));
    }

    // Convert HTTP status numbers to stable error codes clients can inspect.
    private String errorCode(HttpStatusCode status) {
        return switch (status.value()) {
            case 400 -> "invalid_request";
            case 401 -> "unauthorized";
            case 404 -> "not_found";
            default -> "request_failed";
        };
    }
}
