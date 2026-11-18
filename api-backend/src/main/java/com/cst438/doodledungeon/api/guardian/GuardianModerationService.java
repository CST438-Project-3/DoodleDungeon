package com.cst438.doodledungeon.api.guardian;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Instant;
import java.util.Arrays;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class GuardianModerationService {
    private final JdbcTemplate jdbc;
    private final Set<UUID> adminUserIds;

    public GuardianModerationService(
            JdbcTemplate jdbc,
            @Value("${app.admin-user-ids:}") String configuredAdminUserIds) {
        this.jdbc = jdbc;
        this.adminUserIds = Arrays.stream(configuredAdminUserIds.split(","))
                .map(String::trim)
                .filter(value -> !value.isEmpty())
                .map(UUID::fromString)
                .collect(Collectors.toUnmodifiableSet());
    }

    @Transactional(readOnly = true)
    public List<GuardianForModeration> listGuardians(UUID requestingUserId) {
        requireAdmin(requestingUserId);

        return jdbc.query("""
                SELECT id, owner_user_id, name, class_name, art_url, created_at
                FROM guardians
                ORDER BY created_at DESC, id
                """, this::mapGuardian);
    }

    @Transactional
    public void deleteGuardian(UUID requestingUserId, UUID guardianId) {
        requireAdmin(requestingUserId);

        int deletedRows = jdbc.update(
                "DELETE FROM guardians WHERE id = ?",
                guardianId);

        if (deletedRows == 0) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Guardian not found.");
        }
    }

    private void requireAdmin(UUID requestingUserId) {
        boolean userExists = Boolean.TRUE.equals(jdbc.queryForObject(
                "SELECT EXISTS (SELECT 1 FROM app_users WHERE id = ?)",
                Boolean.class,
                requestingUserId));

        if (!userExists) {
            throw new ResponseStatusException(
                    HttpStatus.UNAUTHORIZED,
                    "Please sign in again.");
        }

        if (!adminUserIds.contains(requestingUserId)) {
            throw new ResponseStatusException(
                    HttpStatus.FORBIDDEN,
                    "Admin access is required.");
        }
    }

    private GuardianForModeration mapGuardian(ResultSet resultSet, int row) throws SQLException {
        return new GuardianForModeration(
                resultSet.getObject("id", UUID.class),
                resultSet.getObject("owner_user_id", UUID.class),
                resultSet.getString("name"),
                resultSet.getString("class_name"),
                resultSet.getString("art_url"),
                resultSet.getTimestamp("created_at").toInstant());
    }

    public record GuardianForModeration(
            UUID id,
            UUID ownerUserId,
            String name,
            String guardianClass,
            String artUrl,
            Instant createdAt) {}
}