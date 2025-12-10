CREATE TABLE IF NOT EXISTS player_aliases (
    alias_id TEXT PRIMARY KEY,
    primary_id TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (primary_id) REFERENCES players(id)
);
