package com.cst438.doodledungeon.api.guardian;

import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.cst438.doodledungeon.api.auth.SessionTokens;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Primary;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.web.client.RestClient;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

@SpringBootTest(properties = {
        "spring.flyway.enabled=true",
        "app.jwt-secret=test-only-secret-at-least-32-characters-long",
        "app.admin-user-ids=00000000-0000-0000-0000-000000000001",
        "oauth.github.client-id=github-test",
        "oauth.github.client-secret=github-test-secret",
        "oauth.google.client-id=google-test",
        "oauth.google.client-secret=google-test-secret"
})
@AutoConfigureMockMvc
@Testcontainers
@Import(AdminGuardianIntegrationTest.ProviderConfiguration.class)
class AdminGuardianIntegrationTest {
    private static final UUID ADMIN_ID =
            UUID.fromString("00000000-0000-0000-0000-000000000001");

    private static final String DRAWING = """
            {"name":"Moss Knight","guardianClass":"Mage",
             "strokes":[{"color":"#1976d2","points":[{"x":20,"y":30},{"x":40,"y":50}]}]}
            """;

    @Container
    static final PostgreSQLContainer POSTGRES =
            new PostgreSQLContainer("postgres:17-alpine");

    @Autowired
    MockMvc mvc;

    @Autowired
    JdbcTemplate jdbc;

    @Autowired
    ObjectMapper json;

    @Autowired
    SessionTokens tokens;

    @DynamicPropertySource
    static void database(DynamicPropertyRegistry properties) {
        properties.add("spring.datasource.url", POSTGRES::getJdbcUrl);
        properties.add("spring.datasource.username", POSTGRES::getUsername);
        properties.add("spring.datasource.password", POSTGRES::getPassword);
    }

    @TestConfiguration
    static class ProviderConfiguration {
        @Bean
        @Primary
        RestClient.Builder providerClient() {
            return RestClient.builder();
        }
    }

    @BeforeEach
    void resetDatabase() {
        jdbc.update("DELETE FROM app_users");
        jdbc.update("INSERT INTO app_users (id) VALUES (?)", ADMIN_ID);
    }

    @Test
    void adminCanListGuardiansFromDifferentUsers() throws Exception {
        String firstGuardianId = createGuardian(newUserToken());
        String secondGuardianId = createGuardian(newUserToken());

        String response = mvc.perform(get("/api/admin/guardians")
                        .header("Authorization", bearer(adminToken())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(2))
                .andReturn()
                .getResponse()
                .getContentAsString();

        assertTrue(response.contains(firstGuardianId));
        assertTrue(response.contains(secondGuardianId));
    }

    @Test
    void adminCanDeleteAGuardian() throws Exception {
        String guardianId = createGuardian(newUserToken());

        mvc.perform(delete("/api/admin/guardians/" + guardianId)
                        .header("Authorization", bearer(adminToken())))
                .andExpect(status().isNoContent());

        Integer remaining = jdbc.queryForObject(
                "SELECT COUNT(*) FROM guardians WHERE id = ?",
                Integer.class,
                UUID.fromString(guardianId));

        assertTrue(remaining != null && remaining == 0);
    }

    @Test
    void nonAdminCannotListOrDeleteGuardians() throws Exception {
        String guardianId = createGuardian(newUserToken());
        String nonAdminToken = newUserToken();

        mvc.perform(get("/api/admin/guardians")
                        .header("Authorization", bearer(nonAdminToken)))
                .andExpect(status().isForbidden());

        mvc.perform(delete("/api/admin/guardians/" + guardianId)
                        .header("Authorization", bearer(nonAdminToken)))
                .andExpect(status().isForbidden());

        Integer remaining = jdbc.queryForObject(
                "SELECT COUNT(*) FROM guardians WHERE id = ?",
                Integer.class,
                UUID.fromString(guardianId));

        assertTrue(remaining != null && remaining == 1);
    }

    @Test
    void adminRoutesRequireAuthentication() throws Exception {
        mvc.perform(get("/api/admin/guardians"))
                .andExpect(status().isUnauthorized());

        mvc.perform(delete("/api/admin/guardians/" + UUID.randomUUID()))
                .andExpect(status().isUnauthorized());
    }

    private String createGuardian(String userToken) throws Exception {
        String response = mvc.perform(post("/api/guardians")
                        .header("Authorization", bearer(userToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(DRAWING))
                .andExpect(status().isCreated())
                .andReturn()
                .getResponse()
                .getContentAsString();

        JsonNode guardian = json.readTree(response);
        return guardian.path("id").asText();
    }

    private String newUserToken() {
        UUID userId = UUID.randomUUID();
        jdbc.update("INSERT INTO app_users (id) VALUES (?)", userId);
        return tokens.issue(userId.toString());
    }

    private String adminToken() {
        return tokens.issue(ADMIN_ID.toString());
    }

    private String bearer(String token) {
        return "Bearer " + token;
    }
}