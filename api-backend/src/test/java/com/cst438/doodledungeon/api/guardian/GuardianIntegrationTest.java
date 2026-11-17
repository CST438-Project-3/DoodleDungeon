package com.cst438.doodledungeon.api.guardian;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;

import static org.springframework.test.web.client.response.MockRestResponseCreators.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

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
import org.springframework.test.web.client.MockRestServiceServer;
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
        "oauth.github.client-id=github-test", "oauth.github.client-secret=github-test-secret",
        "oauth.google.client-id=google-test", "oauth.google.client-secret=google-test-secret"
})
@AutoConfigureMockMvc
@Testcontainers
@Import(GuardianIntegrationTest.ProviderConfiguration.class)
class GuardianIntegrationTest {
    @Container
    static final PostgreSQLContainer POSTGRES = new PostgreSQLContainer("postgres:17-alpine");
    static MockRestServiceServer provider;
    @Autowired MockMvc mvc;
    @Autowired JdbcTemplate jdbc;
    @Autowired ObjectMapper json;
    @Autowired SessionTokens tokens;

    static final String DRAWING = """
            {"name":"  Moss Knight  ","guardianClass":"Mage",
             "strokes":[{"color":"#1976d2","points":[{"x":20,"y":30},{"x":40,"y":50}]}]}
            """;

    @DynamicPropertySource
    static void database(DynamicPropertyRegistry properties) {
        properties.add("spring.datasource.url", POSTGRES::getJdbcUrl);
        properties.add("spring.datasource.username", POSTGRES::getUsername);
        properties.add("spring.datasource.password", POSTGRES::getPassword);
    }

    @TestConfiguration
    static class ProviderConfiguration {
        @Bean @Primary
        RestClient.Builder providerClient() {
            RestClient.Builder builder = RestClient.builder();
            provider = MockRestServiceServer.bindTo(builder).build();
            return builder;
        }
    }

    @BeforeEach
    void reset() {
        provider.reset();
        jdbc.update("DELETE FROM app_users");
    }

