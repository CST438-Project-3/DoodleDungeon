package com.cst438.doodledungeon.api.schema;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.UUID;
import org.flywaydb.core.Flyway;
import org.flywaydb.core.api.MigrationVersion;
import org.flywaydb.core.api.configuration.FluentConfiguration;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

/** Integration tests for the SQL migrations; the test database is supplied by Docker or CI. */
class RosterSchemaMigrationTest {

    private static final String DATABASE_URL = System.getenv().getOrDefault(
            "TEST_DATABASE_URL", "jdbc:postgresql://localhost:5432/doodledungeon_test");
    private static final String DATABASE_USERNAME = System.getenv().getOrDefault("TEST_DATABASE_USERNAME", "app");
    private static final String DATABASE_PASSWORD = System.getenv().getOrDefault("TEST_DATABASE_PASSWORD", "app");

    private String schemaName;

    @BeforeEach
    void createIsolatedSchema() throws SQLException {
        String newSchemaName = "roster_migration_test_" + UUID.randomUUID().toString().replace("-", "");
        try (Connection connection = rawConnection(); Statement statement = connection.createStatement()) {
            statement.execute("CREATE SCHEMA " + newSchemaName);
        }
        schemaName = newSchemaName;
    }

    @AfterEach
    void dropIsolatedSchema() throws SQLException {
        if (schemaName != null) {
            try (Connection connection = rawConnection(); Statement statement = connection.createStatement()) {
                statement.execute("DROP SCHEMA " + schemaName + " CASCADE");
            }
        }
    }

    @Test
    void migrationMovesExistingDungeonAndRaidMembersIntoOwnedRosters() throws Exception {
        UUID defenderId = UUID.fromString("11111111-1111-4111-8111-111111111111");
        UUID attackerId = UUID.fromString("22222222-2222-4222-8222-222222222222");
        UUID guardianInDungeonId = UUID.fromString("33333333-3333-4333-8333-333333333333");
        UUID guardianInRaidId = UUID.fromString("44444444-4444-4444-8444-444444444444");
        UUID dungeonId = UUID.fromString("55555555-5555-4555-8555-555555555555");
        UUID raidId = UUID.fromString("66666666-6666-4666-8666-666666666666");

        // Start at the old schema version and seed rows as if this database already had live data.
        flyway().target(MigrationVersion.fromVersion("1")).load().migrate();
        insert("INSERT INTO app_users (id, email) VALUES (?, ?)", defenderId, "defender@example.test");
        insert("INSERT INTO app_users (id, email) VALUES (?, ?)", attackerId, "attacker@example.test");
        insert("INSERT INTO guardians (id, owner_user_id, class_name, art_url) VALUES (?, ?, ?, ?)",
                guardianInDungeonId, defenderId, "Warrior", "https://example.test/defender.png");
        insert("INSERT INTO guardians (id, owner_user_id, class_name, art_url) VALUES (?, ?, ?, ?)",
                guardianInRaidId, attackerId, "Ranger", "https://example.test/attacker.png");
        insert("INSERT INTO dungeons (id, owner_user_id) VALUES (?, ?)", dungeonId, defenderId);
        insert("INSERT INTO dungeon_rooms (id, dungeon_id, room_number, guardian_id) VALUES (?, ?, ?, ?)",
                UUID.randomUUID(), dungeonId, 1, guardianInDungeonId);
        insert("INSERT INTO dungeon_rooms (id, dungeon_id, room_number, guardian_id) VALUES (?, ?, ?, ?)",
                UUID.randomUUID(), dungeonId, 2, null);
        insert("INSERT INTO raids (id, attacker_user_id, target_dungeon_id) VALUES (?, ?, ?)",
                raidId, attackerId, dungeonId);
        insert("INSERT INTO raid_party_members (id, raid_id, slot_number, guardian_id) VALUES (?, ?, ?, ?)",
                UUID.randomUUID(), raidId, 1, guardianInRaidId);

        flyway().load().migrate();

        assertEquals(1, count("SELECT count(*) FROM rosters WHERE roster_type = 'defense' AND owner_user_id = ?",
                defenderId));
        assertEquals(1, count("SELECT count(*) FROM rosters WHERE roster_type = 'raid' AND owner_user_id = ?",
                attackerId));
        assertEquals(guardianInDungeonId, value("""
                SELECT rm.guardian_id
                FROM dungeons d
                JOIN roster_members rm ON rm.roster_id = d.defense_roster_id
                WHERE d.id = ? AND rm.slot_number = 1
                """, dungeonId));
        assertEquals(guardianInRaidId, value("""
                SELECT rm.guardian_id
                FROM raids raid
                JOIN roster_members rm ON rm.roster_id = raid.party_roster_id
                WHERE raid.id = ? AND rm.slot_number = 1
                """, raidId));
        assertEquals(0, count("SELECT count(*) FROM information_schema.tables "
                + "WHERE table_schema = ? AND table_name IN ('dungeon_rooms', 'raid_party_members')", schemaName));
    }

