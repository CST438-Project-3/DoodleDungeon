package com.cst438.doodledungeon.api;

/** Error body shared with the OpenAPI ErrorResponse schema. */
public record ApiErrorResponse(String error, String message) {
}
