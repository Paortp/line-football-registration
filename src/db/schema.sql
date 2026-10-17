-- Schema for SUNSAOWAREE AC LINE Football Bot

CREATE TABLE IF NOT EXISTS sessions (
    id SERIAL PRIMARY KEY,
    chat_id VARCHAR(64) NOT NULL,
    status VARCHAR(16) NOT NULL DEFAULT 'open',
    note TEXT,
    opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    closed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_sessions_chat_id ON sessions (chat_id);

CREATE TABLE IF NOT EXISTS session_entries (
    id SERIAL PRIMARY KEY,
    session_id INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    type VARCHAR(16) NOT NULL, -- 'member' or 'guest'
    user_id VARCHAR(64),
    display_name VARCHAR(128),
    picture_url TEXT,
    added_by_user_id VARCHAR(64),
    added_by_name VARCHAR(128),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_entries_session_id ON session_entries (session_id);
