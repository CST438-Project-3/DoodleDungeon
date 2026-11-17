package com.cst438.doodledungeon.api.auth;

import com.cst438.doodledungeon.api.auth.AuthController.AuthResponse;
import com.cst438.doodledungeon.api.auth.AuthController.LoginRequest;
import com.cst438.doodledungeon.api.auth.AuthController.UserResponse;
import tools.jackson.databind.JsonNode;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestClient;
import org.springframework.web.server.ResponseStatusException;


import static org.springframework.http.HttpStatus.BAD_REQUEST;
import static org.springframework.http.HttpStatus.UNAUTHORIZED;

@Service
public class OAuthService {
    private final RestClient restClient;
    private final String githubClientId;
    private final String githubClientSecret;
    private final String googleClientId;
    private final String googleClientSecret;
    private final java.util.Set<String> allowedRedirectUris;
    private final AuthUserRepository users;
    private final SessionTokens tokens;

    public OAuthService(
            RestClient.Builder restClientBuilder,
            AuthUserRepository users,
            SessionTokens tokens,
            @Value("${oauth.github.client-id}") String githubClientId,
            @Value("${oauth.github.client-secret}") String githubClientSecret,
            @Value("${oauth.google.client-id}") String googleClientId,
            @Value("${oauth.google.client-secret}") String googleClientSecret,
            @Value("${oauth.allowed-redirect-uris}") String allowedRedirectUris
    ) {
        this.restClient = restClientBuilder.build();
        this.users = users;
        this.tokens = tokens;
        this.githubClientId = githubClientId;
        this.githubClientSecret = githubClientSecret;
        this.googleClientId = googleClientId;
        this.googleClientSecret = googleClientSecret;
        this.allowedRedirectUris = java.util.Arrays.stream(allowedRedirectUris.split(","))
                .map(String::trim)
                .filter(uri -> !uri.isBlank())
                .collect(java.util.stream.Collectors.toUnmodifiableSet());
    }

    public AuthResponse authenticate(String provider, LoginRequest request) {
        validateConfiguration(provider, request);
        validateRedirectUri(request.redirectUri());
        UserResponse user;
        try {
            user = "github".equals(provider) ? exchangeGithub(request) : exchangeGoogle(request);
        } catch (org.springframework.web.client.RestClientException exception) {
            throw new ResponseStatusException(UNAUTHORIZED, "Unable to read the OAuth profile", exception);
        }
        UserResponse savedUser = users.findOrCreate(provider, user);
        return new AuthResponse(tokens.issue(savedUser.id()), savedUser);
    }

    private UserResponse exchangeGithub(LoginRequest request) {
        ProviderCredentials credentials = credentials("github", request.clientId());
        JsonNode token = postForm(
                "https://github.com/login/oauth/access_token",
                form("client_id", credentials.clientId(),
                        "client_secret", credentials.secret(),
                        "code", request.code(),
                        "redirect_uri", request.redirectUri()),
                MediaType.APPLICATION_JSON
        );
        String accessToken = required(token, "access_token");
        JsonNode profile = restClient.get()
                .uri("https://api.github.com/user")
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                .header(HttpHeaders.ACCEPT, "application/vnd.github+json")
                .retrieve()
                .body(JsonNode.class);
        return new UserResponse(
                required(profile, "id"),
                optional(profile, "email"),
                optional(profile, "name", optional(profile, "login")),
                optional(profile, "avatar_url")
        );
    }

    private UserResponse exchangeGoogle(LoginRequest request) {
        ProviderCredentials credentials = credentials("google", request.clientId());
        JsonNode token = postForm(
                "https://oauth2.googleapis.com/token",
                form("client_id", credentials.clientId(),
                        "client_secret", credentials.secret(),
                        "code", request.code(),
                        "redirect_uri", request.redirectUri(),
                        "grant_type", "authorization_code",
                        "code_verifier", request.codeVerifier()),
                MediaType.APPLICATION_JSON
        );
        String accessToken = required(token, "access_token");
        JsonNode profile = restClient.get()
                .uri("https://openidconnect.googleapis.com/v1/userinfo")
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                .retrieve()
                .body(JsonNode.class);
        return new UserResponse(
                required(profile, "sub"),
                optional(profile, "email"),
                optional(profile, "name", optional(profile, "email")),
                optional(profile, "picture")
        );
    }

    private JsonNode postForm(String uri, MultiValueMap<String, String> form, MediaType accept) {
        try {
            return restClient.post()
                    .uri(uri)
                    .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                    .accept(accept)
                    .body(form)
                    .retrieve()
                    .body(JsonNode.class);
        } catch (Exception exception) {
            throw new ResponseStatusException(UNAUTHORIZED, "OAuth provider rejected the authorization code", exception);
        }
    }

    private void validateConfiguration(String provider, LoginRequest request) {
        if (request.clientId() == null || request.clientId().isBlank()) {
            throw new ResponseStatusException(BAD_REQUEST, "clientId is required");
        }
        ProviderCredentials credentials = credentials(provider, request.clientId());
        if (credentials.clientId().isBlank()
                || credentials.secret().isBlank()) {
            throw new ResponseStatusException(UNAUTHORIZED, provider + " OAuth is not configured on the server");
        }
        if ("google".equals(provider) && (request.codeVerifier() == null || request.codeVerifier().isBlank())) {
            throw new ResponseStatusException(BAD_REQUEST, "codeVerifier is required for Google OAuth");
        }
    }

    private ProviderCredentials credentials(String provider, String clientId) {
        if ("github".equals(provider)) {
            if (githubClientId.equals(clientId)) {
                return new ProviderCredentials(githubClientId, githubClientSecret);
            }
        } else {
            if (googleClientId.equals(clientId)) {
                return new ProviderCredentials(googleClientId, googleClientSecret);
            }
        }
        throw new ResponseStatusException(UNAUTHORIZED, "OAuth client ID is not configured on the server");
    }

    private record ProviderCredentials(String clientId, String secret) {}

    private void validateRedirectUri(String redirectUri) {
        if (redirectUri == null || !allowedRedirectUris.contains(redirectUri)) {
            throw new ResponseStatusException(BAD_REQUEST, "redirectUri is not allowed");
        }
    }

    private static MultiValueMap<String, String> form(String... values) {
        LinkedMultiValueMap<String, String> form = new LinkedMultiValueMap<>();
        for (int i = 0; i < values.length; i += 2) {
            if (values[i + 1] != null && !values[i + 1].isBlank()) {
                form.add(values[i], values[i + 1]);
            }
        }
        return form;
    }

    private static String required(JsonNode node, String field) {
        String value = optional(node, field);
        if (value == null || value.isBlank()) {
            throw new ResponseStatusException(UNAUTHORIZED, "OAuth provider response is missing " + field);
        }
        return value;
    }

    private static String optional(JsonNode node, String field) {
        return node != null && node.hasNonNull(field) ? node.get(field).asText() : null;
    }

    private static String optional(JsonNode node, String field, String fallback) {
        String value = optional(node, field);
        return value == null || value.isBlank() ? fallback : value;
    }

}
