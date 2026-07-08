package com.beecompete.platform.web;

/**
 * Minimal wiring-check payload returned by {@link PingController}.
 *
 * @param status  always {@code "ok"} when the API is serving requests
 * @param service the service name
 * @param message a greeting echoing the (validated) request parameter
 */
public record PingResponse(String status, String service, String message) {}
