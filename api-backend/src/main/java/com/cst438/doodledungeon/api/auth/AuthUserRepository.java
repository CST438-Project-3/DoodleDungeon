package com.cst438.doodledungeon.api.auth;

import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;
import com.cst438.doodledungeon.api.auth.AuthController.UserResponse;

@Repository
public class AuthUserRepository {
    private final JdbcTemplate jdbc;

    public AuthUserRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @Transactional
    public UserResponse findOrCreate(String provider, UserResponse profile) {
        // Serialize simultaneous first logins for the same provider identity.
        jdbc.queryForList("SELECT pg_advisory_xact_lock(hashtextextended(?, 0))", provider + ":" + profile.id());
        var ids = jdbc.queryForList("SELECT user_id FROM auth_identities WHERE provider = ? AND provider_subject = ?",
                UUID.class, provider, profile.id());
        UUID userId;
        if (ids.isEmpty()) {
            userId = UUID.randomUUID();
            jdbc.update("INSERT INTO app_users (id, email, display_name, avatar_url) VALUES (?, ?, ?, ?)",
                    userId, profile.email(), profile.display_name(), profile.avatar_url());
            jdbc.update("INSERT INTO auth_identities (user_id, provider, provider_subject, provider_email) VALUES (?, ?, ?, ?)",
                    userId, provider, profile.id(), profile.email());
        } else {
            userId = ids.getFirst();
        }
        return jdbc.queryForObject("SELECT id, email, display_name, avatar_url FROM app_users WHERE id = ?",
                (rs, row) -> new UserResponse(rs.getString("id"), rs.getString("email"),
                        rs.getString("display_name"), rs.getString("avatar_url")), userId);
    }
}
