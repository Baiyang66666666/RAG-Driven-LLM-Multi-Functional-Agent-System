CREATE TABLE IF NOT EXISTS user_session (
    session TEXT PRIMARY KEY,
    title TEXT,
    user TEXT,
    organization TEXT,
    createdAt INTEGER,
    updatedAt INTEGER
);


CREATE TABLE IF NOT EXISTS session_history (
    id TEXT PRIMARY KEY,
    session TEXT,
    human TEXT,
    ai TEXT,
    createdAt INTEGER,
    updatedAt INTEGER,
    total_time INTEGER,
    stream_time INTEGER
    FOREIGN KEY(session) REFERENCES user_session(session) ON DELETE CASCADE
);


CREATE TABLE IF NOT EXISTS chat_session (
    id TEXT PRIMARY KEY,
    session TEXT,
    organization TEXT,
    user TEXT,
    timestamp INTEGER,
    expiration INTEGER
);
