package com.cst438.doodledungeon.api.roster;

import java.net.URI;
import java.security.Principal;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

/** Maps roster HTTP requests to the service; Spring serializes returned records as JSON. */
@RestController
@RequestMapping("/api/user/rosters")
public class RosterController {

    private final RosterService rosterService;

    // Spring supplies the RosterService implementation here; keep database work out of the HTTP layer.
    public RosterController(RosterService rosterService) {
        this.rosterService = rosterService;
    }

    // Return only the signed-in user's rosters; the owner ID comes from the authenticated principal.
    @GetMapping
    public List<Roster> list(Principal principal) {
        return rosterService.findByOwner(userId(principal));
    }

    // A 201 response includes Location so clients can address the new roster directly.
    @PostMapping
    public ResponseEntity<Roster> create(
            Principal principal,
            @RequestBody RosterRequest request) {
        Roster roster = rosterService.create(userId(principal), members(request));
        URI location = URI.create("/api/user/rosters/" + roster.rosterId());
        return ResponseEntity.created(location).body(roster);
    }

    // PUT replaces the roster's member list. The service also checks that this user owns the roster.
    @PutMapping("/{rosterId}")
    public Roster replace(
            Principal principal,
            @PathVariable UUID rosterId,
            @RequestBody RosterRequest request) {
        // Optional.orElseThrow turns a missing/unowned result into the same 404 response.
        return rosterService.replace(userId(principal), rosterId, members(request))
                .orElseThrow(() -> notFound(rosterId));
    }

    // PATCH updates the member list while keeping the roster ID and owner unchanged.
    @PatchMapping("/{rosterId}")
    public Roster updateMembers(
            Principal principal,
            @PathVariable UUID rosterId,
            @RequestBody RosterRequest request) {
        // Keep the missing/unowned behavior consistent with PUT.
        return rosterService.updateMembers(userId(principal), rosterId, members(request))
                .orElseThrow(() -> notFound(rosterId));
    }

    // A successful delete has no response body; false means missing or owned by someone else.
    @DeleteMapping("/{rosterId}")
    public ResponseEntity<Void> delete(Principal principal, @PathVariable UUID rosterId) {
        if (!rosterService.delete(userId(principal), rosterId)) {
            throw notFound(rosterId);
        }
        return ResponseEntity.noContent().build();
    }

    // TODO: Configure Spring Security to validate bearer tokens and put the user's UUID in Principal.
    // This check validates the principal value's format; it does not validate a token by itself.
    private UUID userId(Principal principal) {
        if (principal == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Missing or invalid authorization");
        }
        try {
            return UUID.fromString(principal.getName());
        } catch (IllegalArgumentException exception) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid authenticated user ID", exception);
        }
    }

    // Map<String, Object> keeps guardian fields open for now; only require an array of non-null objects.
    private List<Map<String, Object>> members(RosterRequest request) {
        if (request == null || request.members() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "The members list is required");
        }
        if (request.members().stream().anyMatch(Objects::isNull)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Roster members must be objects");
        }
        return request.members();
    }

    // Empty Optional/false from the service becomes the API's 404 response.
    private ResponseStatusException notFound(UUID rosterId) {
        return new ResponseStatusException(HttpStatus.NOT_FOUND, "Roster not found: " + rosterId);
    }
}
