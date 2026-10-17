CREATE TABLE creator_avatars (
 owner_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
 avatar_json TEXT NOT NULL CHECK(length(avatar_json)<=1024),
 updated_at TEXT NOT NULL
);
ALTER TABLE creator_generations ADD COLUMN error_code TEXT;
