package doodledungeon.controller;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;

import java.util.UUID;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@Testcontainers
class UserControllerIntegrationTest {
    private static final UUID USER_ID =
            UUID.fromString("c4d57482-87ca-4f68-93d5-25b7a9d918e5");

    @Container
    static final PostgreSQLContainer POSTGRES =
            new PostgreSQLContainer("postgres:17-alpine")
                    .withDatabaseName("doodledungeon_test")
                    .withUsername("test_user")
                    .withPassword("test_password");

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @DynamicPropertySource
    static void configureDatabase(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", POSTGRES::getJdbcUrl);
        registry.add("spring.datasource.username", POSTGRES::getUsername);
        registry.add("spring.datasource.password", POSTGRES::getPassword);
    }

    @BeforeEach
    void createTestUserTable() {
        jdbcTemplate.execute("DROP TABLE IF EXISTS app_users");
        jdbcTemplate.execute("""
                CREATE TABLE app_users (
                    id UUID PRIMARY KEY,
                    email TEXT,
                    display_name TEXT,
                    avatar_url TEXT,
                    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
                    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
                )
                """);
        jdbcTemplate.update(
                """
                INSERT INTO app_users (id, email, display_name, avatar_url)
                VALUES (?, ?, ?, ?)
                """,
                USER_ID,
                "player@example.com",
                "Dungeon Player",
                "https://example.com/avatar.png"
        );
    }

    @Test
    void getMyProfileReturnsTheSignedInUsersProfile() throws Exception {
        mockMvc.perform(get("/api/users/me")
                        .principal(() -> USER_ID.toString()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(USER_ID.toString()))
                .andExpect(jsonPath("$.email").value("player@example.com"))
                .andExpect(jsonPath("$.displayName").value("Dungeon Player"))
                .andExpect(jsonPath("$.avatarUrl")
                        .value("https://example.com/avatar.png"));
    }

    @Test
    void getMyProfileRequiresASignedInUser() throws Exception {
        mockMvc.perform(get("/api/users/me"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void getMyProfileReturnsNotFoundWhenTheUserDoesNotExist() throws Exception {
        UUID missingUserId =
                UUID.fromString("a6df1305-cd4a-4a61-9c1b-9ddadf8b3fb2");

        mockMvc.perform(get("/api/users/me")
                        .principal(() -> missingUserId.toString()))
                .andExpect(status().isNotFound());
    }

    @Test
    void patchMyProfileUpdatesTheDisplayName() throws Exception {
        mockMvc.perform(patch("/api/users/me")
                        .principal(() -> USER_ID.toString())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"displayName":"Updated Player"}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.displayName").value("Updated Player"));
    }

    @Test
    void patchMyProfileRejectsABlankDisplayName() throws Exception {
        mockMvc.perform(patch("/api/users/me")
                        .principal(() -> USER_ID.toString())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"displayName":"   "}
                                """))
                .andExpect(status().isBadRequest());
    }

    @Test
    void deleteMyAccountDeletesTheUserAndReturnsNoContent() throws Exception {
        mockMvc.perform(delete("/api/users/me")
                        .principal(() -> USER_ID.toString()))
                .andExpect(status().isNoContent());

        Integer remainingUsers = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM app_users WHERE id = ?",
                Integer.class,
                USER_ID
        );

        org.junit.jupiter.api.Assertions.assertEquals(0, remainingUsers);
    }
}