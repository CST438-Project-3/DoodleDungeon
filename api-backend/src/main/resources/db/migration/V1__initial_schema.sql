-- Baseline for the schema that existed before roster-based teams.
CREATE TABLE app_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT,
    display_name TEXT,
    avatar_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE auth_identities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
    provider TEXT NOT NULL CHECK (provider IN ('google', 'github')),
    provider_subject TEXT NOT NULL,
    provider_email TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT auth_identities_provider_subject_unique UNIQUE (provider, provider_subject),
    CONSTRAINT auth_identities_one_per_provider_per_user UNIQUE (user_id, provider)
);

CREATE TABLE guardians (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
    name TEXT,
    class_name TEXT NOT NULL CHECK (class_name IN ('Warrior', 'Brawler', 'Ranger', 'Mage')),
    art_url TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE dungeons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_user_id UUID NOT NULL UNIQUE REFERENCES app_users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE dungeon_rooms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dungeon_id UUID NOT NULL REFERENCES dungeons(id) ON DELETE CASCADE,
    room_number SMALLINT NOT NULL CHECK (room_number BETWEEN 1 AND 3),
    guardian_id UUID REFERENCES guardians(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT dungeon_rooms_number_unique UNIQUE (dungeon_id, room_number),
    CONSTRAINT dungeon_rooms_guardian_unique UNIQUE (guardian_id)
);

CREATE TABLE raids (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    attacker_user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
    target_dungeon_id UUID NOT NULL REFERENCES dungeons(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'resolved', 'failed')),
    outcome TEXT CHECK (outcome IN ('attacker_win', 'defender_win', 'draw')),
    started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at TIMESTAMPTZ,
    CONSTRAINT raids_completion_after_start CHECK (completed_at IS NULL OR completed_at >= started_at),
    CONSTRAINT raids_state_is_consistent CHECK (
        (status = 'pending' AND outcome IS NULL AND completed_at IS NULL)
        OR (status = 'resolved' AND outcome IS NOT NULL AND completed_at IS NOT NULL)
        OR (status = 'failed' AND outcome IS NULL AND completed_at IS NOT NULL)
    )
);

CREATE TABLE raid_party_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    raid_id UUID NOT NULL REFERENCES raids(id) ON DELETE CASCADE,
    slot_number SMALLINT NOT NULL CHECK (slot_number BETWEEN 1 AND 3),
    guardian_id UUID REFERENCES guardians(id) ON DELETE SET NULL,
    CONSTRAINT raid_party_slot_unique UNIQUE (raid_id, slot_number)
);

CREATE TABLE battle_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    raid_id UUID NOT NULL UNIQUE REFERENCES raids(id) ON DELETE CASCADE,
    summary TEXT,
    events JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(events) = 'array'),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX auth_identities_user_id_idx ON auth_identities (user_id);
CREATE INDEX guardians_owner_created_idx ON guardians (owner_user_id, created_at DESC);
CREATE INDEX dungeon_rooms_dungeon_idx ON dungeon_rooms (dungeon_id);
CREATE INDEX raids_attacker_started_idx ON raids (attacker_user_id, started_at DESC);
CREATE INDEX raids_target_started_idx ON raids (target_dungeon_id, started_at DESC);
CREATE INDEX raid_party_members_raid_idx ON raid_party_members (raid_id);

CREATE FUNCTION set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

CREATE TRIGGER app_users_set_updated_at
    BEFORE UPDATE ON app_users FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER guardians_set_updated_at
    BEFORE UPDATE ON guardians FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER dungeons_set_updated_at
    BEFORE UPDATE ON dungeons FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER dungeon_rooms_set_updated_at
    BEFORE UPDATE ON dungeon_rooms FOR EACH ROW EXECUTE FUNCTION set_updated_at();