    @Test
    void rosterMembersAreLimitedToThreeDistinctSlots() throws Exception {
        UUID ownerId = UUID.randomUUID();
        UUID rosterId = UUID.randomUUID();
        UUID guardianOne = UUID.randomUUID();
        UUID guardianTwo = UUID.randomUUID();
        UUID guardianThree = UUID.randomUUID();

        flyway().load().migrate();
        insert("INSERT INTO app_users (id, email) VALUES (?, ?)", ownerId, "owner@example.test");
        insert("INSERT INTO guardians (id, owner_user_id, class_name, art_url) VALUES (?, ?, ?, ?)",
                guardianOne, ownerId, "Warrior", "https://example.test/one.png");
        insert("INSERT INTO guardians (id, owner_user_id, class_name, art_url) VALUES (?, ?, ?, ?)",
                guardianTwo, ownerId, "Mage", "https://example.test/two.png");
        insert("INSERT INTO guardians (id, owner_user_id, class_name, art_url) VALUES (?, ?, ?, ?)",
                guardianThree, ownerId, "Ranger", "https://example.test/three.png");
        insert("INSERT INTO rosters (id, owner_user_id, roster_type) VALUES (?, ?, ?)",
                rosterId, ownerId, "defense");
        insert("INSERT INTO roster_members (roster_id, slot_number, guardian_id) VALUES (?, ?, ?)",
                rosterId, 1, guardianOne);
        insert("INSERT INTO roster_members (roster_id, slot_number, guardian_id) VALUES (?, ?, ?)",
                rosterId, 2, guardianTwo);
        insert("INSERT INTO roster_members (roster_id, slot_number, guardian_id) VALUES (?, ?, ?)",
                rosterId, 3, guardianThree);

        assertThrows(SQLException.class, () -> insert(
                "INSERT INTO roster_members (roster_id, slot_number, guardian_id) VALUES (?, ?, ?)",
                rosterId, 4, guardianOne));
        assertThrows(SQLException.class, () -> insert(
                "INSERT INTO roster_members (roster_id, slot_number, guardian_id) VALUES (?, ?, ?)",
                rosterId, 1, guardianThree));
        assertEquals(3, count("SELECT count(*) FROM roster_members WHERE roster_id = ?", rosterId));
    }

    private FluentConfiguration flyway() {
        return Flyway.configure()
                .dataSource(DATABASE_URL, DATABASE_USERNAME, DATABASE_PASSWORD)
                .locations("classpath:db/migration")
                .schemas(schemaName)
                .defaultSchema(schemaName);
    }

    private Connection rawConnection() throws SQLException {
        return DriverManager.getConnection(DATABASE_URL, DATABASE_USERNAME, DATABASE_PASSWORD);
    }

    private Connection schemaConnection() throws SQLException {
        Connection connection = rawConnection();
        try (Statement statement = connection.createStatement()) {
            statement.execute("SET search_path TO " + schemaName);
        }
        return connection;
    }

    private void insert(String sql, Object... values) throws SQLException {
        try (Connection connection = schemaConnection(); PreparedStatement statement = connection.prepareStatement(sql)) {
            for (int index = 0; index < values.length; index++) {
                statement.setObject(index + 1, values[index]);
            }
            statement.executeUpdate();
        }
    }

    private int count(String sql, Object... values) throws SQLException {
        return ((Number) value(sql, values)).intValue();
    }

    private Object value(String sql, Object... values) throws SQLException {
        try (Connection connection = schemaConnection(); PreparedStatement statement = connection.prepareStatement(sql)) {
            for (int index = 0; index < values.length; index++) {
                statement.setObject(index + 1, values[index]);
            }
            try (ResultSet resultSet = statement.executeQuery()) {
                resultSet.next();
                return resultSet.getObject(1);
            }
        }
    }
}
