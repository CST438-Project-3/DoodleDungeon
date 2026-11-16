package com.example.doodledungeon;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/auth")
public class AuthController {
    private final OAuthService oauthService;

    public AuthController(OAuthService oauthService) {
        this.oauthService = oauthService;
    }

    @PostMapping("/github")
    public AuthResponse github(@RequestBody LoginRequest request) {
        return oauthService.authenticate("github", request);
    }

    @PostMapping("/google")
    public AuthResponse google(@RequestBody LoginRequest request) {
        return oauthService.authenticate("google", request);
    }

    public record LoginRequest(
            String code,
            String redirectUri,
            String codeVerifier,
            String clientId
    ) {
        public LoginRequest {
            if (code == null || code.isBlank()) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "code is required");
            }
        }
    }

    public record AuthResponse(String token, UserResponse user) {}

    public record UserResponse(
            String id,
            String email,
            String display_name,
            String avatar_url
    ) {}
}
