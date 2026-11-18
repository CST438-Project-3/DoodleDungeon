package com.cst438.doodledungeon.api.user;

import java.util.UUID;

public record UserProfile(
        UUID id,
        String email,
        String displayName,
        String avatarUrl
) {
}