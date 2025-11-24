CREATE TABLE IF NOT EXISTS games (
    id SERIAL PRIMARY KEY,
    game_id VARCHAR(255),
    map_name VARCHAR(255),
    score INTEGER,
    round_time INTEGER,
    total_duration INTEGER,
    played_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    data JSONB
);
