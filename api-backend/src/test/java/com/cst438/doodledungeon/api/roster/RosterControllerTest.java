package com.cst438.doodledungeon.api.roster;

import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.verify;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.security.Principal;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

// Load the MVC controller slice only; MockMvc sends requests without starting a network server.
@WebMvcTest(RosterController.class)
class RosterControllerTest {

    private static final UUID USER_ID = UUID.fromString("c56a4180-65aa-42ec-a945-5fd21dec0538");
    private static final UUID ROSTER_ID = UUID.fromString("550e8400-e29b-41d4-a716-446655440000");
    private static final List<Map<String, Object>> MEMBERS = List.of(Map.of("arbitrary", "guardian data"));

    @Autowired
    private MockMvc mockMvc;

    // Replace storage/business logic with a mock so these tests focus on HTTP behavior.
    @MockitoBean
    private RosterService rosterService;

    @Test
    void getRostersReturnsOnlyTheAuthenticatedUsersRosters() throws Exception {
        given(rosterService.findByOwner(USER_ID)).willReturn(List.of(roster()));

        mockMvc.perform(get("/api/user/rosters").principal(principal(USER_ID)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].rosterId").value(ROSTER_ID.toString()))
                .andExpect(jsonPath("$[0].userId").value(USER_ID.toString()))
                .andExpect(jsonPath("$[0].members[0].arbitrary").value("guardian data"));

        verify(rosterService).findByOwner(USER_ID);
    }

    @Test
    void getRostersWithoutAuthenticatedPrincipalReturnsUnauthorized() throws Exception {
        mockMvc.perform(get("/api/user/rosters"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error").value("unauthorized"))
                .andExpect(jsonPath("$.message").isNotEmpty());
    }

    @Test
    void invalidAuthenticatedUserIdReturnsUnauthorized() throws Exception {
        // MockMvc lets the test attach a Principal directly; real JWT authentication is a future TODO.
        mockMvc.perform(get("/api/user/rosters").principal(() -> "not-a-uuid"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error").value("unauthorized"));
    }

    @ParameterizedTest
    @ValueSource(strings = {"post", "put", "patch", "delete"})
    void itemRoutesWithoutAuthenticatedPrincipalReturnUnauthorized(String method) throws Exception {
        // Exercise each write route with the same missing-principal failure case.
        MockHttpServletRequestBuilder request = switch (method) {
            case "post" -> post("/api/user/rosters").contentType("application/json")
                    .content("{\"members\":[]}");
            case "put" -> put("/api/user/rosters/{rosterId}", ROSTER_ID).contentType("application/json")
                    .content("{\"members\":[]}");
            case "patch" -> patch("/api/user/rosters/{rosterId}", ROSTER_ID).contentType("application/json")
                    .content("{\"members\":[]}");
            case "delete" -> delete("/api/user/rosters/{rosterId}", ROSTER_ID);
            default -> throw new IllegalArgumentException("Unexpected method: " + method);
        };

        mockMvc.perform(request)
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error").value("unauthorized"));
    }

    @Test
    void postRosterReturnsCreatedRosterAndLocation() throws Exception {
        given(rosterService.create(eq(USER_ID), anyList()))
                .willReturn(roster());

        mockMvc.perform(post("/api/user/rosters")
                        .principal(principal(USER_ID))
                        .contentType("application/json")
                        .content("{\"members\":[{\"arbitrary\":\"guardian data\"}]}"))
                .andExpect(status().isCreated())
                .andExpect(header().string("Location", "/api/user/rosters/" + ROSTER_ID))
                .andExpect(jsonPath("$.rosterId").value(ROSTER_ID.toString()))
                .andExpect(jsonPath("$.userId").value(USER_ID.toString()));
    }

    @Test
    void putRosterReplacesMembers() throws Exception {
        given(rosterService.replace(eq(USER_ID), eq(ROSTER_ID), anyList()))
                .willReturn(Optional.of(roster()));

        mockMvc.perform(put("/api/user/rosters/{rosterId}", ROSTER_ID)
                        .principal(principal(USER_ID))
                        .contentType("application/json")
                        .content("{\"members\":[{\"arbitrary\":\"guardian data\"}]}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.rosterId").value(ROSTER_ID.toString()));
    }

    @Test
    void patchRosterUpdatesMembers() throws Exception {
        given(rosterService.updateMembers(eq(USER_ID), eq(ROSTER_ID), anyList()))
                .willReturn(Optional.of(roster()));

        mockMvc.perform(patch("/api/user/rosters/{rosterId}", ROSTER_ID)
                        .principal(principal(USER_ID))
                        .contentType("application/json")
                        .content("{\"members\":[{\"arbitrary\":\"guardian data\"}]}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.members[0].arbitrary").value("guardian data"));
    }

    @Test
    void deleteRosterReturnsNoContent() throws Exception {
        given(rosterService.delete(USER_ID, ROSTER_ID)).willReturn(true);

        mockMvc.perform(delete("/api/user/rosters/{rosterId}", ROSTER_ID)
                        .principal(principal(USER_ID)))
                .andExpect(status().isNoContent());

        verify(rosterService).delete(USER_ID, ROSTER_ID);
    }

    @Test
    void missingRosterReturnsNotFound() throws Exception {
        given(rosterService.replace(eq(USER_ID), eq(ROSTER_ID), anyList()))
                .willReturn(Optional.empty());

        mockMvc.perform(put("/api/user/rosters/{rosterId}", ROSTER_ID)
                        .principal(principal(USER_ID))
                        .contentType("application/json")
                        .content("{\"members\":[]}"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.error").value("not_found"));
    }

    @Test
    void patchForMissingOrUnownedRosterReturnsNotFound() throws Exception {
        given(rosterService.updateMembers(eq(USER_ID), eq(ROSTER_ID), anyList()))
                .willReturn(Optional.empty());

        mockMvc.perform(patch("/api/user/rosters/{rosterId}", ROSTER_ID)
                        .principal(principal(USER_ID))
                        .contentType("application/json")
                        .content("{\"members\":[]}"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.error").value("not_found"));
    }

    @Test
    void deleteForMissingOrUnownedRosterReturnsNotFound() throws Exception {
        given(rosterService.delete(USER_ID, ROSTER_ID)).willReturn(false);

        mockMvc.perform(delete("/api/user/rosters/{rosterId}", ROSTER_ID)
                        .principal(principal(USER_ID)))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.error").value("not_found"));
    }

    @Test
    void missingMembersBodyReturnsBadRequest() throws Exception {
        mockMvc.perform(post("/api/user/rosters")
                        .principal(principal(USER_ID))
                        .contentType("application/json")
                        .content("{}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("invalid_request"));
    }

    @Test
    void malformedJsonReturnsBadRequest() throws Exception {
        mockMvc.perform(post("/api/user/rosters")
                        .principal(principal(USER_ID))
                        .contentType("application/json")
                        .content("{"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("invalid_request"))
                .andExpect(jsonPath("$.message").isNotEmpty());
    }

    @Test
    void nullRosterMemberReturnsBadRequest() throws Exception {
        mockMvc.perform(post("/api/user/rosters")
                        .principal(principal(USER_ID))
                        .contentType("application/json")
                        .content("{\"members\":[null]}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("invalid_request"));
    }

    @Test
    void malformedRosterIdReturnsBadRequest() throws Exception {
        mockMvc.perform(delete("/api/user/rosters/not-a-uuid")
                        .principal(principal(USER_ID)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("invalid_request"));
    }

    private static Roster roster() {
        return new Roster(ROSTER_ID, USER_ID, MEMBERS);
    }

    private static Principal principal(UUID userId) {
        return () -> userId.toString();
    }
}
