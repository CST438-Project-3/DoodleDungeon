package com.cst438.doodledungeon.api.roster;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

/** Boundary between HTTP routes and roster storage/business rules. */
public interface RosterService {

    // TODO: Add a PostgreSQL-backed implementation when the roster tables and repository are ready.
    // The owner ID is supplied by the authenticated request, not by client JSON.
    List<Roster> findByOwner(UUID userId);

    Roster create(UUID userId, List<Map<String, Object>> members);

    // Empty means either the roster does not exist or it belongs to a different user.
    Optional<Roster> replace(UUID userId, UUID rosterId, List<Map<String, Object>> members);

    Optional<Roster> updateMembers(UUID userId, UUID rosterId, List<Map<String, Object>> members);

    // False also covers a roster owned by another user, so the API does not reveal it exists.
    boolean delete(UUID userId, UUID rosterId);
}
