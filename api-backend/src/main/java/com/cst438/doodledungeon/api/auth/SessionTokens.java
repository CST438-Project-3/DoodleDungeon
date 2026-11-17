package com.cst438.doodledungeon.api.auth;

import com.nimbusds.jose.jwk.source.ImmutableSecret;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.oauth2.core.DelegatingOAuth2TokenValidator;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.*;

@Configuration
public class SessionTokens {
    private final NimbusJwtEncoder encoder;
    private final SecretKeySpec key;
    private final long ttl;

    public SessionTokens(@Value("${app.jwt-secret}") String secret,
                         @Value("${app.jwt-ttl-seconds:3600}") long ttl) {
        if (secret.getBytes(StandardCharsets.UTF_8).length < 32 || ttl < 1) {
            throw new IllegalArgumentException("APP_JWT_SECRET must be at least 32 bytes and token TTL must be positive");
        }
        this.key = new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256");
        this.encoder = new NimbusJwtEncoder(new ImmutableSecret<>(key));
        this.ttl = ttl;
    }

    public String issue(String userId) {
        Instant now = Instant.now();
        JwtClaimsSet claims = JwtClaimsSet.builder().issuer("doodledungeon").subject(userId)
                .issuedAt(now).expiresAt(now.plusSeconds(ttl)).build();
        return encoder.encode(JwtEncoderParameters.from(
                JwsHeader.with(MacAlgorithm.HS256).build(), claims)).getTokenValue();
    }

    @Bean
    JwtDecoder jwtDecoder() {
        NimbusJwtDecoder decoder = NimbusJwtDecoder.withSecretKey(key).macAlgorithm(MacAlgorithm.HS256).build();
        decoder.setJwtValidator(new DelegatingOAuth2TokenValidator<>(
                new JwtTimestampValidator(Duration.ZERO), new JwtIssuerValidator("doodledungeon")));
        return decoder;
    }
}
