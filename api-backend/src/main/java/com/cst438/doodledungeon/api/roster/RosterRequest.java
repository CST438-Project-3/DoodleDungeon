package com.cst438.doodledungeon.api.roster;

import java.util.List;
import java.util.Map;

/** Request body for create, replace, and update routes. */
public record RosterRequest(List<Map<String, Object>> members) {
    // TODO: Replace the generic maps with the agreed guardian request type once that model is defined.
}
