# Doodle Dungeon architecture

## System overview

```mermaid
flowchart LR
    WEB["Web client"]
    ANDROID["Android client"]
    GOOGLE["Google OAuth"]
    GITHUB["GitHub OAuth"]
    API["Spring Boot REST API"]
    DB[("PostgreSQL database")]
    ART["Guardian art storage"]

    WEB -->|"Authorization Code + PKCE"| GOOGLE
    WEB -->|"Authorization Code + PKCE"| GITHUB
    ANDROID -->|"Authorization Code + PKCE"| GOOGLE
    ANDROID -->|"Authorization Code + PKCE"| GITHUB

    GOOGLE -->|"Sign-in result"| WEB
    GITHUB -->|"Sign-in result"| WEB
    GOOGLE -->|"Sign-in result"| ANDROID
    GITHUB -->|"Sign-in result"| ANDROID

    WEB -->|"Sign-in result and API requests"| API
    ANDROID -->|"Sign-in result and API requests"| API
    API -->|"Verify or complete token exchange"| GOOGLE
    API -->|"Verify or complete token exchange"| GITHUB
    API -->|"Read and write game data"| DB
    API -->|"Save and retrieve artwork"| ART
```

The API checks the user's access to each requested resource and issues the
app's short-lived token after sign-in. OAuth credentials stay on the server.

## Database ERD

This diagram matches the initial PostgreSQL schema in `database/schema.sql`.

```mermaid
erDiagram
    APP_USERS ||--o{ AUTH_IDENTITIES : signs_in_with
    APP_USERS ||--o{ GUARDIANS : owns
    APP_USERS ||--o| DUNGEONS : has
    DUNGEONS ||--o{ DUNGEON_ROOMS : contains
    GUARDIANS o|--o| DUNGEON_ROOMS : assigned_to
    APP_USERS ||--o{ RAIDS : starts
    DUNGEONS ||--o{ RAIDS : targeted_by
    RAIDS ||--o{ RAID_PARTY_MEMBERS : uses
    GUARDIANS o|--o{ RAID_PARTY_MEMBERS : selected_as
    RAIDS ||--o| BATTLE_LOGS : produces

    APP_USERS {
        uuid id PK
        text email
        text display_name
        text avatar_url
        timestamptz created_at
        timestamptz updated_at
    }
    AUTH_IDENTITIES {
        uuid id PK
        uuid user_id FK
        text provider
        text provider_subject
        text provider_email
    }
    GUARDIANS {
        uuid id PK
        uuid owner_user_id FK
        text name
        text class_name
        text art_url
        timestamptz created_at
        timestamptz updated_at
    }
    DUNGEONS {
        uuid id PK
        uuid owner_user_id FK
        timestamptz created_at
        timestamptz updated_at
    }
    DUNGEON_ROOMS {
        uuid id PK
        uuid dungeon_id FK
        smallint room_number
        uuid guardian_id FK
        timestamptz created_at
        timestamptz updated_at
    }
    RAIDS {
        uuid id PK
        uuid attacker_user_id FK
        uuid target_dungeon_id FK
        text status
        text outcome
        timestamptz started_at
        timestamptz completed_at
    }
    RAID_PARTY_MEMBERS {
        uuid id PK
        uuid raid_id FK
        smallint slot_number
        uuid guardian_id FK
    }
    BATTLE_LOGS {
        uuid id PK
        uuid raid_id FK
        text summary
        jsonb events
        timestamptz created_at
    }
```

Each user can own multiple guardians and at most one dungeon. A dungeon has
up to three rooms. A raid records its attacker and target dungeon, can use up
to three guardians, and can produce one battle log. The API must verify that
users only access their own resources.