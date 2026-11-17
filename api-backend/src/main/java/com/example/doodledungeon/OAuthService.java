package com.example.doodledungeon;

import com.example.doodledungeon.AuthController.AuthResponse;
import com.example.doodledungeon.AuthController.LoginRequest;
import com.example.doodledungeon.AuthController.UserResponse;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestClient;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.Base64;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;

import static org.springframework.http.HttpStatus.BAD_REQUEST;
import static org.springframework.http.HttpStatus.UNAUTHORIZED;

@Service
public class OAuthService {
    private final RestClient restClient = RestClient.create();
    private final ObjectMapper objectMapper;
    private final String githubClientId;
    private final String githubClientSecret;
    private final String githubAndroidClientId;
    private final String githubAndroidClientSecret;
    private final String googleClientId;
    private final String googleClientSecret;
    private final String googleAndroidClientId;
    private final String googleAndroidClientSecret;
    private final String jwtSecret;
    private final long jwtTtlSeconds;
    private final java.util.Set<String> allowedRedirectUris;
    private final Map<String, UserResponse> users = new ConcurrentHashMap<>();

    public OAuthService(
            ObjectMapper objectMapper,
            @Value("${oauth.github.client-id}") String githubClientId,
            @Value("${oauth.github.client-secret}") String githubClientSecret,
            @Value("${oauth.github.android-client-id}") String githubAndroidClientId,
            @Value("${oauth.github.android-client-secret}") String githubAndroidClientSecret,
            @Value("${oauth.google.client-id}") String googleClientId,
            @Value("${oauth.google.client-secret}") String googleClientSecret,
            @Value("${oauth.google.android-client-id}") String googleAndroidClientId,
            @Value("${oauth.google.android-client-secret}") String googleAndroidClientSecret,
            @Value("${app.jwt-secret}") String jwtSecret,
            @Value("${app.jwt-ttl-seconds}") long jwtTtlSeconds,
            @Value("${oauth.allowed-redirect-uris}") String allowedRedirectUris
    ) {
        this.objectMapper = objectMapper;
        this.githubClientId = githubClientId;
        this.githubClientSecret = githubClientSecret;
        this.githubAndroidClientId = githubAndroidClientId;
        this.githubAndroidClientSecret = githubAndroidClientSecret;
        this.googleClientId = googleClientId;
        this.googleClientSecret = googleClientSecret;
        this.googleAndroidClientId = googleAndroidClientId;
        this.googleAndroidClientSecret = googleAndroidClientSecret;
        this.jwtSecret = jwtSecret;
        this.jwtTtlSeconds = jwtTtlSeconds;
        this.allowedRedirectUris = java.util.Arrays.stream(allowedRedirectUris.split(","))
                .map(String::trim)
                .filter(uri -> !uri.isBlank())
                .collect(java.util.stream.Collectors.toUnmodifiableSet());
    }

    public AuthResponse authenticate(String provider, LoginRequest request) {
        validateConfiguration(provider, request);
        validateRedirectUri(request.redirectUri());
        UserResponse user = "github".equals(provider)
                ? exchangeGithub(request)
                : exchangeGoogle(request);
        users.put(provider + ":" + user.id(), user);
        return new AuthResponse(createJwt(provider, user), user);
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

    private String createJwt(String provider, UserResponse user) {
        try {
            long now = Instant.now().getEpochSecond();
            String header = encode("{\"alg\":\"HS256\",\"typ\":\"JWT\"}");
            String payload = encode(objectMapper.writeValueAsString(Map.of(
                    "sub", user.id(),
                    "provider", provider,
                    "iat", now,
                    "exp", now + jwtTtlSeconds
            )));
            String unsigned = header + "." + payload;
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(jwtSecret.getBytes(java.nio.charset.StandardCharsets.UTF_8), "HmacSHA256"));
            return unsigned + "." + Base64.getUrlEncoder().withoutPadding().encodeToString(mac.doFinal(unsigned.getBytes(java.nio.charset.StandardCharsets.UTF_8)));
        } catch (Exception exception) {
            throw new IllegalStateException("Unable to issue session token", exception);
        }
    }

    private void validateConfiguration(String provider, LoginRequest request) {
        if (request.clientId() == null || request.clientId().isBlank()) {
            throw new ResponseStatusException(BAD_REQUEST, "clientId is required");
        }
        ProviderCredentials credentials = credentials(provider, request.clientId());
        if (credentials.clientId().isBlank()
                || ("github".equals(provider) && credentials.secret().isBlank())) {
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
            if (githubAndroidClientId.equals(clientId)) {
                return new ProviderCredentials(githubAndroidClientId, githubAndroidClientSecret);
            }
        } else {
            if (googleClientId.equals(clientId)) {
                return new ProviderCredentials(googleClientId, googleClientSecret);
            }
            if (googleAndroidClientId.equals(clientId)) {
                return new ProviderCredentials(googleAndroidClientId, googleAndroidClientSecret);
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

    private static String encode(String value) {
        return Base64.getUrlEncoder().withoutPadding().encodeToString(value.getBytes(java.nio.charset.StandardCharsets.UTF_8));
    }
}
