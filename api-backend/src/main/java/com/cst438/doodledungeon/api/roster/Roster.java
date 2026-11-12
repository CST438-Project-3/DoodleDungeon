package com.cst438.doodledungeon.api.roster;

import java.util.List;
import java.util.Map;
import java.util.UUID;

/** A roster response; member fields stay generic until the guardian model is finalized. */
public record Roster(UUID rosterId, UUID userId, List<Map<String, Object>> members) {

    public Roster {
        // Copy the list so callers cannot add or remove members through this roster instance.
        members = List.copyOf(members);
    }
}