    @Test
    void githubLoginCreatesPersistentUserAndGuardianThatCanBeFetchedAfterLoginAgain() throws Exception {
        JsonNode auth = githubLogin("12345");
        String token = auth.path("token").asText();
        UUID userId = UUID.fromString(auth.path("user").path("id").asText());
        JsonNode saved = json.readTree(mvc.perform(post("/api/guardians").header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON).content(DRAWING))
                .andExpect(status().isCreated()).andExpect(header().exists("Location"))
                .andExpect(jsonPath("$.name").value("Moss Knight"))
                .andExpect(jsonPath("$.guardianClass").value("Mage"))
                .andExpect(jsonPath("$.strokes[0].points[1].x").value(40))
                .andReturn().getResponse().getContentAsString());
        assertTrue(saved.path("artUrl").asText().startsWith("data:image/svg+xml;base64,"));
        assertEquals(userId, jdbc.queryForObject("SELECT owner_user_id FROM guardians WHERE id = ?", UUID.class,
                UUID.fromString(saved.path("id").asText())));
        provider.reset();
        JsonNode secondLogin = githubLogin("12345");
        assertEquals(userId.toString(), secondLogin.path("user").path("id").asText());
        assertEquals(1, jdbc.queryForObject("SELECT count(*) FROM app_users", Integer.class));
        mvc.perform(get("/api/guardians").header("Authorization", "Bearer " + secondLogin.path("token").asText()))
                .andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].id").value(saved.path("id").asText()));
        provider.verify();
    }

    @Test
    void otherAccountsCannotListOrFetchAGuardian() throws Exception {
        String token = newUserToken();
        JsonNode saved = json.readTree(mvc.perform(post("/api/guardians").header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON).content(DRAWING)).andReturn().getResponse().getContentAsString());
        String otherToken = newUserToken();
        mvc.perform(get("/api/guardians").header("Authorization", "Bearer " + otherToken))
                .andExpect(status().isOk()).andExpect(content().json("[]"));
        mvc.perform(get("/api/guardians/" + saved.path("id").asText()).header("Authorization", "Bearer " + otherToken))
                .andExpect(status().isNotFound());
    }

    @Test
    void requestsCannotChooseAnotherOwner() throws Exception {
        UUID attacker = UUID.randomUUID();
        jdbc.update("INSERT INTO app_users (id) VALUES (?)", attacker);
        String body = DRAWING.replace("\"name\":", "\"owner_user_id\":\"" + attacker + "\",\"name\":");
        mvc.perform(post("/api/guardians").header("Authorization", "Bearer " + newUserToken())
                .contentType(MediaType.APPLICATION_JSON).content(body)).andExpect(status().isCreated());
        assertEquals(0, jdbc.queryForObject("SELECT count(*) FROM guardians WHERE owner_user_id = ?", Integer.class, attacker));
    }

    @Test
    void missingInvalidExpiredAndForgedTokensAreRejected() throws Exception {
        mvc.perform(get("/api/guardians")).andExpect(status().isUnauthorized());
        mvc.perform(post("/api/guardians").contentType(MediaType.APPLICATION_JSON).content(DRAWING))
                .andExpect(status().isUnauthorized());
        mvc.perform(get("/api/guardians").header("Authorization", "Bearer garbage")).andExpect(status().isUnauthorized());
        String validToken = newUserToken();
        String forged = validToken.substring(0, validToken.lastIndexOf('.') + 1) + "a".repeat(43);
        mvc.perform(get("/api/guardians").header("Authorization", "Bearer " + forged)).andExpect(status().isUnauthorized());
        var claims = new com.nimbusds.jwt.JWTClaimsSet.Builder().subject(UUID.randomUUID().toString())
                .issuer("doodledungeon").expirationTime(java.util.Date.from(java.time.Instant.now().minusSeconds(120))).build();
        var jwt = new com.nimbusds.jwt.SignedJWT(new com.nimbusds.jose.JWSHeader(com.nimbusds.jose.JWSAlgorithm.HS256), claims);
        jwt.sign(new com.nimbusds.jose.crypto.MACSigner("test-only-secret-at-least-32-characters-long"));
        mvc.perform(get("/api/guardians").header("Authorization", "Bearer " + jwt.serialize())).andExpect(status().isUnauthorized());
    }

    @Test
    void rejectsInvalidNamesClassesAndDrawingWithoutSaving() throws Exception {
        String token = newUserToken();
        for (String invalid : new String[]{DRAWING.replace("  Moss Knight  ", " "), DRAWING.replace("Mage", "Wizard"),
                DRAWING.replace("#1976d2", "javascript:alert(1)"), DRAWING.replace("\"x\":20", "\"x\":301"),
                "{\"name\":\"Test\",\"guardianClass\":\"Mage\",\"strokes\":[]}"}) {
            mvc.perform(post("/api/guardians").header("Authorization", "Bearer " + token)
                    .contentType(MediaType.APPLICATION_JSON).content(invalid)).andExpect(status().isBadRequest());
        }
        assertEquals(0, jdbc.queryForObject("SELECT count(*) FROM guardians", Integer.class));
    }

    @Test
    void deletedUserCannotUseOldToken() throws Exception {
        String token = newUserToken();
        jdbc.update("DELETE FROM app_users");
        mvc.perform(get("/api/guardians").header("Authorization", "Bearer " + token)).andExpect(status().isUnauthorized());
    }

    @Test
    void browserPreflightAllowsAuthorizationAndPostButRejectsUnknownOrigin() throws Exception {
        mvc.perform(options("/api/guardians").header("Origin", "http://localhost:8081")
                .header("Access-Control-Request-Method", "POST").header("Access-Control-Request-Headers", "authorization,content-type"))
                .andExpect(status().isOk()).andExpect(header().string("Access-Control-Allow-Origin", "http://localhost:8081"));
        mvc.perform(options("/api/guardians").header("Origin", "https://untrusted.example")
                .header("Access-Control-Request-Method", "POST")).andExpect(status().isForbidden());
    }

    @Test
    void googleLoginUsesPkceAndMapsProviderSubjectToUuid() throws Exception {
        provider.expect(requestTo("https://oauth2.googleapis.com/token"))
                .andExpect(org.springframework.test.web.client.match.MockRestRequestMatchers.content().string(org.hamcrest.Matchers.containsString("code_verifier=verifier")))
                .andRespond(withSuccess("{\"access_token\":\"google-token\"}", MediaType.APPLICATION_JSON));
        provider.expect(requestTo("https://openidconnect.googleapis.com/v1/userinfo"))
                .andExpect(org.springframework.test.web.client.match.MockRestRequestMatchers.header("Authorization", "Bearer google-token"))
                .andRespond(withSuccess("{\"sub\":\"google-sub\",\"name\":\"Player\"}", MediaType.APPLICATION_JSON));
        String response = mvc.perform(post("/api/auth/google").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"code\":\"code\",\"clientId\":\"google-test\",\"redirectUri\":\"http://localhost:8081\",\"codeVerifier\":\"verifier\"}"))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        assertNotNull(UUID.fromString(json.readTree(response).path("user").path("id").asText()));
        provider.verify();
    }

    @Test
    void rejectsUnconfiguredClientRedirectAndMissingPkceBeforeCallingProvider() throws Exception {
        for (String body : new String[]{
                "{\"code\":\"code\",\"clientId\":\"unknown\",\"redirectUri\":\"http://localhost:8081\"}",
                "{\"code\":\"code\",\"clientId\":\"github-test\",\"redirectUri\":\"https://untrusted.example\"}"}) {
            mvc.perform(post("/api/auth/github").contentType(MediaType.APPLICATION_JSON).content(body))
                    .andExpect(status().is4xxClientError());
        }
        mvc.perform(post("/api/auth/google").contentType(MediaType.APPLICATION_JSON)
                .content("{\"code\":\"code\",\"clientId\":\"google-test\",\"redirectUri\":\"http://localhost:8081\"}"))
                .andExpect(status().isBadRequest());
        provider.verify();
    }

    private String newUserToken() {
        UUID id = UUID.randomUUID();
        jdbc.update("INSERT INTO app_users (id) VALUES (?)", id);
        return tokens.issue(id.toString());
    }

    private JsonNode githubLogin(String subject) throws Exception {
        provider.expect(requestTo("https://github.com/login/oauth/access_token"))
                .andRespond(withSuccess("{\"access_token\":\"github-token\"}", MediaType.APPLICATION_JSON));
        provider.expect(requestTo("https://api.github.com/user")).andExpect(org.springframework.test.web.client.match.MockRestRequestMatchers.header("Authorization", "Bearer github-token"))
                .andRespond(withSuccess("{\"id\":\"" + subject + "\",\"login\":\"player\"}", MediaType.APPLICATION_JSON));
        return json.readTree(mvc.perform(post("/api/auth/github").contentType(MediaType.APPLICATION_JSON)
                .content("{\"code\":\"code\",\"clientId\":\"github-test\",\"redirectUri\":\"http://localhost:8081\"}"))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
    }
}
