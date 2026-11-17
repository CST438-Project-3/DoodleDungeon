ALTER TABLE guardians
    ADD COLUMN IF NOT EXISTS art_strokes JSONB NOT NULL DEFAULT '[]'::jsonb
    CHECK (jsonb_typeof(art_strokes) = 'array');
