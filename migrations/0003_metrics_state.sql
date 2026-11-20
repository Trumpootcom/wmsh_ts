CREATE TABLE IF NOT EXISTS metrics_state (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    reset_at TEXT NOT NULL
);

INSERT OR IGNORE INTO metrics_state (id, reset_at)
VALUES (1, '1970-01-01T00:00:00.000Z');
