package doodledungeon.dto;

import java.util.UUID;

public record UserProfile(
        UUID id,
        String email,
        String displayName,
        String avatarUrl
) {
}