package doodledungeon;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public class UserRepository {
    private final JdbcTemplate jdbcTemplate;

    public UserRepository(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    public Optional<UserProfile> findById(UUID userId) {
        List<UserProfile> users = jdbcTemplate.query(
                """
                SELECT id, email, display_name, avatar_url
                FROM app_users
                WHERE id = ?
                """,
                (resultSet, rowNumber) -> new UserProfile(
                        resultSet.getObject("id", UUID.class),
                        resultSet.getString("email"),
                        resultSet.getString("display_name"),
                        resultSet.getString("avatar_url")
                ),
                userId
        );

        return users.stream().findFirst();
    }

    public int updateDisplayName(UUID userId, String displayName) {
        return jdbcTemplate.update(
                """
                UPDATE app_users
                SET display_name = ?
                WHERE id = ?
                """,
                displayName,
                userId
        );
    }

    public int deleteById(UUID userId) {
        return jdbcTemplate.update(
                "DELETE FROM app_users WHERE id = ?",
                userId
        );
    }
}