-- A roster owns the ordered guardian slots shared by dungeon defense and raid parties.
CREATE TABLE rosters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
    roster_type TEXT NOT NULL CHECK (roster_type IN ('defense', 'raid')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT rosters_id_owner_unique UNIQUE (id, owner_user_id)
);

CREATE TABLE roster_members (
    roster_id UUID NOT NULL REFERENCES rosters(id) ON DELETE CASCADE,
    slot_number SMALLINT NOT NULL CHECK (slot_number BETWEEN 1 AND 3),
    guardian_id UUID NOT NULL REFERENCES guardians(id) ON DELETE CASCADE,
    CONSTRAINT roster_members_pk PRIMARY KEY (roster_id, slot_number)
);

ALTER TABLE dungeons ADD COLUMN defense_roster_id UUID;
ALTER TABLE raids ADD COLUMN party_roster_id UUID;

-- Build a defense roster for each dungeon and retain each occupied room number as its roster slot.
CREATE TEMP TABLE dungeon_roster_map ON COMMIT DROP AS
SELECT id AS dungeon_id, gen_random_uuid() AS roster_id
FROM dungeons;

INSERT INTO rosters (id, owner_user_id, roster_type, created_at, updated_at)
SELECT mapping.roster_id, dungeon.owner_user_id, 'defense', dungeon.created_at, dungeon.updated_at
FROM dungeon_roster_map mapping
JOIN dungeons dungeon ON dungeon.id = mapping.dungeon_id;

UPDATE dungeons dungeon
SET defense_roster_id = mapping.roster_id
FROM dungeon_roster_map mapping
WHERE dungeon.id = mapping.dungeon_id;

INSERT INTO roster_members (roster_id, slot_number, guardian_id)
SELECT mapping.roster_id, room.room_number, room.guardian_id
FROM dungeon_rooms room
JOIN dungeon_roster_map mapping ON mapping.dungeon_id = room.dungeon_id
WHERE room.guardian_id IS NOT NULL;

-- Each existing raid receives a raid roster, preserving its occupied party slots.
CREATE TEMP TABLE raid_roster_map ON COMMIT DROP AS
SELECT id AS raid_id, gen_random_uuid() AS roster_id
FROM raids;

INSERT INTO rosters (id, owner_user_id, roster_type, created_at, updated_at)
SELECT mapping.roster_id, raid.attacker_user_id, 'raid', raid.started_at, raid.started_at
FROM raid_roster_map mapping
JOIN raids raid ON raid.id = mapping.raid_id;

UPDATE raids raid
SET party_roster_id = mapping.roster_id
FROM raid_roster_map mapping
WHERE raid.id = mapping.raid_id;

INSERT INTO roster_members (roster_id, slot_number, guardian_id)
SELECT mapping.roster_id, party.slot_number, party.guardian_id
FROM raid_party_members party
JOIN raid_roster_map mapping ON mapping.raid_id = party.raid_id
WHERE party.guardian_id IS NOT NULL;

ALTER TABLE dungeons
    ALTER COLUMN defense_roster_id SET NOT NULL,
    ADD CONSTRAINT dungeons_defense_roster_unique UNIQUE (defense_roster_id),
    ADD CONSTRAINT dungeons_defense_roster_owner_fk
        FOREIGN KEY (defense_roster_id, owner_user_id)
        REFERENCES rosters (id, owner_user_id) ON DELETE CASCADE;

ALTER TABLE raids
    ALTER COLUMN party_roster_id SET NOT NULL,
    ADD CONSTRAINT raids_party_roster_owner_fk
        FOREIGN KEY (party_roster_id, attacker_user_id)
        REFERENCES rosters (id, owner_user_id) ON DELETE CASCADE;

DROP TABLE dungeon_rooms;
DROP TABLE raid_party_members;

CREATE INDEX roster_members_guardian_idx ON roster_members (guardian_id);
CREATE INDEX raids_party_roster_idx ON raids (party_roster_id);

CREATE TRIGGER rosters_set_updated_at
    BEFORE UPDATE ON rosters FOR EACH ROW EXECUTE FUNCTION set_updated_at();
